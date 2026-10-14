import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inventory, meta, type StockRow } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { LEDGER_REASON, STOCK_LOW, STOCK_OK, STOCK_OUT, badgeOf } from '@/lib/badges';
import { downloadCsv } from '@/lib/csv';
import { fD, fDT, inr, plural, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { AdjustStockModal } from './AdjustStockModal';
import { useInventoryFilters } from './useInventoryFilters';
import s from './InventoryPage.module.css';
import type { LedgerReason } from '@/data/types';

const STOCK_LEVELS: [string, string][] = [
  ['', 'Any stock'],
  ['in', 'In stock'],
  ['low', 'Low stock'],
  ['out', 'Out of stock'],
];

export function InventoryPage() {
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const filters = useInventoryFilters();
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: summary } = useQuery({ queryKey: ['inventory-summary'], queryFn: inventory.summary });
  const { data: rows = [] } = useQuery({
    queryKey: ['inventory-stock', filters.q, filters.cat, filters.stock],
    queryFn: () => inventory.stock({ q: filters.q, cat: filters.cat, stock: filters.stock }),
    enabled: filters.tab === 'stock',
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ['inventory-ledger', filters.q, filters.reason],
    queryFn: () => inventory.ledger({ q: filters.q, reason: filters.reason }),
    enabled: filters.tab === 'ledger',
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    void qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
    void qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
    void qc.invalidateQueries({ queryKey: ['badges'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const colorLabel = (k: string) => colors[k]?.label ?? k;
  const colorHex = (k: string) => colors[k]?.hex ?? '#CCCCCC';
  const low = summary?.lowThreshold ?? 2;

  const quick = async (row: StockRow, delta: number) => {
    await inventory.quick(row.vid, delta);
    refresh();
  };

  const exportCsv = async () => {
    const all = await inventory.stock();
    const head = ['SKU', 'Product', 'Colour', 'Stock', 'Last change'];
    downloadCsv(`aarunya-stock-${ymd()}.csv`, [
      head,
      ...all.map((r) => [
        r.sku,
        r.name,
        colorLabel(r.color),
        r.stock,
        r.lastReason ? `${LEDGER_REASON[r.lastReason].text} · ${fD(r.lastAt)}` : '',
      ]),
    ]);
    flash('CSV downloaded');
  };

  const cards = [
    {
      label: 'Units in stock',
      value: String(summary?.units ?? 0),
      sub: `${plural(summary?.variants ?? 0, 'colour variant')}`,
    },
    { label: 'Stock value', value: inr(summary?.value ?? 0), sub: 'At selling price' },
    { label: 'Low stock', value: String(summary?.low ?? 0), sub: `${low} or fewer left` },
    { label: 'Out of stock', value: String(summary?.out ?? 0), sub: 'Shown as sold out' },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        sub="Stock for every colour, with a record of every change."
        actions={[{ label: 'Export CSV', onClick: () => void exportCsv() }]}
      />

      <div className={s.screen}>
        <div className={s.sumGrid}>
          {cards.map((c) => (
            <div key={c.label} className={s.sumCard}>
              <span className={s.sumLabel}>{c.label}</span>
              <span className={s.sumValue}>{c.value}</span>
              <span className={s.sumSub}>{c.sub}</span>
            </div>
          ))}
        </div>

        <div className={s.bar}>
          <div role="tablist" aria-label="Inventory view" className={s.tabs}>
            {(
              [
                ['stock', 'Stock levels'],
                ['ledger', 'Stock history'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filters.tab === k}
                onClick={() => filters.set({ tab: k })}
                className={`${s.tab} ${filters.tab === k ? s.tabOn : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="search"
            aria-label="Search stock"
            placeholder="Search name, SKU or order"
            value={filters.q}
            onChange={(e) => filters.set({ q: e.target.value })}
            className={`${f.input} ${s.search}`}
          />

          {filters.tab === 'stock' ? (
            <>
              <select
                aria-label="Category"
                value={filters.cat}
                onChange={(e) => filters.set({ cat: e.target.value })}
                className={`${f.select} ${s.filter}`}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.short || c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Stock level"
                value={filters.stock}
                onChange={(e) =>
                  filters.set({ stock: e.target.value as typeof filters.stock })
                }
                className={`${f.select} ${s.filter}`}
              >
                {STOCK_LEVELS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              aria-label="Change type"
              value={filters.reason}
              onChange={(e) => filters.set({ reason: e.target.value as LedgerReason | '' })}
              className={`${f.select} ${s.filter}`}
            >
              <option value="">All changes</option>
              {(Object.keys(LEDGER_REASON) as LedgerReason[]).map((k) => (
                <option key={k} value={k}>
                  {LEDGER_REASON[k].text}
                </option>
              ))}
            </select>
          )}
        </div>

        {filters.tab === 'stock' ? (
          <div className={s.card}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 980 }}>
                <div className={`${s.stockCols} ${s.head}`}>
                  <span>Product</span>
                  <span>Colour</span>
                  <span>SKU</span>
                  <span>Stock</span>
                  <span>Level</span>
                  <span>Last change</span>
                  <span />
                </div>

                {rows.map((r) => {
                  const pill =
                    r.stock === 0 ? STOCK_OUT : r.stock <= low ? STOCK_LOW : STOCK_OK;
                  return (
                    <div key={r.vid} className={`${s.stockCols} ${s.row}`}>
                      <Link to={`/products/${r.pid}`} className={s.product}>
                        <span
                          className={s.thumb}
                          style={r.img ? { backgroundImage: `url("${r.img}")` } : undefined}
                        />
                        <span className={s.clip}>{r.name}</span>
                      </Link>

                      <span className={s.colorCell}>
                        <span className={s.dot} style={{ background: colorHex(r.color) }} />
                        {colorLabel(r.color)}
                      </span>

                      <span className={s.sku}>{r.sku}</span>

                      <span className={s.stepper}>
                        <button
                          type="button"
                          aria-label="Remove one"
                          disabled={r.stock === 0}
                          onClick={() => void quick(r, -1)}
                          className={s.stepBtn}
                        >
                          −
                        </button>
                        <span className={s.stepValue}>{r.stock}</span>
                        <button
                          type="button"
                          aria-label="Add one"
                          onClick={() => void quick(r, 1)}
                          className={s.stepBtn}
                        >
                          +
                        </button>
                      </span>

                      <span>
                        <span className={s.pill} style={{ background: pill.bg, color: pill.fg }}>
                          {pill.text}
                        </span>
                      </span>

                      <span className={s.last}>
                        {r.lastReason
                          ? `${LEDGER_REASON[r.lastReason].text} · ${fD(r.lastAt)}`
                          : '—'}
                      </span>

                      <button
                        type="button"
                        onClick={() => setAdjusting(r)}
                        className={s.adjust}
                      >
                        Adjust
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {rows.length === 0 && <p className={s.empty}>No variants match.</p>}
          </div>
        ) : (
          <div className={s.card}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 860 }}>
                <div className={`${s.ledgerCols} ${s.head}`}>
                  <span>When</span>
                  <span>Piece</span>
                  <span>Reason</span>
                  <span style={{ textAlign: 'right' }}>Change</span>
                  <span>Reference</span>
                  <span>Note</span>
                </div>

                {ledger.map((m, i) => {
                  const badge = badgeOf(LEDGER_REASON, m.reason);
                  return (
                    <div key={`${m.at}-${m.vid}-${i}`} className={`${s.ledgerCols} ${s.ledgerRow}`}>
                      <span className={s.when}>{fDT(m.at)}</span>
                      <span className={s.stack}>
                        <span className={s.clip}>{m.name}</span>
                        <span className={s.meta}>
                          {colorLabel(m.color)} · {m.sku}
                        </span>
                      </span>
                      <span>
                        <span
                          className={s.pillSmall}
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.text}
                        </span>
                      </span>
                      <span
                        className={s.change}
                        style={{ color: m.change > 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {m.change > 0 ? '+' : ''}
                        {m.change}
                      </span>
                      <span>
                        {m.ref && (
                          <Link
                            to={`${m.ref.startsWith('RX') ? '/returns' : '/orders'}/${m.ref}`}
                            className={s.ref}
                          >
                            {m.ref}
                          </Link>
                        )}
                      </span>
                      <span className={s.note}>{m.note ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {ledger.length === 0 && <p className={s.empty}>No stock changes match.</p>}
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustStockModal
          row={adjusting}
          colorLabel={colorLabel(adjusting.color)}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            refresh();
            setAdjusting(null);
          }}
        />
      )}
    </>
  );
}
