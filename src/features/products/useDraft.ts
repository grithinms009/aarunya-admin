import { useCallback, useState } from 'react';
import { slugify, ymd } from '@/lib/format';
import type { Config, Product, Spec, Variant } from '@/data/types';

/** Editable copy of a product: numbers are kept as strings while typing, and every
 *  variant always has three photo slots, as the prototype's makeDraft did. */
export interface Draft extends Omit<Product, 'price' | 'mrp' | 'variants'> {
  price: string;
  mrp: string;
  variants: (Omit<Variant, 'stock'> & { stock: string })[];
  /** Stops the slug following the name once it has been edited by hand. */
  slugTouched: boolean;
  isNew: boolean;
}

const threeSlots = (images: string[]) => [0, 1, 2].map((i) => images[i] ?? '');

export const draftFrom = (p: Product): Draft => ({
  ...structuredClone(p),
  price: String(p.price),
  mrp: String(p.mrp || ''),
  variants: p.variants.map((v) => ({ ...v, stock: String(v.stock), images: threeSlots(v.images) })),
  slugTouched: true,
  isNew: false,
});

export const blankDraft = (config: Config, firstCategory: string): Draft => ({
  id: 'p' + Date.now().toString(36),
  slug: '',
  name: '',
  category: firstCategory,
  type: null,
  popularity: 0,
  price: '',
  mrp: '',
  featured: false,
  isNew: true,
  createdAt: ymd(),
  rating: null,
  reviewCount: 0,
  description: '',
  material: '',
  status: 'active',
  giftWrap: true,
  exchange: !(config.nonEligible ?? []).includes(firstCategory),
  seoTitle: '',
  seoDesc: '',
  specs: [{ k: 'Finish', v: 'Anti-tarnish, nickel-free' }],
  variants: [{ id: '', color: 'gold', stock: '', sku: '', images: ['', '', ''] }],
  slugTouched: false,
});

/** Draft state plus the field-level setters the editor needs. */
export function useDraft(initial: Draft | null) {
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patch = useCallback((p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }, []);

  const clearError = useCallback((key: string) => {
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  }, []);

  const setField = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => {
      setDraft((d) => {
        if (!d) return d;
        const next = { ...d, [key]: value } as Draft;
        /* The slug follows the name until the URL field is touched. */
        if (key === 'name' && !d.slugTouched) next.slug = slugify(String(value));
        return next;
      });
      clearError(String(key));
    },
    [clearError],
  );

  const setVariant = useCallback(
    (i: number, p: Partial<Draft['variants'][number]>) => {
      setDraft((d) =>
        d ? { ...d, variants: d.variants.map((v, k) => (k === i ? { ...v, ...p } : v)) } : d,
      );
      clearError('variants');
    },
    [clearError],
  );

  const setImage = useCallback((vi: number, si: number, url: string) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            variants: d.variants.map((v, k) =>
              k === vi ? { ...v, images: v.images.map((u, j) => (j === si ? url : u)) } : v,
            ),
          }
        : d,
    );
  }, []);

  const setSpec = useCallback((i: number, p: Partial<Spec>) => {
    setDraft((d) =>
      d ? { ...d, specs: d.specs.map((x, k) => (k === i ? { ...x, ...p } : x)) } : d,
    );
  }, []);

  return { draft, setDraft, patch, setField, setVariant, setImage, setSpec, errors, setErrors };
}
