/* DEV-ONLY mock backend store.
   The admin is written against src/api/*, which currently reads and writes this
   browser-side dataset. When the Spring Boot API lands, each module in src/api/ swaps its
   body for a fetch call and this whole folder is deleted — no screen changes.

   Every stock change goes through moveStock(), the mirror of the backend's StockService:
   it clamps at zero and writes exactly one ledger row, so stock and ledger never diverge. */
import { buildSeed } from '@/data/seed/demo';
import type { AdminDb, LedgerEntry, Product, Variant } from '@/data/types';

const KEY = 'aj_admin_mock_db';
const SESSION_KEY = 'aj_admin_mock_session';

let cache: AdminDb | null = null;

const clone = <T>(x: T): T => structuredClone(x);

function read(): AdminDb | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as AdminDb;
    return db && db.v === 1 && db.products ? db : null;
  } catch {
    return null;
  }
}

function write(db: AdminDb): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('aarunya admin: mock storage full', e);
    throw new Error(
      'Browser storage is full. Use smaller images or remove some, then save again.',
    );
  }
}

/** The live dataset, seeded on first use. */
export function db(): AdminDb {
  if (!cache) {
    cache = read() ?? buildSeed();
    write(cache);
  }
  return cache;
}

/** Apply a change to the dataset and persist it. Returns whatever fn returns. */
export function mutate<T>(fn: (d: AdminDb) => T): T {
  const next = clone(db());
  const out = fn(next);
  write(next);
  cache = next;
  return out;
}

export function resetDb(): AdminDb {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  cache = buildSeed();
  write(cache);
  return cache;
}

export function findVariant(
  d: AdminDb,
  vid: string,
): [Product, Variant] | [null, null] {
  for (const p of d.products) {
    const v = p.variants.find((x) => x.id === vid);
    if (v) return [p, v];
  }
  return [null, null];
}

/** Single point of stock mutation: clamps at 0, appends one ledger row. */
export function moveStock(
  d: AdminDb,
  vid: string,
  change: number,
  reason: LedgerEntry['reason'],
  ref = '',
  note = '',
): void {
  const [p, v] = findVariant(d, vid);
  if (!p || !v || !change) return;
  v.stock = Math.max(0, v.stock + change);
  d.ledger.unshift({
    at: new Date().toISOString(),
    pid: p.id,
    vid,
    sku: v.sku,
    name: p.name,
    color: v.color,
    change,
    reason,
    ref,
    note,
  });
}

/* ---- session (stands in for the HTTP-only cookie the API will set) ---- */

export const session = {
  get(): boolean {
    try {
      return localStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  },
  set(on: boolean): void {
    try {
      if (on) localStorage.setItem(SESSION_KEY, '1');
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Mock network latency, as the storefront's mock layer does. */
export const reply = <T>(data: T, ms = 60): Promise<T> =>
  new Promise((r) => setTimeout(() => r(clone(data)), ms));
