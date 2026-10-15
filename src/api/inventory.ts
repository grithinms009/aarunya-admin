/* Inventory — GET /api/admin/inventory/{summary,stock,ledger} and POST /quick, /adjust.
   Every adjustment lands as one ledger row and can never push stock below zero. */
import { download, req } from './client';
import type { AdjustReason } from './meta';
import type { LedgerEntry, LedgerReason } from '@/data/types';

export type AdjustMode = 'add' | 'remove' | 'set';
/* The reason list comes from meta.reference(); the server owns its labels. */
export type { AdjustReason };

export interface StockRow {
  pid: string;
  vid: string;
  name: string;
  color: string;
  sku: string;
  stock: number;
  img: string;
  /** Most recent ledger entry for this variant, for the "Last change" column. */
  lastReason: LedgerReason | null;
  lastAt: string;
}

export interface InventorySummary {
  units: number;
  variants: number;
  value: number;
  low: number;
  out: number;
  lowThreshold: number;
}

export interface StockQuery {
  q?: string;
  cat?: string;
  stock?: '' | 'in' | 'low' | 'out';
}

export interface LedgerQuery {
  q?: string;
  reason?: LedgerReason | '';
  limit?: number;
}

export const inventory = {
  summary: () => req<InventorySummary>('/admin/inventory/summary'),

  stock: (query: StockQuery = {}) =>
    req<StockRow[]>('/admin/inventory/stock', { query: { ...query } }),

  ledger: (query: LedgerQuery = {}) =>
    req<LedgerEntry[]>('/admin/inventory/ledger', { query: { ...query } }),

  /** ±1 from the stock table. */
  quick: async (vid: string, delta: number): Promise<void> => {
    await req('/admin/inventory/quick', { method: 'POST', body: { vid, delta } });
  },

  adjust: async (input: {
    vid: string;
    mode: AdjustMode;
    qty: number;
    reason: AdjustReason;
    note: string;
  }): Promise<void> => {
    await req('/admin/inventory/adjust', { method: 'POST', body: input });
  },

  exportCsv: (query: StockQuery = {}) =>
    download('/admin/inventory/export.csv', { ...query }, 'aarunya-inventory.csv'),
};
