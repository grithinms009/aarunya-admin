/* Categories — GET/POST/DELETE /api/admin/categories plus PUT /categories/order. */
import { ApiError, req } from './client';
import type { Category, SubCategory } from '@/data/types';

export interface CategoryDraft {
  slug: string;
  name: string;
  short: string;
  tint: string;
  image: string;
  subs: SubCategory[];
  pairs: string[];
  isNew: boolean;
}

export class ConflictError extends Error {}

/** A refused delete or a duplicate name comes back as a conflict. */
const asConflict = (e: unknown): never => {
  if (e instanceof ApiError && (e.code === 'conflict' || e.status === 409)) {
    throw new ConflictError(e.message);
  }
  throw e;
};

export const categories = {
  list: () => req<Category[]>('/admin/categories'),

  /** Product counts per category and per sub-category, for the cards. */
  counts: () =>
    req<Record<string, { total: number; subs: Record<string, number> }>>(
      '/admin/categories/counts',
    ),

  save: (draft: CategoryDraft) =>
    req<Category>('/admin/categories', { method: 'POST', body: draft }).catch(asConflict),

  remove: async (slug: string): Promise<void> => {
    await req(`/admin/categories/${encodeURIComponent(slug)}`, { method: 'DELETE' })
      .catch(asConflict);
  },

  /** Shop menu order. */
  move: async (index: number, delta: number): Promise<void> => {
    await req('/admin/categories/order', { method: 'PUT', body: { index, delta } });
  },
};
