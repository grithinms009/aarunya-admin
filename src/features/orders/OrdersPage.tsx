import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { meta, orders } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { CHANNEL, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/badges';
import { downloadCsv } from '@/lib/csv';
import { fD, fDT, fT, inr, plural, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { OrderDrawer } from './OrderDrawer';
import { BLANK_ORDER_FILTERS, useOrderFilters, type OrderFilters } from './useOrderFilters';
import s from './OrdersPage.module.css';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUSES: [string, string][] = [
  ['', 'Any status'],
  ['new', 'New (to pack)'],
  ['packed', 'Packed'],
  ['shipped', 'Shipped'],
  ['out', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed (offline)'],
  ['cancelled', 'Cancelled'],
];

const PAYMENTS: [string, string][] = [
  ['', 'Any payment'],
  ['paid', 'Paid'],
  ['pending', 'Payment pending'],
  ['refunded', 'Refunded'],
  ['partial', 'Part refunded'],
];

const RANGES: [string, string][] = [
  ['today', 'Today'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['all', 'All time'],
  ['custom', 'Custom dates'],
];

export function OrdersPage() {
  const { orderNo } = useParams();
  const navigate = useNavigate();
  const flash = useUi((st) => st.flash);
  const filters = useOrderFilters();

  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => orders.list(filters),
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? { all: 0, online: 0, offline: 0 };
  const sum = data?.summary;
  const colorLabel = (k: string) => colors[k]?.label ?? k;

  const hasFilters = !!(
    filters.q ||
    filters.status ||
    filters.pay ||
    filters.range !== '30' ||
    filters.ch !== 'all'
  );

  const exportCsv = () => {
    const head = [
      'Order', 'Date', 'Channel', 'Customer', 'Phone', 'City', 'Items', 'Subtotal', 'Discount',
      'Shipping', 'Gift wrap', 'Total', 'Payment', 'Method', 'Status', 'Courier', 'AWB', 'Location',
    ];
    downloadCsv(`aarunya-orders-${ymd()}.csv`, [
      head,
      ...rows.map((o) => [
        o.id, fDT(o.createdAt), o.channel, o.customer.name, o.customer.phone, o.customer.city,
        o.items.map((l) => `${l.name} (${colorLabel(l.color)}) x${l.qty}`).join('; '),
        o.subtotal, o.discount || 0, o.shipping || 0, o.giftFee || 0, o.total,
        o.payment.status, o.payment.method, ORDER_STATUS[o.status].text,
        o.shipment?.courier ?? '', o.shipment?.awb ?? '', o.location || '',
      ]),
    ]);
    flash('CSV downloaded');
  };

  const cards = sum
    ? [
        {
          label: 'Sales',
          value: inr(sum.sales),
          sub: `${plural(sum.orders, 'order')}, excluding cancelled`,
        },
        { label: 'Online', value: inr(sum.online), sub: plural(sum.onlineCount, 'order') },
        { label: 'Offline', value: inr(sum.offline), sub: plural(sum.offlineCount, 'sale') },
        {
          label: 'Items sold',
          value: String(sum.units),
          sub: `Average ${inr(sum.average)}`,
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Online and offline sales in one place."
        actions={[
          { label: 'Export CSV', onClick: exportCsv },
          { label: 'Offline sale', to: '/pos', primary: true },
        ]}
      />

      <div className={s.screen}>
        <div role="group" aria-label="Sales channel" className={s.channels}>
          {(
            [
              ['all', 'All sales', counts.all],
              ['online', 'Online', counts.online],
              ['offline', 'Offline', counts.offline],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filters.ch === k}
              onClick={() => filters.set({ ch: k })}
              className={`${s.channel} ${filters.ch === k ? s.channelOn : ''}`}
            >
              {label} ({n})
            </button>
          ))}
        </div>

        <div className={s.filters}>
          <div className={s.filterGrid}>
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Order no., name, phone or piece"
              value={filters.q}
              onChange={(e) => filters.set({ q: e.target.value })}
              className={`${f.input} ${s.search}`}
            />
            <select
              aria-label="Status"
              value={filters.status}
              onChange={(e) => filters.set({ status: e.target.value as OrderFilters['status'] })}
              className={f.select}
            >
              {STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Payment"
              value={filters.pay}
              onChange={(e) => filters.set({ pay: e.target.value as OrderFilters['pay'] })}
              className={f.select}
            >
              {PAYMENTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Date range"
              value={filters.range}
              onChange={(e) => filters.set({ range: e.target.value as OrderFilters['range'] })}
              className={f.select}
            >
              {RANGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className={s.secondRow}>
            {filters.range === 'custom' && (
              <>
                <label className={s.dateLabel}>
                  From
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => filters.set({ from: e.target.value })}
                    className={s.date}
                  />
                </label>
                <label className={s.dateLabel}>
                  To
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => filters.set({ to: e.target.value })}
                    className={s.date}
                  />
                </label>
              </>
            )}
            <span style={{ flex: 1 }} />
            {hasFilters && (
              <button
                type="button"
                onClick={() => filters.set({ ...BLANK_ORDER_FILTERS })}
                className={s.reset}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        <div className={s.sumGrid}>
          {cards.map((c) => (
            <div key={c.label} className={s.sumCard}>
              <span className={s.sumLabel}>{c.label}</span>
              <span className={s.sumValue}>{c.value}</span>
              <span className={s.sumSub}>{c.sub}</span>
            </div>
          ))}
        </div>

        <div className={s.card}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 1000 }}>
              <div className={s.head}>
                <span>Order</span>
                <span>Date</span>
                <span>Customer</span>
                <span>Channel</span>
                <span>Items</span>
                <span style={{ textAlign: 'right' }}>Total</span>
                <span>Payment</span>
                <span>Status</span>
              </div>

              {rows.map((o) => {
                const units = o.items.reduce((t, l) => t + l.qty, 0);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className={s.row}
                  >
                    <span className={s.id}>{o.id}</span>
                    <span className={s.stack}>
                      <span>{fD(o.createdAt)}</span>
                      <span className={s.meta}>{fT(o.createdAt)}</span>
                    </span>
                    <span className={s.stack}>
                      <span className={s.clip}>
                        {o.customer.name ||
                          (o.channel === 'offline' ? 'Walk-in customer' : '—')}
                      </span>
                      <span className={s.meta}>
                        {o.channel === 'offline'
                          ? o.location || 'Offline'
                          : [o.customer.city, o.customer.phone].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span>
                      <span
                        className={s.pill}
                        style={{
                          background: CHANNEL[o.channel].bg,
                          color: CHANNEL[o.channel].fg,
                        }}
                      >
                        {CHANNEL[o.channel].text}
                      </span>
                    </span>
                    <span className={s.stack}>
                      <span>{plural(units, 'item')}</span>
                      <span className={s.meta}>{o.items.map((l) => l.name).join(', ')}</span>
                    </span>
                    <span className={s.total}>{inr(o.total)}</span>
                    <span className={s.payCell}>
                      <span
                        className={s.pill}
                        style={{
                          background: PAYMENT_STATUS[o.payment.status].bg,
                          color: PAYMENT_STATUS[o.payment.status].fg,
                        }}
                      >
                        {PAYMENT_STATUS[o.payment.status].text}
                      </span>
                      <span className={s.method}>{o.payment.method}</span>
                    </span>
                    <span>
                      <span
                        className={s.statusPill}
                        style={{
                          background: ORDER_STATUS[o.status].bg,
                          color: ORDER_STATUS[o.status].fg,
                        }}
                      >
                        {ORDER_STATUS[o.status].text}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {rows.length === 0 && (
            counts.all === 0 && !hasFilters ? (
              <EmptyState
                title="No orders yet"
                body="Online orders land here as soon as they are placed. You can also record a sale you made in person."
                action="/pos"
                actionLabel="Record an offline sale"
              />
            ) : (
              <EmptyState
                title="No orders match these filters"
                body="Try a wider date range, or a different status or payment state."
                onAction={() => filters.set({ ...BLANK_ORDER_FILTERS })}
                actionLabel="Reset filters"
              />
            )
          )}
        </div>
      </div>

      {orderNo && <OrderDrawer orderNo={orderNo} />}
    </>
  );
}
