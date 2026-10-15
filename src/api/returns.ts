/* Returns and exchanges — GET /api/admin/returns and the transition endpoints
   (approve, reject, pickup, receive, replacement, refund).

   Eligibility and every stock effect are decided by the server: a restocked return adds
   stock back with reason "return", a replacement takes one unit with reason
   "replacement", and a refund sets the order's payment to refunded or partial depending
   on the amount. Each row arrives with its policy check already attached, so the list
   and the drawer can read it without another call. */
import { ApiError, req } from './client';
import type { ReturnRequest, ReturnType } from '@/data/types';

export type ReturnTab = 'review' | 'progress' | 'closed' | 'all';

export interface ReturnQuery {
  tab?: ReturnTab;
  type?: ReturnType | '';
  q?: string;
}

export interface Eligibility {
  inWindow: boolean;
  categoryOk: boolean;
  videoOk: boolean;
  ok: boolean;
  days: number;
  category: string;
}

/** What the API adds to each request: the policy check for that piece. */
type WithEligibility = ReturnRequest & { eligibility?: Eligibility };

export interface ReturnListResult {
  rows: WithEligibility[];
  counts: Record<ReturnTab, number>;
}

export class ReturnRuleError extends Error {}

const asRule = (e: unknown): never => {
  if (e instanceof ApiError && (e.code === 'rule' || e.status === 409)) {
    throw new ReturnRuleError(e.message);
  }
  throw e;
};

const id = (returnNo: string) => encodeURIComponent(returnNo);

/** Reads the check the server attached. Permissive only if it is somehow missing. */
export function eligibility(r: ReturnRequest): Eligibility {
  const e = (r as WithEligibility).eligibility;
  return (
    e ?? { inWindow: true, categoryOk: true, videoOk: true, ok: true, days: 0, category: '' }
  );
}

export const returns = {
  list: (query: ReturnQuery = {}) =>
    req<ReturnListResult>('/admin/returns', { query: { ...query } }),

  get: (returnNo: string) =>
    req<WithEligibility | null>(`/admin/returns/${id(returnNo)}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),

  eligibility,

  approve: (returnNo: string, type: ReturnType) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/approve`, {
      method: 'POST',
      body: { type },
    }).catch(asRule),

  reject: (returnNo: string, reason: string) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/reject`, {
      method: 'POST',
      body: { reason },
    }).catch(asRule),

  schedulePickup: (
    returnNo: string,
    courier: string,
    date: string,
    courierName: string,
    dateLabel: string,
  ) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/pickup`, {
      method: 'POST',
      body: { courier, date, courierName, dateLabel },
    }).catch(asRule),

  /** Restocking is optional: only an unused, undamaged piece goes back on the shelf. */
  receive: (returnNo: string, restock: boolean) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/receive`, {
      method: 'POST',
      body: { restock },
    }).catch(asRule),

  sendReplacement: (returnNo: string, vid: string, awb: string) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/replacement`, {
      method: 'POST',
      body: { vid, awb },
    }).catch(asRule),

  refund: (returnNo: string, amount: number, method: string) =>
    req<ReturnRequest>(`/admin/returns/${id(returnNo)}/refund`, {
      method: 'POST',
      body: { amount, method },
    }).catch(asRule),

  /** Logged by hand for customers who message on WhatsApp or by phone. */
  log: (input: {
    orderId: string;
    vid: string;
    type: ReturnType;
    reason: string;
    note: string;
    video: boolean;
  }) => req<ReturnRequest>('/admin/returns', { method: 'POST', body: input }).catch(asRule),

  /** The policy block in the sidebar writes straight back to settings. */
  savePolicy: async (patch: {
    returnWindow?: number;
    nonEligible?: string[];
    requireVideo?: boolean;
    allowRefund?: boolean;
  }): Promise<void> => {
    await req('/admin/returns/policy', { method: 'PUT', body: patch });
  },
};
