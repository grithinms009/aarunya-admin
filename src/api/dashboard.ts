/* Dashboard numbers — GET /api/admin/dashboard?period=today|7|30. */
import { req } from './client';
import type { Order } from '@/data/types';

export type Period = 'today' | '7' | '30';

export interface TopSeller {
  pid: string;
  name: string;
  img: string;
  units: number;
  revenue: number;
}

export interface LowStockRow {
  pid: string;
  name: string;
  color: string;
  sku: string;
  img: string;
  stock: number;
}

export interface DashboardSummary {
  period: Period;
  revenue: { total: number; online: number; offline: number };
  orderCount: { total: number; online: number; offline: number };
  units: number;
  pieces: number;
  average: number;
  attention: {
    paidToPack: number;
    packedToShip: number;
    awaitingPayment: number;
    returnsToReview: number;
    lowStock: number;
    outOfStock: number;
  };
  recent: Order[];
  top: TopSeller[];
  low: LowStockRow[];
}

export const dashboard = {
  summary: (period: Period) =>
    req<DashboardSummary>('/admin/dashboard', { query: { period } }),
};
