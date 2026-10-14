import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meta, products, type ProductFlag } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip } from '@/components/ui/controls';
import { Icon, PATH } from '@/components/ui/icons';
import { STOCK_LOW, STOCK_OUT, type Badge } from '@/lib/badges';
import { downloadCsv } from '@/lib/csv';
import { inr, num, plural, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { useProductFilters, type ProductFilters } from './useProductFilters';
import s from './ProductsPage.module.css';
import type { Product } from '@/data/types';

const SORTS: [string, string][] = [
  ['new', 'Newest first'],
  ['popular', 'Best selling'],
  ['name', 'Name A–Z'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['stock', 'Stock: lowest first'],
];

const STOCKS: [string, string][] = [
  ['', 'Any stock'],
  ['in', 'In stock'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
];

const STATUSES: [string, string][] = [
  ['', 'Active & draft'],
  ['active', 'Active'],
  ['draft', 'Draft'],
];

const FLAGS: [ProductFlag, string][] = [
  ['featured', 'Best sellers'],
  ['new', 'New arrivals'],
  ['sale', 'On sale'],
  ['noimg', 'Missing photos'],
];

const ACTIVE_BADGE: Badge = { text: 'Active', fg: '#2F6B4F', bg: '#E3F0E8' };
const DRAFT_BADGE: Badge = { text: 'Draft', fg: '#4B5157', bg: '#EFF1F3' };

export function ProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);
  const filters = useProductFilters();

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { data } = useQuery({
    queryKey: ['products', filters],
    queryFn: () =>
      products.list({
        q: filters.q,
        cat: filters.cat,
        sub: filters.sub,
        color: filters.color,
        stock: filters.stock,
        status: filters.status,
        flags: filters.flags,
        sort: filters.sort,
      }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['products'] });
    void qc.invalidateQueries({ queryKey: ['badges'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const duplicate = useMutation({
    mutationFn: products.duplicate,
    onSuccess: (p) => {
      invalidate();
      flash('Duplicated as a draft. Stock starts at 0.');
      navigate(`/products/${p.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: products.remove,
    onSuccess: () => {
      invalidate();
      flash('Product deleted');
    },
  });

  const low = config?.LOW_STOCK ?? 2;
  const rows = data?.rows ?? [];
  const cat = categories.find((c) => c.slug === filters.cat);
  const subs = cat?.subs ?? [];
  const hasFilters = !!(
    filters.q ||
    filters.cat ||
    filters.sub ||
    filters.color ||
    filters.stock ||
    filters.status ||
    filters.flags.length
  );

  const exportCsv = () => {
    const head = [
      'ID', 'Name', 'URL', 'Category', 'Sub-category', 'Price', 'MRP', 'Colour', 'SKU',
      'Stock', 'Status', 'Best seller', 'New',
    ];
    const body = rows.flatMap((p) =>
      p.variants.map((v) => [
        p.id, p.name, p.slug, p.category, p.type ?? '', p.price, p.mrp,
        colors[v.color]?.label ?? v.color, v.sku, v.stock, p.status || 'active',
        p.featured ? 'yes' : '', p.isNew ? 'yes' : '',
      ]),
    );
    downloadCsv(`aarunya-products-${ymd()}.csv`, [head, ...body]);
    flash('CSV downloaded');
  };

  const totalOf = (p: Product) => p.variants.reduce((t, v) => t + num(v.stock), 0);

  return (
    <>
      <PageHeader
        title="Products"
        sub={`${plural(data?.total ?? 0, 'product')} · ${plural(
          rows.reduce((t, p) => t + p.variants.length, 0),
          'colour variant',
        )}`}
        actions={[
          { label: 'Export CSV', onClick: exportCsv },
          { label: 'Add product', to: '/products/new', primary: true },
        ]}
      />

      <div className={s.screen}>
        <div className={s.filters}>
          <div className={s.topRow}>
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search by name or SKU"
              value={filters.q}
              onChange={(e) => filters.set({ q: e.target.value })}
              className={`${f.input} ${s.search}`}
            />
            <select
              aria-label="Sort"
              value={filters.sort}
              onChange={(e) => filters.set({ sort: e.target.value as ProductFilters['sort'] })}
              className={`${f.select} ${s.sort}`}
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className={s.selectGrid}>
            <select
              aria-label="Category"
              value={filters.cat}
              onChange={(e) => filters.set({ cat: e.target.value, sub: '' })}
              className={f.select}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.short || c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sub-category"
              value={filters.sub}
              onChange={(e) => filters.set({ sub: e.target.value })}
              disabled={!subs.length}
              className={f.select}
            >
              <option value="">{subs.length ? 'All sub-categories' : 'Sub-category'}</option>
              {subs.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Colour"
              value={filters.color}
              onChange={(e) => filters.set({ color: e.target.value })}
              className={f.select}
            >
              <option value="">All colours</option>
              {Object.entries(colors).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Stock"
              value={filters.stock}
              onChange={(e) => filters.set({ stock: e.target.value as ProductFilters['stock'] })}
              className={f.select}
            >
              {STOCKS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Status"
              value={filters.status}
              onChange={(e) => filters.set({ status: e.target.value as ProductFilters['status'] })}
              className={f.select}
            >
              {STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className={s.chipRow}>
            {FLAGS.map(([k, label]) => (
              <Chip
                key={k}
                label={label}
                on={filters.flags.includes(k)}
                onClick={() => filters.toggleFlag(k)}
              />
            ))}
            <span style={{ flex: 1 }} />
            <span className={s.count}>
              {rows.length} of {data?.total ?? 0} products
            </span>
            {hasFilters && (
              <button type="button" onClick={filters.reset} className={s.clear}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className={s.tableCard}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 940 }}>
              <div className={s.head}>
                <span>Product</span>
                <span>Category</span>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span>Colours</span>
                <span>Stock</span>
                <span>Status</span>
                <span />
              </div>

              {rows.map((p) => {
                const c = categories.find((x) => x.slug === p.category);
                const sub = c && p.type ? c.subs.find((x) => x.slug === p.type)?.name : '';
                const total = totalOf(p);
                const outCount = p.variants.filter((v) => v.stock === 0).length;
                const anyLow = p.variants.some((v) => v.stock > 0 && v.stock <= low);
                const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
                const pill: Badge | null =
                  total === 0
                    ? STOCK_OUT
                    : outCount
                      ? {
                          text: `${outCount} colour${outCount > 1 ? 's' : ''} sold out`,
                          fg: '#7A5A1F',
                          bg: '#F7EEDC',
                        }
                      : anyLow
                        ? STOCK_LOW
                        : null;
                const img = p.variants.find((v) => v.images[0])?.images[0] ?? '';
                const status = p.status === 'draft' ? DRAFT_BADGE : ACTIVE_BADGE;
                const metaText = [
                  p.variants.length > 1
                    ? `${p.variants.length} colours`
                    : (p.variants[0]?.sku ?? ''),
                  p.featured ? 'Best seller' : '',
                  p.isNew ? 'New' : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div key={p.id} className={s.row}>
                    <Link to={`/products/${p.id}`} className={s.product}>
                      <span
                        className={s.thumb}
                        style={img ? { backgroundImage: `url("${img}")` } : undefined}
                      />
                      <span className={s.stack}>
                        <span className={s.name}>{p.name}</span>
                        <span className={s.meta}>{metaText}</span>
                      </span>
                    </Link>

                    <span className={s.catCell}>
                      <span>{c ? c.short || c.name : p.category}</span>
                      <span className={s.meta}>{sub || '—'}</span>
                    </span>

                    <span className={s.priceCell}>
                      <span className={s.price}>{inr(p.price)}</span>
                      {off > 0 && (
                        <span className={s.off}>
                          {off}% off {inr(p.mrp)}
                        </span>
                      )}
                    </span>

                    <span className={s.swatches}>
                      {p.variants.map((v) => (
                        <span
                          key={v.id}
                          title={`${colors[v.color]?.label ?? v.color}: ${v.stock} in stock`}
                          className={s.swatch}
                          style={{
                            background: colors[v.color]?.hex ?? '#CCCCCC',
                            opacity: v.stock ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </span>

                    <span className={s.stockCell}>
                      <span className={s.stockNum}>{total} in stock</span>
                      {pill && (
                        <span
                          className={s.smallPill}
                          style={{ background: pill.bg, color: pill.fg }}
                        >
                          {pill.text}
                        </span>
                      )}
                    </span>

                    <span>
                      <span
                        className={s.statusPill}
                        style={{ background: status.bg, color: status.fg }}
                      >
                        {status.text}
                      </span>
                    </span>

                    <span className={s.actions}>
                      <Link to={`/products/${p.id}`} className={s.edit}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => duplicate.mutate(p.id)}
                        title="Duplicate"
                        aria-label={`Duplicate ${p.name}`}
                        className={s.iconBtn}
                      >
                        <Icon d={PATH.duplicate} size={16} width={1.6} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ask({
                            title: 'Delete this product?',
                            text: `${p.name} will be removed from the store. Past orders keep their details.`,
                            ok: 'Delete product',
                            run: () => remove.mutate(p.id),
                          })
                        }
                        title="Delete"
                        aria-label={`Delete ${p.name}`}
                        className={`${s.iconBtn} ${s.danger}`}
                      >
                        <Icon d={PATH.trash} size={16} width={1.6} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {rows.length === 0 && <p className={s.empty}>No products match these filters.</p>}
        </div>
      </div>
    </>
  );
}