import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ConflictError, categories } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, PATH } from '@/components/ui/icons';
import { useViewport } from '@/hooks/useViewport';
import { plural } from '@/lib/format';
import { useUi } from '@/store/useUi';
import { useProductFilters, BLANK_PRODUCT_FILTERS } from '@/features/products/useProductFilters';
import { CategoryModal, useCategoryData } from './CategoryModal';
import s from './CategoriesPage.module.css';
import type { Category } from '@/data/types';

export function CategoriesPage() {
  const { w } = useViewport();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);
  const setProductFilters = useProductFilters((st) => st.set);
  const { categories: rows, counts } = useCategoryData();

  /** undefined = closed, null = adding, Category = editing. */
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] });
    void qc.invalidateQueries({ queryKey: ['category-counts'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };

  const move = async (i: number, delta: number) => {
    await categories.move(i, delta);
    refresh();
    flash('Menu order updated');
  };

  const remove = (c: Category) =>
    ask({
      title: 'Delete this category?',
      text: 'It will be removed from the shop menu and filters.',
      ok: 'Delete category',
      run: async () => {
        try {
          await categories.remove(c.slug);
          refresh();
          flash('Category deleted');
        } catch (e) {
          flash(e instanceof ConflictError ? e.message : 'Could not delete the category');
        }
      },
    });

  const openProducts = (c: Category) => {
    setProductFilters({ ...BLANK_PRODUCT_FILTERS, cat: c.slug });
    navigate('/products');
  };

  const cols =
    w >= 1100 ? 'minmax(280px,1.3fr) minmax(0,1.4fr) minmax(0,.9fr) auto' : '1fr';

  return (
    <>
      <PageHeader
        title="Categories"
        sub="Shown in the shop menu, filters and “Pair it up” suggestions."
        actions={[{ label: 'Add category', onClick: () => setEditing(null), primary: true }]}
      />

      <div className={s.screen}>
        {rows.map((c, i) => {
          const count = counts[c.slug];
          return (
            <div key={c.slug} className={s.card} style={{ gridTemplateColumns: cols }}>
              <div className={s.head}>
                <div className={s.arrows}>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => void move(i, -1)}
                    className={s.arrow}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === rows.length - 1}
                    onClick={() => void move(i, 1)}
                    className={s.arrow}
                  >
                    ▼
                  </button>
                </div>
                <span
                  className={s.avatar}
                  style={{
                    backgroundColor: c.tint,
                    boxShadow: `0 0 0 3px ${c.tint}`,
                    ...(c.image ? { backgroundImage: `url("${c.image}")` } : null),
                  }}
                />
                <span className={s.titleStack}>
                  <span className={s.name}>{c.name}</span>
                  <span className={s.meta}>
                    Menu name: {c.short} · /{c.slug}
                  </span>
                  <span className={s.meta}>{plural(count?.total ?? 0, 'product')}</span>
                </span>
              </div>

              <div className={s.subs}>
                {(c.subs ?? []).map((sb) => (
                  <span key={sb.slug} className={s.sub}>
                    {sb.name}
                    <span className={s.subCount}>{count?.subs[sb.slug] ?? 0}</span>
                  </span>
                ))}
                {!(c.subs ?? []).length && <span className={s.noSubs}>No sub-categories</span>}
              </div>

              <div className={s.pairs}>
                <span className={s.pairsLabel}>Pair it up with</span>
                <span className={s.pairsValue}>
                  {(c.pairs ?? [])
                    .map((k) => rows.find((x) => x.slug === k)?.short)
                    .filter(Boolean)
                    .join(', ') || 'Not set'}
                </span>
              </div>

              <div className={s.actions}>
                <button type="button" onClick={() => openProducts(c)} className={s.btn}>
                  Products
                </button>
                <button type="button" onClick={() => setEditing(c)} className={s.edit}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  aria-label={`Delete ${c.name}`}
                  className={s.iconBtn}
                >
                  <Icon d={PATH.trashSmall} size={15} width={1.6} />
                </button>
              </div>
            </div>
          );
        })}

        {rows.length > 1 && (
          <p className={s.hint}>
            Use the arrows to change the order categories appear in the shop menu.
          </p>
        )}
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="No categories yet"
          body="Categories group your pieces in the shop menu and filters. Add one before you add products."
          onAction={() => setEditing(null)}
          actionLabel="Add category"
        />
      )}

      {editing !== undefined && (
        <CategoryModal
          category={editing}
          all={rows}
          counts={counts}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            refresh();
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
}
