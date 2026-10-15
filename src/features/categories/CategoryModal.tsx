import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ConflictError, categories, media } from '@/api';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/controls';
import { slugify } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import m from '@/components/ui/Modal.module.css';
import s from './CategoriesPage.module.css';
import type { Category } from '@/data/types';
import { useReference } from '@/hooks/useReference';

/** The five background tints offered for a category card. */

interface Props {
  /** null means "add a new category". */
  category: Category | null;
  all: Category[];
  counts: Record<string, { total: number; subs: Record<string, number> }>;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryModal({ category, all, counts, onClose, onSaved }: Props) {
  const { categoryTints } = useReference();
  const isNew = !category;
  const flash = useUi((st) => st.flash);

  const [name, setName] = useState(category?.name ?? '');
  const [short, setShort] = useState(category?.short ?? '');
  const [tint, setTint] = useState(category?.tint ?? '');
  /* A new category takes the first tint until one is picked. */
  const activeTint = tint || categoryTints[0] || '';
  const [image, setImage] = useState(category?.image ?? '');
  const [subs, setSubs] = useState(structuredClone(category?.subs ?? []));
  const [pairs, setPairs] = useState<string[]>([...(category?.pairs ?? [])]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const url =
    '/shop/' +
    (isNew
      ? slugify(short || name.replace(/^Anti-Tarnish\s+/i, '')) || 'category'
      : category!.slug);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await media.upload(file, 800));
    } catch (e2) {
      flash(e2 instanceof Error ? e2.message : 'Could not read that image');
    }
  };

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await categories.save({
        slug: category?.slug ?? '',
        name,
        short,
        tint: activeTint,
        image,
        subs,
        pairs,
        isNew,
      });
      flash(isNew ? 'Category added' : 'Category saved');
      onSaved();
    } catch (e2) {
      if (e2 instanceof ConflictError) setErr(e2.message);
      else flash('Could not save the category');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Add category' : 'Edit category'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={m.cancel}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className={m.confirm}>
            {isNew ? 'Add category' : 'Save category'}
          </button>
        </>
      }
    >
      <div className={s.two} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <label className={f.label}>
          Full name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr('');
            }}
            placeholder="e.g. Anti-Tarnish Anklets"
            className={f.input}
          />
        </label>
        <label className={f.label}>
          Menu name
          <input
            value={short}
            onChange={(e) => setShort(e.target.value)}
            placeholder="e.g. Anklets"
            className={f.input}
          />
        </label>
      </div>

      <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Link: {url}</span>

      <div className={s.imageRow}>
        <div
          className={s.imagePreview}
          style={image ? { backgroundImage: `url("${image}")` } : undefined}
        />
        <div className={s.imageSide}>
          <span className={m.fieldLabel}>Category image</span>
          <span className={s.note}>
            Shown in “Shop by category”. Uses the first product photo if empty.
          </span>
          <div className={s.fileRow}>
            <label className={s.upload}>
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void upload(e)}
                className={s.file}
              />
            </label>
            {image && (
              <button type="button" onClick={() => setImage('')} className={s.removeImg}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={m.group}>
        <span className={m.fieldLabel}>Background tint</span>
        <div className={s.tints}>
          {categoryTints.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Tint ${hex}`}
              aria-pressed={activeTint === hex}
              onClick={() => setTint(hex)}
              className={s.tint}
              style={{
                background: hex,
                boxShadow: `0 0 0 2px ${activeTint === hex ? 'var(--ink)' : 'rgba(16,24,40,.12)'}`,
              }}
            />
          ))}
        </div>
      </div>

      <div className={m.group}>
        <span className={m.fieldLabel}>Sub-categories</span>
        {subs.map((sb, i) => (
          <div key={i} className={s.subRow}>
            <input
              aria-label="Sub-category name"
              value={sb.name}
              onChange={(e) =>
                setSubs(subs.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))
              }
              placeholder="e.g. Chokers"
              className={s.subInput}
            />
            <span className={s.subNum}>
              {sb.slug && category
                ? `${counts[category.slug]?.subs[sb.slug] ?? 0} products`
                : 'New'}
            </span>
            <button
              type="button"
              aria-label="Remove sub-category"
              onClick={() => setSubs(subs.filter((_, k) => k !== i))}
              className={s.removeSub}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSubs([...subs, { slug: '', name: '' }])}
          className={s.addSub}
        >
          + Add sub-category
        </button>
      </div>

      <div className={m.group}>
        <span className={m.fieldLabel}>“Pair it up” suggests</span>
        <div className={s.chipWrap}>
          {all
            .filter((c) => c.slug !== category?.slug)
            .map((c) => (
              <Chip
                key={c.slug}
                label={c.short || c.name}
                on={pairs.includes(c.slug)}
                onClick={() =>
                  setPairs(
                    pairs.includes(c.slug)
                      ? pairs.filter((x) => x !== c.slug)
                      : [...pairs, c.slug],
                  )
                }
              />
            ))}
        </div>
      </div>

      {err && (
        <p role="alert" className={m.error}>
          {err}
        </p>
      )}
    </Modal>
  );
}

/** Convenience wrapper so the page can mount the modal without prefetching. */
export function useCategoryData() {
  const list = useQuery({ queryKey: ['categories'], queryFn: categories.list });
  const counts = useQuery({ queryKey: ['category-counts'], queryFn: categories.counts });
  return { categories: list.data ?? [], counts: counts.data ?? {} };
}
