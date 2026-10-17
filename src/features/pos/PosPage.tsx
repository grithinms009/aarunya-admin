import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RuleError, meta, orders, products } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useReference } from '@/hooks/useReference';
import { useViewport } from '@/hooks/useViewport';
import { fDT, inr, num, plural, waLink, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import { useOrderFilters, BLANK_ORDER_FILTERS } from '@/features/orders/useOrderFilters';
import f from '@/styles/form.module.css';
import s from './PosPage.module.css';
import type { Order, Product, Variant } from '@/data/types';


interface BillLine {
  pid: string;
  vid: string;
  name: string;
  color: string;
  sku: string;
  img: string;
  qty: number;
  /** Editable unit price, kept as a string while typing. */
  price: string;
  /** The product's list price, so a changed price can be flagged. */
  list: number;
  max: number;
}

export function PosPage() {
  const { payModes } = useReference();
  const { w } = useViewport();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const setOrderFilters = useOrderFilters((st) => st.set);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { data: recent = [] } = useQuery({
    queryKey: ['offline-recent'],
    queryFn: () => orders.recentOffline(5),
  });

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const { data: list } = useQuery({
    queryKey: ['pos-products', q, cat],
    queryFn: () => products.list({ q, cat, sort: 'name' }),
  });

  const [lines, setLines] = useState<BillLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [dtype, setDtype] = useState<'flat' | 'pct'>('flat');
  const [mode, setMode] = useState('UPI');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(ymd());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  /* Default the place to the first one in settings. */
  useEffect(() => {
    if (config && !location) setLocation((config.locations ?? [])[0] ?? '');
  }, [config, location]);

  const colorLabel = (k: string) => colors[k]?.label ?? k;
  const colorHex = (k: string) => colors[k]?.hex ?? '#CCCCCC';

  const subtotal = lines.reduce((t, l) => t + num(l.price) * l.qty, 0);
  const discountValue = Math.min(
    subtotal,
    dtype === 'pct' ? Math.round((subtotal * Math.min(num(discount), 100)) / 100) : num(discount),
  );
  const total = subtotal - discountValue;
  const units = lines.reduce((t, l) => t + l.qty, 0);

  const addLine = (p: Product, v: Variant) => {
    const existing = lines.find((l) => l.vid === v.id);
    const inBill = existing?.qty ?? 0;
    if (v.stock - inBill <= 0) {
      flash(
        v.stock
          ? `All ${v.stock} in stock are already in the bill`
          : 'This colour is out of stock',
      );
      return;
    }
    setDone(null);
    if (existing) {
      setLines(lines.map((l) => (l.vid === v.id ? { ...l, qty: l.qty + 1 } : l)));
      return;
    }
    setLines([
      ...lines,
      {
        pid: p.id,
        vid: v.id,
        name: p.name,
        color: v.color,
        sku: v.sku,
        img: v.images[0] || '',
        qty: 1,
        price: String(p.price),
        list: p.price,
        max: v.stock,
      },
    ]);
  };

  const setLine = (i: number, patch: Partial<BillLine>) =>
    setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const record = async () => {
    setBusy(true);
    try {
      const order = await orders.recordOfflineSale({
        lines: lines.map((l) => ({
          pid: l.pid,
          vid: l.vid,
          name: l.name,
          color: l.color,
          sku: l.sku,
          img: l.img,
          qty: l.qty,
          price: num(l.price),
        })),
        discount: discountValue,
        method: mode,
        location,
        date,
        name,
        phone,
        note,
      });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['offline-recent'] });
      void qc.invalidateQueries({ queryKey: ['pos-products'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['inventory-stock'] });
      void qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
      void qc.invalidateQueries({ queryKey: ['badges'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      flash(`Sale ${order.id} recorded. Stock updated.`);
      setDone(order);
      setLines([]);
      setDiscount('');
      setName('');
      setPhone('');
      setNote('');
      setDate(ymd());
    } catch (e) {
      flash(e instanceof RuleError ? e.message : 'Could not record the sale');
    } finally {
      setBusy(false);
    }
  };

  const receipt = done
    ? `Thank you for shopping with Aarunya Jewels by Veena.\nReceipt ${done.id}\n${done.items
        .map((l) => `${l.name} (${colorLabel(l.color)}) x${l.qty}: ${inr(l.price * l.qty)}`)
        .join('\n')}${done.discount ? `\nDiscount: −${inr(done.discount)}` : ''}\nTotal: ${inr(
        done.total,
      )} (${done.payment.method})`
    : '';

  const results = list?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Offline sale"
        sub="Record a sale made in person. Stock updates as soon as you save."
        actions={[
          {
            label: 'View offline sales',
            onClick: () => {
              setOrderFilters({ ...BLANK_ORDER_FILTERS, ch: 'offline' });
              navigate('/orders');
            },
          },
        ]}
      />

      <div
        className={s.grid}
        style={{
          gridTemplateColumns: w >= 1100 ? 'minmax(0,1.2fr) minmax(340px,1fr)' : '1fr',
        }}
      >
        <section className={s.card}>
          <div className={s.pickerHead}>
            <h2 className={s.h2}>Pick the pieces sold</h2>
            <div className={s.searchRow}>
              <input
                type="search"
                aria-label="Search products"
                placeholder="Search name or SKU"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${f.input} ${s.search}`}
              />
              <select
                aria-label="Category"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className={`${f.select} ${s.cat}`}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.short || c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {results.slice(0, 30).map((p) => {
              const img = p.variants.find((v) => v.images[0])?.images[0] ?? '';
              return (
                <div key={p.id} className={s.result}>
                  <span
                    className={s.thumb56}
                    style={img ? { backgroundImage: `url("${img}")` } : undefined}
                  />
                  <div className={s.resultBody}>
                    <div className={s.resultTop}>
                      <span className={s.resultName}>{p.name}</span>
                      <span className={s.num}>{inr(p.price)}</span>
                    </div>
                    <div className={s.variants}>
                      {p.variants.map((v) => {
                        const inBill = lines.find((l) => l.vid === v.id)?.qty ?? 0;
                        const left = v.stock - inBill;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            aria-label={`Add ${p.name}, ${colorLabel(v.color)}`}
                            disabled={left <= 0}
                            onClick={() => addLine(p, v)}
                            className={s.variant}
                          >
                            <span className={s.dot16} style={{ background: colorHex(v.color) }} />
                            {colorLabel(v.color)}
                            <span className={s.left}>
                              {v.stock === 0 ? 'Sold out' : `${left} left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            {results.length === 0 && (
              (list?.total ?? 0) === 0 ? (
                <EmptyState
                  title="Nothing to sell yet"
                  body="Add a product with at least one colour and it becomes available here for in-person sales."
                  action="/products/new"
                  actionLabel="Add product"
                />
              ) : (
                <EmptyState
                  title="No pieces match that search"
                  body="Try another name or SKU, or choose a different category."
                />
              )
            )}
          </div>
        </section>

        <div className={s.side} style={{ position: w >= 1100 ? 'sticky' : 'static' }}>
          {done && (
            <section className={s.done}>
              <span className={s.doneTitle}>
                <span aria-hidden="true" className={s.tick}>
                  ✓
                </span>
                Sale {done.id} recorded
              </span>
              <span className={s.doneSub}>
                {inr(done.total)} paid by {done.payment.method}. Stock has been reduced.
              </span>
              <div className={s.doneRow}>
                {done.customer.phone && (
                  <a
                    href={waLink(done.customer.phone, receipt)}
                    target="_blank"
                    rel="noopener"
                    className={s.doneWa}
                  >
                    Send receipt on WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${done.id}`)}
                  className={s.doneView}
                >
                  View sale
                </button>
                <button type="button" onClick={() => setDone(null)} className={s.doneClose}>
                  Close
                </button>
              </div>
            </section>
          )}

          <section className={s.bill}>
            <div className={s.billHead}>
              <h2 className={s.h2}>Bill</h2>
              <span className={s.billCount}>
                <span className={s.countText}>{plural(units, 'item')}</span>
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLines([]);
                      setDiscount('');
                    }}
                    className={s.clear}
                  >
                    Clear
                  </button>
                )}
              </span>
            </div>

            {lines.length === 0 && (
              <p className={s.billEmpty}>Tap a colour on the left to add it to the bill.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lines.map((l, i) => (
                <div key={l.vid} className={s.line}>
                  <span
                    className={s.thumb44}
                    style={l.img ? { backgroundImage: `url("${l.img}")` } : undefined}
                  />
                  <span className={s.lineText}>
                    <span className={s.lineName}>{l.name}</span>
                    <span className={s.lineColor}>
                      <span className={s.dot10} style={{ background: colorHex(l.color) }} />
                      {colorLabel(l.color)}
                    </span>
                  </span>
                  <span className={s.lineTotal}>{inr(num(l.price) * l.qty)}</span>
                  <span />
                  <span className={s.lineControls}>
                    <span className={s.qty}>
                      <button
                        type="button"
                        aria-label="Decrease"
                        onClick={() =>
                          l.qty > 1
                            ? setLine(i, { qty: l.qty - 1 })
                            : setLines(lines.filter((_, k) => k !== i))
                        }
                        className={s.qtyBtn}
                      >
                        −
                      </button>
                      <span className={s.qtyValue}>{l.qty}</span>
                      <button
                        type="button"
                        aria-label="Increase"
                        onClick={() =>
                          l.qty < l.max
                            ? setLine(i, { qty: l.qty + 1 })
                            : flash(`Only ${l.max} in stock`)
                        }
                        className={s.qtyBtn}
                      >
                        +
                      </button>
                    </span>
                    <label className={s.priceBox}>
                      <span className={s.rupee}>₹</span>
                      <input
                        aria-label="Unit price"
                        inputMode="numeric"
                        value={l.price}
                        onChange={(e) =>
                          setLine(i, { price: e.target.value.replace(/\D/g, '') })
                        }
                        className={s.priceInput}
                      />
                    </label>
                    {num(l.price) !== l.list && (
                      <span className={s.listPrice}>List price {inr(l.list)}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${l.name}`}
                    onClick={() => setLines(lines.filter((_, k) => k !== i))}
                    className={s.removeLine}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className={s.foot}>
              <div className={s.discountRow}>
                <span className={s.discountLabel}>Discount</span>
                <div role="group" aria-label="Discount type" className={s.dtypes}>
                  {(
                    [
                      ['flat', '₹ off'],
                      ['pct', '% off'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={dtype === k}
                      onClick={() => setDtype(k)}
                      className={`${s.dtype} ${dtype === k ? s.dtypeOn : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Discount amount"
                  inputMode="numeric"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className={s.discountInput}
                />
              </div>

              <div className={s.totals}>
                <div className={s.totalRow}>
                  <span className={s.totalKey}>Subtotal</span>
                  <span className={s.num}>{inr(subtotal)}</span>
                </div>
                <div className={s.totalRow}>
                  <span className={s.totalKey}>Discount</span>
                  <span className={s.num}>
                    {discountValue ? '−' + inr(discountValue) : '₹0'}
                  </span>
                </div>
                <div className={s.grand}>
                  <span>Total</span>
                  <span className={s.num}>{inr(total)}</span>
                </div>
              </div>

              <div className={s.payGroup}>
                <span className={s.payLabel}>Paid by</span>
                <div className={s.modes}>
                  {payModes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`${s.mode} ${mode === m ? s.modeOn : ''}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.fields}>
                <label className={f.label}>
                  Sold at
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={f.select}
                  >
                    {(config?.locations ?? []).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={f.label}>
                  Date
                  <input
                    type="date"
                    value={date}
                    max={ymd()}
                    onChange={(e) => setDate(e.target.value)}
                    className={f.input}
                  />
                </label>
                <label className={f.label}>
                  Customer name (optional)
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    className={f.input}
                  />
                </label>
                <label className={f.label}>
                  Phone (optional)
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
                    placeholder="For a WhatsApp receipt"
                    className={f.input}
                  />
                </label>
              </div>

              <input
                aria-label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional), e.g. Onam exhibition, stall 12"
                className={f.input}
              />

              <button
                type="button"
                onClick={() => void record()}
                disabled={!lines.length || busy}
                className={s.submit}
              >
                {lines.length ? `Record sale · ${inr(total)}` : 'Add pieces to the bill'}
              </button>
            </div>
          </section>

          <section className={s.card}>
            <div className={s.recentHead}>
              <h2 className={s.h2}>Recent offline sales</h2>
            </div>
            {recent.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className={s.recent}>
                <span className={s.recentId}>{o.id}</span>
                <span className={s.recentBody}>
                  <span className={s.clip}>{o.items.map((l) => l.name).join(', ')}</span>
                  <span className={s.meta}>
                    {fDT(o.createdAt)} · {o.payment.method}
                  </span>
                </span>
                <span className={s.num}>{inr(o.total)}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
