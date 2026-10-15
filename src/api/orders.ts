/* Orders and offline sales — GET /api/admin/orders, the status transitions and
   POST /api/admin/orders/offline-sales.

   The rules the brief requires server-side are enforced by the API: sequential order
   numbers per channel, no advance while payment is pending, no "shipped" without a
   courier and AWB, cancel restores stock and marks a paid order refunded. A refusal
   comes back as a RuleError carrying the message to show. */
import { ApiError, download, req } from './client';
import type { Channel, Order, OrderStatus, PaymentStatus } from '@/data/types';

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

export class RuleError extends Error {}

/** A refused transition is a rule the screen shows as a toast. */
const asRule = (e: unknown): never => {
  if (e instanceof ApiError && (e.code === 'rule' || e.status === 409)) {
    throw new RuleError(e.message);
  }
  throw e;
};

const id = (orderNo: string) => encodeURIComponent(orderNo);

export const orders = {
  list: (query: OrderQuery = {}) =>
    req<OrderListResult>('/admin/orders', { query: { ...query } }),

  get: (orderNo: string) =>
    req<Order | null>(`/admin/orders/${id(orderNo)}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),

  /** Recent offline sales, for the POS sidebar. */
  recentOffline: (limit = 5) =>
    req<Order[]>('/admin/orders/recent-offline', { query: { limit } }),

  /** Online orders that can take a return request. */
  returnable: (limit = 60) =>
    req<Order[]>('/admin/orders/returnable', { query: { limit } }),

  advance: (orderNo: string, shipment: { courier: string; awb: string }) =>
    req<Order>(`/admin/orders/${id(orderNo)}/advance`, { method: 'POST', body: shipment })
      .catch(asRule),

  saveShipment: (orderNo: string, shipment: { courier: string; awb: string }) =>
    req<Order>(`/admin/orders/${id(orderNo)}/shipment`, { method: 'PUT', body: shipment })
      .catch(asRule),

  markPaid: (orderNo: string) =>
    req<Order>(`/admin/orders/${id(orderNo)}/payment/mark-paid`, { method: 'POST' })
      .catch(asRule),

  saveNote: async (orderNo: string, note: string): Promise<void> => {
    await req(`/admin/orders/${id(orderNo)}/note`, { method: 'PATCH', body: { note } });
  },

  /** Puts every item back into stock and marks a paid order refunded. */
  cancel: async (orderNo: string): Promise<void> => {
    await req(`/admin/orders/${id(orderNo)}/cancel`, { method: 'POST' }).catch(asRule);
  },

  /** Offline sale: the server re-checks live stock per line before it writes. */
  recordOfflineSale: (input: {
    lines: {
      pid: string; vid: string; name: string; color: string; sku: string;
      img: string; qty: number; price: number;
    }[];
    discount: number;
    method: string;
    location: string;
    date: string;
    name: string;
    phone: string;
    note: string;
  }) =>
    req<Order>('/admin/orders/offline-sales', { method: 'POST', body: input }).catch(asRule),

  exportCsv: (query: OrderQuery = {}) =>
    download('/admin/orders/export.csv', { ...query }, 'aarunya-orders.csv'),
};
