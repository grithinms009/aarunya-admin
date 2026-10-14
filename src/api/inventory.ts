/* Inventory. Becomes GET /api/admin/inventory, GET /api/admin/inventory/ledger and
   POST /api/admin/inventory/adjust. Every adjustment goes through moveStock(), so it
   lands as one ledger row and can never push stock below zero. */
import { db, findVariant, moveStock, mutate, reply } from './mock/store';
import type { LedgerEntry, LedgerReason } from '@/data/types';

export type AdjustMode = 'add' | 'remove' | 'set';
export type AdjustReason = 'restock' | 'damaged' | 'correction' | 'sample' | 'other';

/** Reason labels written into the ledger note, as the prototype's ADJ list does. */
export const ADJUST_REASONS: [AdjustReason, string][] = [
  ['restock', 'New stock received'],
  ['damaged', 'Damaged or defective'],
  ['correction', 'Stock count correction'],
  ['sample', 'Used as gift or sample'],
  ['other', 'Other'],
];

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
  summary(): Promise<InventorySummary> {
    const d = db();
    const low = d.config.LOW_STOCK || 2;
    const all = d.products.flatMap((p) => p.variants.map((v) => ({ p, v })));
    return reply({
      units: all.reduce((t, x) => t + x.v.stock, 0),
      variants: all.length,
      value: all.reduce((t, x) => t + x.v.stock * x.p.price, 0),
      low: all.filter((x) => x.v.stock > 0 && x.v.stock <= low).length,
      out: all.filter((x) => x.v.stock === 0).length,
      lowThreshold: low,
    });
  },

  stock(query: StockQuery = {}): Promise<StockRow[]> {
    const d = db();
    const low = d.config.LOW_STOCK || 2;
    const q = (query.q ?? '').trim().toLowerCase();

    /* The ledger is newest-first, so the first hit per variant is its last change. */
    const last = new Map<string, LedgerEntry>();
    d.ledger.forEach((m) => {
      if (!last.has(m.vid)) last.set(m.vid, m);
    });

    const rows = d.products
      .flatMap((p) => p.variants.map((v) => ({ p, v })))
      .filter(({ p, v }) => {
        if (query.cat && p.category !== query.cat) return false;
        if (q && !`${p.name} ${v.sku}`.toLowerCase().includes(q)) return false;
        if (query.stock === 'out' && v.stock !== 0) return false;
        if (query.stock === 'low' && !(v.stock > 0 && v.stock <= low)) return false;
        if (query.stock === 'in' && v.stock === 0) return false;
        return true;
      })
      .sort((a, b) => a.v.stock - b.v.stock || a.p.name.localeCompare(b.p.name));

    return reply(
      rows.map(({ p, v }) => {
        const m = last.get(v.id);
        return {
          pid: p.id,
          vid: v.id,
          name: p.name,
          color: v.color,
          sku: v.sku,
          stock: v.stock,
          img: v.images[0] || '',
          lastReason: m ? m.reason : null,
          lastAt: m ? m.at : '',
        };
      }),
    );
  },

  ledger(query: LedgerQuery = {}): Promise<LedgerEntry[]> {
    const q = (query.q ?? '').trim().toLowerCase();
    return reply(
      db()
        .ledger.filter(
          (m) =>
            (!query.reason || m.reason === query.reason) &&
            (!q || `${m.name} ${m.sku} ${m.ref}`.toLowerCase().includes(q)),
        )
        .slice(0, query.limit ?? 200),
    );
  },

  /** ±1 from the stock table. */
  quick(vid: string, delta: number): Promise<void> {
    return reply(
      mutate((dd) =>
        moveStock(dd, vid, delta, 'adjust', '', delta > 0 ? 'Quick add' : 'Quick remove'),
      ),
    );
  },

  adjust(input: {
    vid: string;
    mode: AdjustMode;
    qty: number;
    reason: AdjustReason;
    note: string;
  }): Promise<void> {
    const [, v] = findVariant(db(), input.vid);
    if (!v) return Promise.reject(new Error('That colour no longer exists'));
    if (!(input.qty >= 0) || (input.mode !== 'set' && !input.qty)) {
      return Promise.reject(new Error('Enter a quantity'));
    }
    const delta =
      input.mode === 'add'
        ? input.qty
        : input.mode === 'remove'
          ? -Math.min(input.qty, v.stock)
          : input.qty - v.stock;
    if (!delta) return reply(undefined);

    const label = (ADJUST_REASONS.find((x) => x[0] === input.reason) ?? ADJUST_REASONS[4])[1];
    const note = [label, input.note.trim()].filter(Boolean).join(' · ');
    return reply(mutate((dd) => moveStock(dd, input.vid, delta, 'adjust', '', note)));
  },
};
