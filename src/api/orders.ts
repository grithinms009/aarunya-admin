/* Orders and offline sales. Becomes GET /api/admin/orders, the status transitions and
   POST /api/admin/offline-sales.

   The rules enforced here are the ones the brief requires server-side: order numbers
   are sequential per channel, an order cannot advance while payment is pending, it
   cannot be marked shipped without a courier and AWB, cancelling restores stock and
   marks a paid order refunded, and every stock movement writes one ledger row inside
   the same change. */
import { DAY, num, sod, ymd } from '@/lib/format';
import { db, findVariant, moveStock, mutate, reply } from './mock/store';
import type {
  Channel,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from '@/data/types';

export type ChannelFilter = 'all' | Channel;
export type DateRange = 'today' | '7' | '30' | '90' | 'all' | 'custom';

export interface OrderQuery {
  ch?: ChannelFilter;
  status?: OrderStatus | '';
  pay?: PaymentStatus | '';
  range?: DateRange;
  from?: string;
  to?: string;
  q?: string;
}

export interface OrderListResult {
  rows: Order[];
  /** Counts per channel before the channel filter, for the segment labels. */
  counts: { all: number; online: number; offline: number };
  summary: {
    sales: number;
    orders: number;
    online: number;
    onlineCount: number;
    offline: number;
    offlineCount: number;
    units: number;
    average: number;
  };
}

/** The forward-only online flow and the button label for each step. */
export const NEXT_STEP: Partial<Record<OrderStatus, [OrderStatus, string]>> = {
  new: ['packed', 'Mark as packed'],
  packed: ['shipped', 'Mark as shipped'],
  shipped: ['out', 'Mark out for delivery'],
  out: ['delivered', 'Mark as delivered'],
};

export const ORDER_STEPS: [OrderStatus, string][] = [
  ['new', 'Placed'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['out', 'Out for delivery'],
  ['delivered', 'Delivered'],
];

export class RuleError extends Error {}

function withinRange(o: Order, query: OrderQuery): boolean {
  const t = +new Date(o.createdAt);
  let start = 0;
  let end = Infinity;
  const range = query.range ?? '30';
  if (range === 'today') start = sod();
  else if (['7', '30', '90'].includes(range)) start = Date.now() - Number(range) * DAY;
  else if (range === 'custom') {
    if (query.from) start = +new Date(query.from + 'T00:00:00');
    if (query.to) end = +new Date(query.to + 'T23:59:59');
  }
  return t >= start && t <= end;
}

function matches(o: Order, query: OrderQuery, ignoreChannel: boolean): boolean {
  const q = (query.q ?? '').trim().toLowerCase();
  if (!ignoreChannel && query.ch && query.ch !== 'all' && o.channel !== query.ch) return false;
  if (query.status && o.status !== query.status) return false;
  if (query.pay && o.payment.status !== query.pay) return false;
  if (!withinRange(o, query)) return false;
  if (
    q &&
    ![o.id, o.customer.name, o.customer.phone, o.customer.city, ...o.items.map((l) => l.name)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
    return false;
  return true;
}

/** Next number in the channel's sequence: AJ1001… online, OS1… offline. */
function nextOrderNo(d: ReturnType<typeof db>, channel: Channel): string {
  const prefix = channel === 'online' ? 'AJ' : 'OS';
  const base = channel === 'online' ? 1000 : 200;
  const max = d.orders
    .filter((o) => o.channel === channel)
    .reduce((m, o) => Math.max(m, parseInt(String(o.id).slice(2), 10) || 0), base);
  return prefix + (max + 1);
}

export const orders = {
  list(query: OrderQuery = {}): Promise<OrderListResult> {
    const d = db();
    const base = d.orders.filter((o) => matches(o, query, true));
    const rows = query.ch && query.ch !== 'all' ? base.filter((o) => o.channel === query.ch) : base;
    const live = rows.filter((o) => o.status !== 'cancelled');
    const sum = (a: Order[]) => a.reduce((t, o) => t + o.total, 0);
    const online = live.filter((o) => o.channel === 'online');
    const offline = live.filter((o) => o.channel === 'offline');
    const sales = sum(live);

    return reply({
      rows,
      counts: {
        all: base.length,
        online: base.filter((o) => o.channel === 'online').length,
        offline: base.filter((o) => o.channel === 'offline').length,
      },
      summary: {
        sales,
        orders: live.length,
        online: sum(online),
        onlineCount: online.length,
        offline: sum(offline),
        offlineCount: offline.length,
        units: live.reduce((t, o) => t + o.items.reduce((u, l) => u + l.qty, 0), 0),
        average: live.length ? sales / live.length : 0,
      },
    });
  },

  get: (orderNo: string): Promise<Order | null> =>
    reply(db().orders.find((o) => o.id === orderNo) ?? null),

  /** Recent offline sales, for the POS sidebar. */
  recentOffline: (limit = 5): Promise<Order[]> =>
    reply(db().orders.filter((o) => o.channel === 'offline').slice(0, limit)),

  /** Online orders that can take a return request. */
  returnable: (limit = 60): Promise<Order[]> =>
    reply(
      db()
        .orders.filter((o) => o.channel === 'online' && o.status !== 'cancelled')
        .slice(0, limit),
    ),

  advance(orderNo: string, shipment: { courier: string; awb: string }): Promise<Order> {
    const o = db().orders.find((x) => x.id === orderNo);
    const next = o && NEXT_STEP[o.status];
    if (!o || !next) return Promise.reject(new RuleError('This order has no next step'));
    if (o.payment.status === 'pending') {
      return Promise.reject(new RuleError('Payment is still pending. Mark it as paid first.'));
    }
    const awb = o.shipment?.awb || shipment.awb.trim();
    if (next[0] === 'shipped' && !awb) {
      return Promise.reject(new RuleError('Add the courier and tracking number first'));
    }

    return reply(
      mutate((dd) => {
        const x = dd.orders.find((y) => y.id === orderNo)!;
        x.status = next[0];
        if (next[0] === 'shipped' && !x.shipment?.awb) {
          x.shipment = {
            courier: shipment.courier,
            awb: shipment.awb.trim(),
            shippedAt: new Date().toISOString(),
          };
        }
        x.history.push({ at: new Date().toISOString(), status: next[0], note: '' });
        return x;
      }),
    );
  },

  saveShipment(orderNo: string, shipment: { courier: string; awb: string }): Promise<Order> {
    if (!shipment.awb.trim()) {
      return Promise.reject(new RuleError('Enter the tracking number (AWB)'));
    }
    return reply(
      mutate((dd) => {
        const x = dd.orders.find((y) => y.id === orderNo)!;
        x.shipment = {
          ...(x.shipment ?? {}),
          courier: shipment.courier,
          awb: shipment.awb.trim(),
          shippedAt: x.shipment?.shippedAt ?? new Date().toISOString(),
        };
        x.history.push({
          at: new Date().toISOString(),
          status: x.status,
          note: `Tracking saved: ${shipment.awb.trim()}`,
        });
        return x;
      }),
    );
  },

  markPaid: (orderNo: string): Promise<Order> =>
    reply(
      mutate((dd) => {
        const x = dd.orders.find((y) => y.id === orderNo)!;
        x.payment.status = 'paid';
        x.history.push({
          at: new Date().toISOString(),
          status: x.status,
          note: 'Payment marked as received',
        });
        return x;
      }),
    ),

  saveNote: (orderNo: string, note: string): Promise<void> =>
    reply(
      mutate((dd) => {
        dd.orders.find((y) => y.id === orderNo)!.note = note.trim();
      }),
    ),

  /** Puts every item back into stock and marks a paid order refunded. */
  cancel: (orderNo: string): Promise<void> =>
    reply(
      mutate((dd) => {
        const x = dd.orders.find((y) => y.id === orderNo);
        if (!x || x.status === 'cancelled') return;
        x.items.forEach((l) => moveStock(dd, l.vid, l.qty, 'cancel', orderNo));
        if (x.payment.status === 'paid') x.payment.status = 'refunded';
        x.status = 'cancelled';
        x.history.push({
          at: new Date().toISOString(),
          status: 'cancelled',
          note: 'Cancelled by admin. Items added back to stock.',
        });
      }),
    ),

  /** Offline sale: reduces stock and writes one ledger row per line. */
  recordOfflineSale(input: {
    lines: { pid: string; vid: string; name: string; color: string; sku: string; img: string; qty: number; price: number }[];
    discount: number;
    method: string;
    location: string;
    date: string;
    name: string;
    phone: string;
    note: string;
  }): Promise<Order> {
    const d = db();
    if (!input.lines.length) return Promise.reject(new RuleError('Add pieces to the bill'));

    const phone = input.phone.replace(/\D/g, '');
    if (phone && phone.length < 10) {
      return Promise.reject(new RuleError('Check the phone number (10 digits)'));
    }

    for (const l of input.lines) {
      const [, v] = findVariant(d, l.vid);
      if (!v || v.stock < l.qty) {
        return Promise.reject(new RuleError(`Only ${v ? v.stock : 0} left of ${l.name}`));
      }
      if (!(num(l.price) > 0)) {
        return Promise.reject(new RuleError(`Enter a price for ${l.name}`));
      }
    }

    const subtotal = input.lines.reduce((t, l) => t + l.price * l.qty, 0);
    const discount = Math.min(subtotal, input.discount);
    const id = nextOrderNo(d, 'offline');
    const at =
      !input.date || input.date === ymd()
        ? new Date().toISOString()
        : new Date(input.date + 'T12:00:00').toISOString();

    const items: OrderItem[] = input.lines.map((l) => ({
      pid: l.pid,
      vid: l.vid,
      name: l.name,
      color: l.color,
      sku: l.sku,
      qty: l.qty,
      price: l.price,
      img: l.img,
    }));

    const order: Order = {
      id,
      channel: 'offline',
      createdAt: at,
      customer: {
        name: input.name.trim(),
        phone,
        email: '',
        address: '',
        city: '',
        state: '',
        pin: '',
      },
      items,
      subtotal,
      shipping: 0,
      giftWrap: false,
      giftFee: 0,
      discount,
      total: subtotal - discount,
      payment: { status: 'paid', method: input.method },
      status: 'completed',
      shipment: null,
      location: input.location,
      note: input.note.trim(),
      history: [{ at, status: 'completed', note: `Offline sale · ${input.location}` }],
    };

    return reply(
      mutate((dd) => {
        dd.orders.unshift(order);
        dd.orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        order.items.forEach((l) => moveStock(dd, l.vid, -l.qty, 'offline', id));
        return order;
      }),
    );
  },
};
