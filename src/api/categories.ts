/* Categories. Becomes GET/POST/PUT/DELETE /api/admin/categories plus
   PUT /api/admin/categories/order. */
import { slugify } from '@/lib/format';
import { db, mutate, reply } from './mock/store';
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

export const categories = {
  list: (): Promise<Category[]> => reply(db().categories),

  /** Product counts per category and per sub-category, for the cards. */
  counts: (): Promise<Record<string, { total: number; subs: Record<string, number> }>> => {
    const d = db();
    const out: Record<string, { total: number; subs: Record<string, number> }> = {};
    d.categories.forEach((c) => {
      const ps = d.products.filter((p) => p.category === c.slug);
      out[c.slug] = {
        total: ps.length,
        subs: Object.fromEntries(
          (c.subs ?? []).map((sb) => [sb.slug, ps.filter((p) => p.type === sb.slug).length]),
        ),
      };
    });
    return reply(out);
  },

  save(draft: CategoryDraft): Promise<Category> {
    const d = db();
    const name = draft.name.trim();
    if (!name) return Promise.reject(new ConflictError('Add a category name'));

    const short = (draft.short || '').trim() || name.replace(/^Anti-Tarnish\s+/i, '');
    const slug = draft.isNew ? slugify(short) : draft.slug;
    if (draft.isNew && d.categories.some((c) => c.slug === slug)) {
      return Promise.reject(new ConflictError('A category with this name already exists'));
    }

    /* Keep sub-category slugs unique and stable, so products keep their type. */
    const seen = new Set<string>();
    const subs: SubCategory[] = draft.subs
      .filter((x) => x.name.trim())
      .map((x) => {
        let sl = x.slug || slugify(x.name);
        while (seen.has(sl)) sl += '-2';
        seen.add(sl);
        return { slug: sl, name: x.name.trim() };
      });

    return reply(
      mutate((dd) => {
        const old = dd.categories.find((c) => c.slug === slug);
        const next: Category = {
          slug,
          name,
          short,
          tint: draft.tint,
          image: draft.image,
          subs,
          pairs: draft.pairs,
          ph: old?.ph ?? short.toLowerCase(),
        };
        if (draft.isNew) dd.categories.push(next);
        else {
          dd.categories = dd.categories.map((c) => (c.slug === slug ? next : c));
          /* A product pointing at a removed sub-category falls back to none. */
          dd.products.forEach((p) => {
            if (p.category === slug && p.type && !subs.some((x) => x.slug === p.type)) {
              p.type = null;
            }
          });
        }
        return next;
      }),
    );
  },

  /** Refused while the category still holds products. */
  remove(slug: string): Promise<void> {
    const n = db().products.filter((p) => p.category === slug).length;
    if (n) {
      return Promise.reject(
        new ConflictError(
          `Move or delete the ${n} product${n === 1 ? '' : 's'} in this category first`,
        ),
      );
    }
    return reply(
      mutate((dd) => {
        dd.categories = dd.categories.filter((c) => c.slug !== slug);
        /* Drop it from every other category's "Pair it up" list too. */
        dd.categories.forEach((c) => {
          c.pairs = (c.pairs ?? []).filter((x) => x !== slug);
        });
      }),
    );
  },

  /** Shop menu order. */
  move(index: number, delta: number): Promise<void> {
    return reply(
      mutate((dd) => {
        const a = dd.categories;
        const j = index + delta;
        if (j < 0 || j >= a.length) return;
        [a[index], a[j]] = [a[j], a[index]];
      }),
    );
  },
};
