/* Products — GET/POST/PUT/DELETE /api/admin/products plus /{id}/duplicate.
   Filtering and sorting happen on the server; the screen renders what it is given. */
import { ApiError, download, req } from './client';
import type { Product, ProductStatus } from '@/data/types';

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

/** The server is the authority on these rules; its field errors drive the editor. */
const asValidation = (e: unknown): never => {
  if (e instanceof ApiError && e.fields) throw new ValidationError(e.fields);
  throw e;
};

const asQuery = (q: ProductQuery) => ({ ...q, flags: q.flags });

export const products = {
  list: (query: ProductQuery = {}) =>
    req<ProductListResult>('/admin/products', { query: asQuery(query) }),

  get: (id: string) =>
    req<Product | null>(`/admin/products/${encodeURIComponent(id)}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),

  save: (draft: Product, isNew: boolean) =>
    (isNew
      ? req<Product>('/admin/products', { method: 'POST', body: draft })
      : req<Product>(`/admin/products/${encodeURIComponent(draft.id)}`, {
          method: 'PUT',
          body: draft,
        })
    ).catch(asValidation),

  duplicate: (id: string) =>
    req<Product>(`/admin/products/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }),

  remove: async (id: string): Promise<void> => {
    await req(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  exportCsv: (query: ProductQuery = {}) =>
    download('/admin/products/export.csv', asQuery(query), 'aarunya-products.csv'),
};
