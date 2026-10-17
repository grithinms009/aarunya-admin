import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ValidationError, media, meta, products } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Switch } from '@/components/ui/controls';
import { PATH } from '@/components/ui/icons';
import { useViewport } from '@/hooks/useViewport';
import { inr, num, plural, slugify } from '@/lib/format';
import { skuFor } from '@/lib/sku';
import { useReference } from '@/hooks/useReference';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { AiPhotoStudio } from './AiPhotoStudio';
import { blankDraft, draftFrom, useDraft, type Draft } from './useDraft';
import s from './ProductEditor.module.css';
import type { Product } from '@/data/types';


export function ProductEditor() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { w } = useViewport();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { skuCodes, photoSlots } = useReference();
  const { data: loaded, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => products.get(id),
    enabled: !isNew,
  });

  const { draft, setDraft, patch, setField, setVariant, setImage, setSpec, errors, setErrors } =
    useDraft(null);
  const [descBusy, setDescBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studio, setStudio] = useState<{ vi: number; si: number } | null>(null);

  /** Build the editable copy once the product (or the config, for a new one) is in. */
  useEffect(() => {
    if (isNew) {
      if (config && categories.length && !draft) {
        setDraft(blankDraft(config, categories[0].slug));
      }
      return;
    }
    if (loaded && (!draft || draft.id !== loaded.id)) setDraft(draftFrom(loaded));
  }, [isNew, config, categories, loaded, draft, setDraft]);

  const missing = !isNew && !isLoading && !loaded;

  if (missing) {
    return (
      <>
        <PageHeader
          title="Product not found"
          sub="It may have been deleted."
          backTo="/products"
          backLabel="Products"
        />
        <div className={s.missing}>
          This product doesn’t exist any more. <Link to="/products">Back to products</Link>
        </div>
      </>
    );
  }

  /* A product must belong to a category, so without one there is nothing to fill in.
     Say that and link to the fix, rather than rendering an empty page. */
  if (isNew && config && categories.length === 0) {
    return (
      <>
        <PageHeader
          title="Add product"
          sub="One step first."
          backTo="/products"
          backLabel="Products"
        />
        <EmptyState
          title="Create a category first"
          body="Every product belongs to a category — it is how pieces are grouped in the shop menu and filters. Add one, then come back and add your product."
          action="/categories"
          actionLabel="Go to categories"
        />
      </>
    );
  }

  if (!draft || !config) return null;

  const cat = categories.find((c) => c.slug === draft.category);
  const subs = cat?.subs ?? [];
  const price = num(draft.price);
  const mrp = num(draft.mrp);
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const low = config.LOW_STOCK || 2;
  const usedColors = draft.variants.map((v) => v.color);
  const freeColors = Object.keys(colors).filter((k) => !usedColors.includes(k));
  const firstImg = draft.variants.find((v) => v.images.some(Boolean))?.images.find(Boolean) ?? '';
  const totalStock = draft.variants.reduce((t, v) => t + num(v.stock), 0);
  const twoCols = w >= 640 ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr';

  const seo = {
    title: draft.seoTitle || `${draft.name || 'Product name'} | Aarunya Jewels by Veena`,
    url: `aarunyajewels.in › product › ${draft.slug || 'product-url'}`,
    desc: (
      draft.seoDesc ||
      draft.description ||
      'Add a description to show here in search results.'
    ).slice(0, 160),
  };

  const asProduct = (): Product => ({
    ...draft,
    price: num(draft.price),
    mrp: num(draft.mrp) || num(draft.price),
    variants: draft.variants.map((v) => ({ ...v, stock: parseInt(v.stock, 10) || 0 })),
  });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await products.save(asProduct(), draft.isNew);
      setErrors({});
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['product', saved.id] });
      void qc.invalidateQueries({ queryKey: ['badges'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      flash(draft.isNew ? 'Product added' : 'Changes saved');
      if (draft.isNew) navigate(`/products/${saved.id}`, { replace: true });
      else setDraft(draftFrom(saved));
    } catch (e) {
      if (e instanceof ValidationError) {
        setErrors(e.fields);
        flash('Please fix the highlighted fields');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        flash(e instanceof Error ? e.message : 'Could not save');
      }
    } finally {
      setSaving(false);
    }
  };

  const writeDescription = async () => {
    if (!draft.name.trim()) {
      flash('Add the product name first');
      return;
    }
    setDescBusy(true);
    try {
      const text = await media.writeDescription({
        name: draft.name,
        category: cat?.name ?? 'jewellery',
        material: draft.material,
        colours: draft.variants.map((v) => colors[v.color]?.label ?? v.color),
      });
      patch({ description: text });
    } finally {
      setDescBusy(false);
    }
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>, vi: number, si: number) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(vi, si, await media.upload(file, 1000, 'product'));
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not read that image');
    }
  };

  const duplicate = async () => {
    const copy = await products.duplicate(draft.id);
    void qc.invalidateQueries({ queryKey: ['products'] });
    flash('Duplicated as a draft. Stock starts at 0.');
    navigate(`/products/${copy.id}`);
  };

  const remove = () =>
    ask({
      title: 'Delete this product?',
      text: `${draft.name} will be removed from the store. Past orders keep their details.`,
      ok: 'Delete product',
      run: async () => {
        await products.remove(draft.id);
        void qc.invalidateQueries({ queryKey: ['products'] });
        flash('Product deleted');
        navigate('/products');
      },
    });

  const err = (key: string) => errors[key] || '';

  return (
    <>
      <PageHeader
        title={draft.isNew ? 'Add product' : draft.name || 'Untitled product'}
        sub={
          draft.isNew
            ? 'Fill in the details, add photos for each colour, then save.'
            : `/product/${draft.slug}`
        }
        backTo="/products"
        backLabel="Products"
        actions={[
          ...(!draft.isNew && draft.status !== 'draft'
            ? [
                {
                  label: 'View on store',
                  href: `${import.meta.env.VITE_STORE_URL ?? 'http://localhost:5173'}/product/${draft.slug}`,
                },
              ]
            : []),
          {
            label: draft.isNew ? 'Save product' : 'Save changes',
            onClick: save,
            primary: true,
            disabled: saving,
          },
        ]}
      />

      <div
        className={s.grid}
        style={{ gridTemplateColumns: w >= 1180 ? 'minmax(0,1fr) 320px' : '1fr' }}
      >
        <div className={s.col}>
          <section className={s.section}>
            <h2 className={s.h2}>Product details</h2>

            <label className={f.label}>
              Product name
              <input
                value={draft.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Mango Mala Necklace"
                className={s.input}
                style={err('name') ? { borderColor: 'var(--red-line)' } : undefined}
              />
              {err('name') && (
                <span role="alert" className={f.error}>
                  {err('name')}
                </span>
              )}
            </label>

            <div className={s.two} style={{ gridTemplateColumns: twoCols }}>
              <label className={f.label}>
                Category
                <select
                  value={draft.category}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch({
                      category: v,
                      type: null,
                      exchange: !(config.nonEligible ?? []).includes(v),
                    });
                  }}
                  className={s.select}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={f.label}>
                Sub-category
                <select
                  value={draft.type ?? ''}
                  onChange={(e) => patch({ type: e.target.value || null })}
                  disabled={!subs.length}
                  className={s.select}
                >
                  <option value="">None</option>
                  {subs.map((x) => (
                    <option key={x.slug} value={x.slug}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className={f.label}>
              Page URL
              <span
                className={s.slugWrap}
                style={err('slug') ? { borderColor: 'var(--red-line)' } : undefined}
              >
                <span className={s.slugPrefix}>/product/</span>
                <input
                  value={draft.slug}
                  onChange={(e) => {
                    patch({ slug: slugify(e.target.value), slugTouched: true });
                    setErrors((x) => ({ ...x, slug: '' }));
                  }}
                  placeholder="created-from-the-name"
                  className={s.slugInput}
                />
              </span>
              {err('slug') && (
                <span role="alert" className={f.error}>
                  {err('slug')}
                </span>
              )}
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className={s.descHead}>
                <label htmlFor="pe-desc" className={s.descLabel}>
                  Description
                </label>
                <button
                  type="button"
                  onClick={writeDescription}
                  className={s.aiBtn}
                  style={{ opacity: descBusy ? 0.6 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                    <path d={PATH.sparkle} />
                  </svg>
                  {descBusy ? 'Writing…' : 'Write with AI'}
                </button>
              </div>
              <textarea
                id="pe-desc"
                rows={4}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="What it looks like, how it feels, when to wear it."
                className={s.textarea}
              />
            </div>

            <label className={f.label}>
              Material
              <input
                value={draft.material}
                onChange={(e) => patch({ material: e.target.value })}
                placeholder="e.g. Brass base with anti-tarnish gold plating"
                className={s.input}
                style={{ fontSize: 14 }}
              />
            </label>
          </section>

          <section className={s.sectionTight}>
            <h2 className={s.h2}>Pricing</h2>
            <div className={s.two} style={{ gridTemplateColumns: twoCols }}>
              <label className={f.label}>
                Selling price (₹)
                <input
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(e) => setField('price', e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className={s.num}
                  style={err('price') ? { borderColor: 'var(--red-line)' } : undefined}
                />
                {err('price') && (
                  <span role="alert" className={f.error}>
                    {err('price')}
                  </span>
                )}
              </label>
              <label className={f.label}>
                MRP (₹)
                <input
                  inputMode="numeric"
                  value={draft.mrp}
                  onChange={(e) => setField('mrp', e.target.value.replace(/\D/g, ''))}
                  placeholder="Same as price"
                  className={s.num}
                  style={err('mrp') ? { borderColor: 'var(--red-line)' } : undefined}
                />
                {err('mrp') && (
                  <span role="alert" className={f.error}>
                    {err('mrp')}
                  </span>
                )}
              </label>
            </div>
            <p className={s.note}>
              {off
                ? `Shows as “${off}% off” with the MRP struck through`
                : 'Set an MRP above the price to show a discount'}
              . Prices include all taxes.
            </p>
          </section>

          <section className={s.section}>
            <div className={s.intro}>
              <h2 className={s.h2}>Colours, stock and photos</h2>
              <p className={s.note}>
                Each colour has its own stock and three photos: front, on model and a close-up.
                Switching colour on the store swaps the photos.
              </p>
              {err('variants') && (
                <span role="alert" className={s.err}>
                  {err('variants')}
                </span>
              )}
            </div>

            {draft.variants.map((v, i) => {
              const c = colors[v.color] ?? { label: v.color, hex: '#CCCCCC', tint: '#EEE' };
              const st = num(v.stock);
              const filled = v.images.filter(Boolean).length;
              return (
                <div key={`${v.color}-${i}`} className={s.variant}>
                  <div className={s.variantHead}>
                    <span className={s.dot} style={{ background: c.hex }} />
                    <span className={s.variantNo}>Colour {i + 1}</span>
                    <select
                      aria-label="Colour"
                      value={v.color}
                      onChange={(e) => setVariant(i, { color: e.target.value })}
                      className={s.colorSelect}
                    >
                      {Object.keys(colors)
                        .filter((k) => k === v.color || !usedColors.includes(k))
                        .map((k) => (
                          <option key={k} value={k}>
                            {colors[k].label}
                          </option>
                        ))}
                    </select>
                    <span style={{ flex: 1 }} />
                    {draft.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          patch({ variants: draft.variants.filter((_, k) => k !== i) })
                        }
                        className={s.removeColor}
                      >
                        Remove colour
                      </button>
                    )}
                  </div>

                  <div className={s.two} style={{ gridTemplateColumns: twoCols }}>
                    <label className={f.label}>
                      SKU
                      <input
                        value={v.sku}
                        onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })}
                        placeholder={skuFor(draft, v.color, skuCodes)}
                        className={s.skuInput}
                      />
                    </label>

                    <div className={s.stockWrap}>
                      <span className={s.stockLabel}>Stock</span>
                      <div className={s.stockRow}>
                        <div className={s.stepper}>
                          <button
                            type="button"
                            aria-label="Decrease stock"
                            onClick={() => setVariant(i, { stock: String(Math.max(0, st - 1)) })}
                            className={s.stepBtn}
                          >
                            −
                          </button>
                          <input
                            aria-label="Stock"
                            inputMode="numeric"
                            value={v.stock}
                            onChange={(e) =>
                              setVariant(i, { stock: e.target.value.replace(/\D/g, '') })
                            }
                            placeholder="0"
                            className={s.stepInput}
                          />
                          <button
                            type="button"
                            aria-label="Increase stock"
                            onClick={() => setVariant(i, { stock: String(st + 1) })}
                            className={s.stepBtn}
                          >
                            +
                          </button>
                        </div>
                        {v.stock !== '' && st <= low && (
                          <span
                            style={{
                              fontSize: 12.5,
                              color: st === 0 ? 'var(--red)' : 'var(--gold-deep)',
                            }}
                          >
                            {st === 0 ? 'Sold out. Shown crossed out on the store.' : 'Low stock'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className={s.photosHead}>
                      <span className={s.stockLabel}>Photos</span>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                        {filled} of 3 photos
                      </span>
                    </div>
                    <div className={s.photosGrid}>
                      {photoSlots.map((label, si) => (
                        <div key={label} className={s.slot}>
                          <div className={s.frame}>
                            {v.images[si] ? (
                              <>
                                <div
                                  role="img"
                                  aria-label={`${label} photo`}
                                  className={s.photo}
                                  style={{ backgroundImage: `url("${v.images[si]}")` }}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${label} photo`}
                                  onClick={() => setImage(i, si, '')}
                                  className={s.clearPhoto}
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <div className={s.noPhoto}>
                                <svg
                                  width="22"
                                  height="22"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  style={{
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    strokeWidth: 1.5,
                                    strokeLinejoin: 'round',
                                  }}
                                >
                                  <path d={PATH.camera} />
                                  <circle cx="12" cy="12.5" r="3.5" />
                                </svg>
                                No photo
                              </div>
                            )}
                          </div>
                          <span className={s.slotLabel}>{label}</span>
                          <div className={s.slotBtns}>
                            <label className={s.upload}>
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => void pickFile(e, i, si)}
                                className={s.file}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setStudio({ vi: i, si })}
                              title="Generate with AI"
                              className={s.aiSmall}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                                <path d={PATH.sparkleSmall} />
                              </svg>
                              AI
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {freeColors.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    variants: [
                      ...draft.variants,
                      { id: '', color: freeColors[0], stock: '', sku: '', images: ['', '', ''] },
                    ],
                  })
                }
                className={s.addColour}
              >
                + Add another colour
              </button>
            )}
          </section>

          <section className={s.section}>
            <div className={s.intro}>
              <h2 className={s.h2}>Product page details</h2>
              <p className={s.note}>
                Extra specifications for the “Description &amp; Details” tab. Material, colours and
                category are added automatically.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draft.specs.map((sp, i) => (
                <div key={i} className={s.specRow}>
                  <input
                    aria-label="Specification name"
                    value={sp.k}
                    onChange={(e) => setSpec(i, { k: e.target.value })}
                    placeholder="e.g. Length"
                    className={s.specInput}
                  />
                  <input
                    aria-label="Specification value"
                    value={sp.v}
                    onChange={(e) => setSpec(i, { v: e.target.value })}
                    placeholder="e.g. 16 inches + 2 inch extender"
                    className={s.specInput}
                  />
                  <button
                    type="button"
                    aria-label="Remove specification"
                    onClick={() => patch({ specs: draft.specs.filter((_, k) => k !== i) })}
                    className={s.removeSpec}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch({ specs: [...draft.specs, { k: '', v: '' }] })}
                className={s.addSpec}
              >
                + Add specification
              </button>
            </div>

            <div className={s.toggleBlock}>
              <div className={s.toggleRow}>
                <span className={s.toggleText}>
                  <span className={s.toggleTitle}>Gift wrap available</span>
                  <span className={s.toggleSub}>
                    Shows the “Wrap it with love” option on this product.
                  </span>
                </span>
                <Switch
                  on={draft.giftWrap}
                  onChange={(v) => patch({ giftWrap: v })}
                  label="Gift wrap available"
                />
              </div>
              <div className={s.toggleRow}>
                <span className={s.toggleText}>
                  <span className={s.toggleTitle}>Eligible for exchange</span>
                  <span className={s.toggleSub}>
                    {(config.nonEligible ?? []).includes(draft.category)
                      ? 'Off by default for this category (hygiene rule).'
                      : `Customers can request an exchange within ${config.returnWindow} days.`}
                  </span>
                </span>
                <Switch
                  on={draft.exchange}
                  onChange={(v) => patch({ exchange: v })}
                  label="Eligible for exchange"
                />
              </div>
            </div>

            <p className={s.note}>Care, shipping and return notes are shared by every product page.</p>
          </section>

          <section className={s.sectionTight}>
            <h2 className={s.h2}>Search engine listing</h2>
            <div className={s.seoPreview}>
              <span className={s.seoUrl}>{seo.url}</span>
              <span className={s.seoTitle}>{seo.title}</span>
              <span className={s.seoDesc}>{seo.desc}</span>
            </div>
            <label className={f.label}>
              Page title
              <input
                value={draft.seoTitle}
                onChange={(e) => patch({ seoTitle: e.target.value })}
                placeholder={seo.title}
                className={s.skuInput}
              />
            </label>
            <label className={f.label}>
              <span className={s.counterLabel}>
                Meta description
                <span className={s.counter}>{draft.seoDesc.length}/160</span>
              </span>
              <textarea
                rows={2}
                maxLength={160}
                value={draft.seoDesc}
                onChange={(e) => patch({ seoDesc: e.target.value })}
                placeholder="Uses the product description if left empty"
                className={s.textarea}
              />
            </label>
          </section>
        </div>

        <aside className={s.aside} style={{ position: w >= 1180 ? 'sticky' : 'static' }}>
          <section className={s.card}>
            <h2 className={s.h2}>Status</h2>
            <div role="group" aria-label="Status" className={s.statusSeg}>
              {(['active', 'draft'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={(draft.status || 'active') === k}
                  onClick={() => patch({ status: k })}
                  className={`${s.statusBtn} ${
                    (draft.status || 'active') === k ? s.statusBtnOn : ''
                  }`}
                >
                  {k === 'active' ? 'Active' : 'Draft'}
                </button>
              ))}
            </div>
            <p className={s.note}>
              {draft.status === 'draft'
                ? 'Hidden from the store until you make it active.'
                : 'Visible on the store.'}
            </p>
          </section>

          <section className={s.card} style={{ gap: 14 }}>
            <h2 className={s.h2}>Home page</h2>
            <div className={s.toggleRow}>
              <span className={s.toggleText}>
                <span className={s.toggleTitle}>Best seller</span>
                <span className={s.toggleSub}>Shows in “Best Sellers”.</span>
              </span>
              <Switch
                on={draft.featured}
                onChange={(v) => patch({ featured: v })}
                label="Best seller"
              />
            </div>
            <div className={s.toggleRow}>
              <span className={s.toggleText}>
                <span className={s.toggleTitle}>New arrival</span>
                <span className={s.toggleSub}>
                  Adds the “New” badge and shows in “New Arrivals”.
                </span>
              </span>
              <Switch
                on={draft.isNew}
                onChange={(v) => patch({ isNew: v })}
                label="New arrival"
              />
            </div>
          </section>

          <section className={s.card} style={{ gap: 12 }}>
            <h2 className={s.h2}>Shop card preview</h2>
            <div className={s.preview}>
              <div
                className={s.previewImg}
                style={firstImg ? { backgroundImage: `url("${firstImg}")` } : undefined}
              >
                {!firstImg && <span className={s.previewHint}>add a photo</span>}
                {off > 0 && <span className={s.previewBadge}>{off}% off</span>}
              </div>
              <span className={s.previewName}>{draft.name || 'Product name'}</span>
              <span className={s.previewPrice}>
                <span style={{ fontWeight: 500 }}>{price ? inr(price) : '₹0'}</span>
                {off > 0 && <s className={s.strike}>{inr(mrp)}</s>}
              </span>
            </div>
          </section>

          <section className={s.card}>
            <span className={s.stockSum}>
              {totalStock} in stock across {plural(draft.variants.length, 'colour')}
            </span>
            <span className={s.note}>
              {draft.isNew ? 'Not saved yet' : `Added ${draft.createdAt} · ${draft.popularity} sold`}
            </span>
            <button type="button" onClick={save} disabled={saving} className={s.save}>
              {saving ? 'Saving…' : 'Save product'}
            </button>
            {!draft.isNew && (
              <div className={s.pairBtns}>
                <button type="button" onClick={duplicate} className={s.ghost}>
                  Duplicate
                </button>
                <button type="button" onClick={remove} className={s.danger}>
                  Delete
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      {studio && (
        <AiPhotoStudio
          draft={draft}
          vi={studio.vi}
          si={studio.si}
          colorLabel={(k) => colors[k]?.label ?? k}
          onUse={(si, url) => setImage(studio.vi, si, url)}
          onClose={() => setStudio(null)}
        />
      )}
    </>
  );
}

export type { Draft };
