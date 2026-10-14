/* Returns and exchanges. Becomes GET /api/admin/returns and the transition endpoints
   (approve, reject, pickup, receive, replacement, refund).

   Eligibility and every stock effect are decided here because the backend will decide
   them: a restocked return adds stock back with reason "return", a replacement takes
   one unit with reason "replacement", and a refund sets the order's payment to
   refunded or partial depending on the amount. */
import { DAY, inr, num } from '@/lib/format';
import { db, findVariant, moveStock, mutate, reply } from './mock/store';
import type { ReturnRequest, ReturnStatus, ReturnType } from '@/data/types';

export const RETURN_STEPS: [ReturnStatus, string][] = [
  ['requested', 'Requested'],
  ['approved', 'Approved'],
  ['pickup', 'Pickup'],
  ['received', 'Received'],
  ['completed', 'Resolved'],
];

export const RETURN_REASONS = [
  'Arrived damaged',
  'Received wrong item',
  'Received wrong colour',
  'Stone missing',
  'Clasp broken',
  'Different from photos',
  'Other',
];

export type ReturnTab = 'review' | 'progress' | 'closed' | 'all';

const GROUPS: Record<Exclude<ReturnTab, 'all'>, ReturnStatus[]> = {
  review: ['requested'],
  progress: ['approved', 'pickup', 'received'],
  closed: ['completed', 'rejected'],
};

export interface ReturnQuery {
  tab?: ReturnTab;
  type?: ReturnType | '';
  q?: string;
}

export interface ReturnListResult {
  rows: ReturnRequest[];
  counts: Record<ReturnTab, number>;
}

export interface Eligibility {
  inWindow: boolean;
  categoryOk: boolean;
  videoOk: boolean;
  ok: boolean;
  days: number;
  category: string;
}

export class ReturnRuleError extends Error {}

/** Policy check shown in the drawer and used to flag rows in the list. */
export function eligibility(r: ReturnRequest): Eligibility {
  const d = db();
  const cfg = d.config;
  const days = Math.max(0, (+new Date(r.createdAt) - +new Date(r.deliveredAt)) / DAY);
  const product = d.products.find((x) => x.id === r.item.pid);
  const category = product ? product.category : '';
  const inWindow = days <= num(cfg.returnWindow) + 0.01;
  /* A damaged or broken piece overrides the category rule. */
  const categoryOk =
    !(cfg.nonEligible ?? []).includes(category) || /damag|broken|missing/i.test(r.reason);
  const videoOk = !cfg.requireVideo || r.video;
  return {
    inWindow,
    categoryOk,
    videoOk,
    ok: inWindow && categoryOk && videoOk,
    days: Math.round(days),
    category,
  };
}

function step(
  id: string,
  status: ReturnStatus,
  patch: Partial<ReturnRequest>,
  note: string,
): Promise<ReturnRequest> {
  return reply(
    mutate((dd) => {
      const r = dd.returns.find((x) => x.id === id)!;
      Object.assign(r, patch);
      r.status = status;
      r.history.push({ at: new Date().toISOString(), status, note });
      if (status === 'rejected') r.resolution = 'Rejected: ' + note;
      return r;
    }),
  );
}

export const returns = {
  list(query: ReturnQuery = {}): Promise<ReturnListResult> {
    const d = db();
    const q = (query.q ?? '').trim().toLowerCase();
    const base = d.returns.filter(
      (r) =>
        (!query.type || r.type === query.type) &&
        (!q ||
          `${r.id} ${r.orderId} ${r.customer.name} ${r.item.name}`.toLowerCase().includes(q)),
    );
    const tab = query.tab ?? 'review';
    return reply({
      rows: tab === 'all' ? base : base.filter((r) => GROUPS[tab].includes(r.status)),
      counts: {
        review: base.filter((r) => GROUPS.review.includes(r.status)).length,
        progress: base.filter((r) => GROUPS.progress.includes(r.status)).length,
        closed: base.filter((r) => GROUPS.closed.includes(r.status)).length,
        all: base.length,
      },
    });
  },

  get: (returnNo: string): Promise<ReturnRequest | null> =>
    reply(db().returns.find((r) => r.id === returnNo) ?? null),

  eligibility: (r: ReturnRequest): Eligibility => eligibility(r),

  approve: (id: string, type: ReturnType) =>
    step(id, 'approved', { type }, `Approved as ${type}`),

  reject: (id: string, reason: string) => {
    if (!reason.trim()) {
      return Promise.reject(new ReturnRuleError('Add a short reason for the customer'));
    }
    return step(id, 'rejected', {}, reason.trim());
  },

  schedulePickup: (id: string, courier: string, date: string, courierName: string, dateLabel: string) =>
    step(id, 'pickup', { pickup: { courier, date } }, `Pickup on ${dateLabel} via ${courierName}`),

  /** Restocking is optional: only an unused, undamaged piece goes back on the shelf. */
  receive: (id: string, restock: boolean): Promise<ReturnRequest> =>
    reply(
      mutate((dd) => {
        const r = dd.returns.find((x) => x.id === id)!;
        r.status = 'received';
        r.restocked = restock;
        if (restock) moveStock(dd, r.item.vid, r.item.qty || 1, 'return', id);
        r.history.push({
          at: new Date().toISOString(),
          status: 'received',
          note: restock
            ? 'Item received and added back to stock'
            : 'Item received (not restocked)',
        });
        return r;
      }),
    ),

  sendReplacement(id: string, vid: string, awb: string): Promise<ReturnRequest> {
    const [p, v] = findVariant(db(), vid);
    if (!p || !v || v.stock < 1) {
      return Promise.reject(
        new ReturnRuleError('That colour is out of stock. Pick another or offer a refund.'),
      );
    }
    const colorLabel = db().colors[v.color]?.label ?? v.color;
    return reply(
      mutate((dd) => {
        const r = dd.returns.find((x) => x.id === id)!;
        moveStock(dd, vid, -1, 'replacement', id);
        r.status = 'completed';
        r.resolution = `Replacement sent: ${p.name} (${colorLabel})${
          awb.trim() ? ' · AWB ' + awb.trim() : ''
        }`;
        r.history.push({
          at: new Date().toISOString(),
          status: 'completed',
          note: r.resolution,
        });
        return r;
      }),
    );
  },

  refund(id: string, amount: number, method: string): Promise<ReturnRequest> {
    if (!(amount > 0)) return Promise.reject(new ReturnRuleError('Enter the refund amount'));
    return reply(
      mutate((dd) => {
        const r = dd.returns.find((x) => x.id === id)!;
        r.status = 'completed';
        r.resolution = `Refunded ${inr(amount)} via ${method.toLowerCase()}`;
        r.history.push({
          at: new Date().toISOString(),
          status: 'completed',
          note: r.resolution,
        });
        /* A full refund marks the order refunded; anything less is a part refund. */
        const o = dd.orders.find((x) => x.id === r.orderId);
        if (o) o.payment.status = amount >= o.total ? 'refunded' : 'partial';
        return r;
      }),
    );
  },

  /** Logged by hand for customers who message on WhatsApp or by phone. */
  log(input: {
    orderId: string;
    vid: string;
    type: ReturnType;
    reason: string;
    note: string;
    video: boolean;
  }): Promise<ReturnRequest> {
    const d = db();
    const o = d.orders.find((x) => x.id === input.orderId);
    if (!o) return Promise.reject(new ReturnRuleError('Choose the order'));

    const item = o.items.find((l) => l.vid === input.vid) ?? o.items[0];
    const max = d.returns.reduce(
      (m, r) => Math.max(m, parseInt(r.id.slice(2), 10) || 0),
      300,
    );
    const id = 'RX' + (max + 1);
    const at = new Date().toISOString();
    const delivered =
      o.history.filter((h) => h.status === 'delivered').pop()?.at ?? o.createdAt;

    return reply(
      mutate((dd) => {
        const req: ReturnRequest = {
          id,
          orderId: o.id,
          customer: { name: o.customer.name, phone: o.customer.phone },
          item: { ...item, qty: 1 },
          type: input.type,
          reason: input.reason,
          note: input.note.trim(),
          video: input.video,
          photos: 0,
          createdAt: at,
          deliveredAt: delivered,
          status: 'requested',
          resolution: '',
          pickup: null,
          history: [{ at, status: 'requested', note: 'Logged by admin' }],
        };
        dd.returns.unshift(req);
        const order = dd.orders.find((x) => x.id === o.id);
        if (order) order.returnId = id;
        return req;
      }),
    );
  },

  /** The policy block in the sidebar writes straight back to settings. */
  savePolicy: (patch: {
    returnWindow?: number;
    nonEligible?: string[];
    requireVideo?: boolean;
    allowRefund?: boolean;
  }): Promise<void> =>
    reply(
      mutate((dd) => {
        Object.assign(dd.config, patch);
      }),
    ),
};
