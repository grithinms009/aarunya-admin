/* Products. Becomes GET/POST/PUT/DELETE /api/admin/products plus
   POST /api/admin/products/{id}/duplicate. Filtering and sorting happen here because
   they will happen server-side, so the screen only renders what it is given. */
import { skuFor } from '@/lib/sku';
import { num, slugify, ymd } from '@/lib/format';
import { db, moveStock, mutate, reply } from './mock/store';
import type { Product, ProductStatus, Variant } from '@/data/types';

export type ProductSort = 'new' | 'popular' | 'name' | 'price-asc' | 'price-desc' | 'stock';
export type StockFilter = '' | 'in' | 'low' | 'out';
export type ProductFlag = 'featured' | 'new' | 'sale' | 'noimg';

export interface ProductQuery {
  q?: string;
  cat?: string;
  sub?: string;
  color?: string;
  stock?: StockFilter;
  status?: ProductStatus | '';
  flags?: ProductFlag[];
  sort?: ProductSort;
}

export interface ProductListResult {
  rows: Product[];
  /** Total before filtering, for the "N of M products" count. */
  total: number;
}

/** Thrown with field keys the editor highlights. */
export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Please fix the highlighted fields');
  }
}

const totalStock = (p: Product) => p.variants.reduce((t, v) => t + num(v.stock), 0);

export const products = {
  list(query: ProductQuery = {}): Promise<ProductListResult> {
    const d = db();
    const low = d.config.LOW_STOCK || 2;
    const q = (query.q ?? '').trim().toLowerCase();
    const flags = query.flags ?? [];

    const rows = d.products.filter((p) => {
      const t = totalStock(p);
      if (
        q &&
        !`${p.name} ${p.slug} ${p.variants.map((v) => v.sku).join(' ')}`.toLowerCase().includes(q)
      )
        return false;
      if (query.cat && p.category !== query.cat) return false;
      if (query.sub && p.type !== query.sub) return false;
      if (query.color && !p.variants.some((v) => v.color === query.color)) return false;
      if (query.status && (p.status || 'active') !== query.status) return false;
      if (query.stock === 'out' && t > 0) return false;
      if (query.stock === 'low' && !(t > 0 && p.variants.some((v) => v.stock <= low))) return false;
      if (query.stock === 'in' && t === 0) return false;
      if (flags.includes('featured') && !p.featured) return false;
      if (flags.includes('new') && !p.isNew) return false;
      if (flags.includes('sale') && !(p.mrp > p.price)) return false;
      if (flags.includes('noimg') && p.variants.every((v) => v.images.filter(Boolean).length >= 3))
        return false;
      return true;
    });

    const sorters: Record<ProductSort, (a: Product, b: Product) => number> = {
      new: (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
      name: (a, b) => a.name.localeCompare(b.name),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      stock: (a, b) => totalStock(a) - totalStock(b),
      popular: (a, b) => b.popularity - a.popularity,
    };

    return reply({
      rows: rows.slice().sort(sorters[query.sort ?? 'new']),
      total: d.products.length,
    });
  },

  get(id: string): Promise<Product | null> {
    return reply(db().products.find((p) => p.id === id) ?? null);
  },

  /** Create or replace. Validates exactly what the prototype's saveProduct did. */
  save(draft: Product, isNew: boolean): Promise<Product> {
    const d = db();
    const fields: Record<string, string> = {};
    const price = num(draft.price);
    const mrp = num(draft.mrp) || price;

    if (!draft.name.trim()) fields.name = 'Add a product name';
    if (!draft.category) fields.category = 'Choose a category';
    if (!(price > 0)) fields.price = 'Enter a selling price';
    if (mrp < price) fields.mrp = 'MRP can’t be lower than the selling price';

    const colors = draft.variants.map((v) => v.color);
    if (!draft.variants.length) fields.variants = 'Add at least one colour';
    else if (new Set(colors).size !== colors.length)
      fields.variants = 'Each colour can only be added once';

    const slug = slugify(draft.slug || draft.name).replace(/^-+|-+$/g, '');
    if (d.products.some((p) => p.slug === slug && p.id !== draft.id))
      fields.slug = 'Another product already uses this URL';

    if (Object.keys(fields).length) return Promise.reject(new ValidationError(fields));

    const prod: Product = {
      ...draft,
      slug,
      name: draft.name.trim(),
      price,
      mrp,
      type: draft.type || null,
      specs: (draft.specs ?? []).filter((x) => x.k.trim() && x.v.trim()),
      variants: draft.variants.map(
        (v): Variant => ({
          ...v,
          id: `${draft.id}-${v.color}`,
          stock: Math.max(0, parseInt(String(v.stock), 10) || 0),
          sku: (v.sku || '').trim() || skuFor(draft, v.color),
          images: v.images.filter(Boolean),
        }),
      ),
    };

    return reply(
      mutate((dd) => {
        if (isNew) {
          dd.products.unshift(prod);
          /* Opening stock is a stock movement, so it gets a ledger row. */
          prod.variants.forEach((v) => {
            if (v.stock) moveStock(dd, v.id, v.stock, 'adjust', '', 'Opening stock');
          });
        } else {
          const i = dd.products.findIndex((p) => p.id === prod.id);
          const old = dd.products[i];
          dd.products[i] = prod;
          prod.variants.forEach((v) => {
            const ov = old.variants.find((x) => x.id === v.id);
            const delta = v.stock - (ov ? ov.stock : 0);
            if (delta) moveStock(dd, v.id, delta, 'adjust', '', 'Edited in product form');
          });
        }
        return prod;
      }),
    );
  },

  /** Duplicates as a draft with zero stock, as the prototype does. */
  duplicate(id: string): Promise<Product> {
    const src = db().products.find((p) => p.id === id);
    if (!src) return Promise.reject(new Error('Product not found'));
    const nid = 'p' + Date.now().toString(36);
    const copy: Product = {
      ...structuredClone(src),
      id: nid,
      name: src.name + ' (copy)',
      slug: `${src.slug}-copy-${nid.slice(-3)}`,
      status: 'draft',
      popularity: 0,
      createdAt: ymd(),
      variants: src.variants.map((v) => ({
        ...structuredClone(v),
        id: `${nid}-${v.color}`,
        stock: 0,
        sku: '',
      })),
    };
    copy.variants.forEach((v) => {
      v.sku = skuFor(copy, v.color) + '-C';
    });
    return reply(
      mutate((dd) => {
        dd.products.unshift(copy);
        return copy;
      }),
    );
  },

  /** Past orders keep their own item snapshots, so deleting never rewrites history. */
  remove(id: string): Promise<void> {
    return reply(
      mutate((dd) => {
        dd.products = dd.products.filter((p) => p.id !== id);
      }),
    );
  },
};
