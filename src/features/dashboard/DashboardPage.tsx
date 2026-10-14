import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboard, meta, type Period } from '@/api';
import { Card, CardBody, CardEmpty, CardScroll } from '@/components/ui/Card';
import { Pill, Segmented } from '@/components/ui/controls';
import { Icon, PATH } from '@/components/ui/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { useViewport } from '@/hooks/useViewport';
import { CHANNEL, ORDER_STATUS, STOCK_OUT, leftBadge } from '@/lib/badges';
import { fDT, inr, plural } from '@/lib/format';
import { useAuth } from '@/store/useAuth';
import { useOrderFilters } from '@/features/orders/useOrderFilters';
import { useInventoryFilters } from '@/features/inventory/useInventoryFilters';
import s from './DashboardPage.module.css';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

const PERIOD_LABEL: Record<Period, string> = {
  today: 'today',
  '7': 'in the last 7 days',
  '30': 'in the last 30 days',
};

/** The four KPI tile palettes from the prototype's KT map. */
const TONE = {
  teal: { bar: '#7FC4B8', tile: '#E7F5F2', ic: '#2A8C7C' },
  green: { bar: '#8FD0A8', tile: '#E9F6EE', ic: '#2F8F5B' },
  gold: { bar: '#D8B66A', tile: '#FBF3E2', ic: '#A8822F' },
  coral: { bar: '#EBA07E', tile: '#FCEEE6', ic: '#C8643A' },
};

export function DashboardPage() {
  const { w, desk } = useViewport();
  const navigate = useNavigate();
  const user = useAuth((st) => st.user);
  const [period, setPeriod] = useState<Period>('7');
  const setOrderFilters = useOrderFilters((st) => st.set);
  const setInventoryFilters = useInventoryFilters((st) => st.set);

  const { data } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => dashboard.summary(period),
  });
  const { data: colors } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });

  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${
    user?.name ?? ''
  }.`;

  /** Content width, so the grids break where the prototype's L.* values break. */
  const cw = w - (desk ? 296 : 0) - (w >= 700 ? 64 : 32);
  const kpiCols = cw >= 760 ? 'repeat(4,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))';
  const gridCols =
    cw >= 960 ? 'repeat(3,minmax(0,1fr))' : cw >= 620 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)';
  const wide = cw >= 620 ? 'span 2' : 'auto';

  const perLabel = PERIOD_LABEL[period];
  const d = data;
  const colorLabel = (k: string) => colors?.[k]?.label ?? k;

  const kpis = d
    ? [
        {
          label: 'Revenue', tone: TONE.teal, d: PATH.rupee, value: inr(d.revenue.total),
          sub: `${inr(d.revenue.online)} online · ${inr(d.revenue.offline)} offline`,
        },
        {
          label: 'Orders', tone: TONE.green, d: PATH.bag, value: String(d.orderCount.total),
          sub: `${d.orderCount.online} online · ${d.orderCount.offline} offline`,
        },
        {
          label: 'Items sold', tone: TONE.gold, d: PATH.box, value: String(d.units),
          sub: `${plural(d.pieces, 'different piece')}`,
        },
        {
          label: 'Average order', tone: TONE.coral, d: PATH.trend, value: inr(d.average),
          sub: `Sales ${perLabel}`,
        },
      ]
    : [];

  const toOrders = (patch: Parameters<typeof setOrderFilters>[0]) => () => {
    setOrderFilters({ ch: 'all', status: '', pay: '', range: 'all', from: '', to: '', q: '', ...patch });
    navigate('/orders');
  };

  const attention = d
    ? [
        ['Paid orders to pack', d.attention.paidToPack, toOrders({ ch: 'online', status: 'new', pay: 'paid' })],
        ['Packed, waiting to ship', d.attention.packedToShip, toOrders({ status: 'packed' })],
        ['Waiting for payment', d.attention.awaitingPayment, toOrders({ pay: 'pending' })],
        ['Return requests to review', d.attention.returnsToReview, () => navigate('/returns')],
        [
          'Low stock variants', d.attention.lowStock,
          () => {
            setInventoryFilters({ tab: 'stock', stock: 'low' });
            navigate('/inventory');
          },
        ],
        [
          'Out of stock variants', d.attention.outOfStock,
          () => {
            setInventoryFilters({ tab: 'stock', stock: 'out' });
            navigate('/inventory');
          },
        ],
      ] as [string, number, () => void][]
    : [];

  const pct = d && d.revenue.total ? Math.round((d.revenue.online / d.revenue.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={greeting}
        actions={[
          { label: 'Offline sale', to: '/pos' },
          { label: 'Add product', to: '/products/new', primary: true },
        ]}
      />

      <div className={s.screen}>
        <div className={s.periodRow}>
          <span className={s.periodLabel}>Performance · {perLabel}</span>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Period" />
        </div>

        <div className={s.kpiGrid} style={{ gridTemplateColumns: kpiCols }}>
          {kpis.map((k) => (
            <div key={k.label} className={s.kpi} style={{ borderBottom: `2px solid ${k.tone.bar}` }}>
              <div className={s.kpiTop}>
                <span className={s.kpiLabel}>{k.label}</span>
                <span
                  aria-hidden="true"
                  className={s.kpiTile}
                  style={{ background: k.tone.tile, color: k.tone.ic }}
                >
                  <Icon d={k.d} size={16} width={1.8} />
                </span>
              </div>
              <span className={s.kpiValue}>{k.value}</span>
              <span className={s.kpiSub}>{k.sub}</span>
            </div>
          ))}
        </div>

        <div className={s.grid} style={{ gridTemplateColumns: gridCols }}>
          <Card
            title="Recent orders"
            linkTo="/orders"
            linkLabel="View all"
            style={{ gridColumn: wide }}
          >
            <CardScroll minWidth={560}>
              <div className={s.ordHead}>
                <span>Order</span>
                <span>Customer</span>
                <span>Channel</span>
                <span style={{ textAlign: 'right' }}>Total</span>
                <span style={{ textAlign: 'right' }}>Status</span>
              </div>
              {(d?.recent ?? []).map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className={s.ordRow}>
                  <span className={s.id}>{o.id}</span>
                  <span className={s.stack}>
                    <span className={s.name}>
                      {o.customer.name || (o.channel === 'offline' ? 'Walk-in customer' : '—')}
                    </span>
                    <span className={s.meta}>{fDT(o.createdAt)}</span>
                  </span>
                  <span>
                    <Pill badge={CHANNEL[o.channel]} />
                  </span>
                  <span className={s.right}>{inr(o.total)}</span>
                  <span style={{ justifySelf: 'end' }}>
                    <Pill badge={ORDER_STATUS[o.status]} />
                  </span>
                </Link>
              ))}
            </CardScroll>
          </Card>

          <Card title="Needs attention">
            <CardBody>
              {attention.map(([label, n, run]) => (
                <button
                  key={label}
                  type="button"
                  onClick={run}
                  className={s.attn}
                  style={{ color: n ? 'var(--ink)' : 'var(--ink-faint)' }}
                >
                  <span style={{ flex: 1 }}>{label}</span>
                  <span
                    className={s.attnCount}
                    style={{
                      background: n ? 'var(--gold-tint)' : 'var(--nav-bg)',
                      color: n ? 'var(--gold)' : 'var(--ink-faint)',
                    }}
                  >
                    {n}
                  </span>
                  <span aria-hidden="true" className={s.chev}>
                    ›
                  </span>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card title="Best sellers" note={perLabel}>
            {d && d.top.length === 0 && <CardEmpty>No sales in this period yet.</CardEmpty>}
            <CardBody>
              {(d?.top ?? []).map((t, i) => (
                <div key={t.pid} className={s.listRow}>
                  <span className={s.rank}>{i + 1}</span>
                  <span
                    className={s.thumb}
                    style={t.img ? { backgroundImage: `url("${t.img}")` } : undefined}
                  />
                  <span className={s.grow}>{t.name}</span>
                  <span className={s.endStack}>
                    <span className={s.endValue}>{inr(t.revenue)}</span>
                    <span className={s.meta}>{t.units} sold</span>
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card title="Low and out of stock" linkTo="/inventory" linkLabel="Inventory">
            {d && d.low.length === 0 && <CardEmpty>Everything is well stocked.</CardEmpty>}
            <CardBody>
              {(d?.low ?? []).map((l) => (
                <Link key={l.sku} to={`/products/${l.pid}`} className={s.listRow}>
                  <span
                    className={s.thumb}
                    style={l.img ? { backgroundImage: `url("${l.img}")` } : undefined}
                  />
                  <span className={s.growStack}>
                    <span className={s.name}>{l.name}</span>
                    <span className={s.meta}>
                      {colorLabel(l.color)} · {l.sku}
                    </span>
                  </span>
                  <Pill badge={l.stock === 0 ? STOCK_OUT : leftBadge(l.stock)} />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card title="Online vs offline">
            <div className={s.barWrap}>
              <div aria-hidden="true" className={s.bar}>
                <span className={s.barFill} style={{ width: `${pct}%`, background: 'var(--gold)' }} />
                <span
                  className={s.barFill}
                  style={{
                    width: `${d && d.revenue.total ? 100 - pct : 0}%`,
                    background: '#2A8C7C',
                  }}
                />
              </div>
            </div>
            <CardBody>
              <div className={s.splitRowTop}>
                <span className={s.dot} style={{ background: 'var(--gold)' }} />
                <span className={s.splitLabel}>Online</span>
                <span className={s.endStack}>
                  <span className={s.endValue}>
                    {inr(d?.revenue.online ?? 0)} · {pct}%
                  </span>
                  <span className={s.meta}>{plural(d?.orderCount.online ?? 0, 'order')}</span>
                </span>
              </div>
              <div className={s.splitRow}>
                <span className={s.dot} style={{ background: '#2A8C7C' }} />
                <span className={s.splitLabel}>Offline</span>
                <span className={s.endStack}>
                  <span className={s.endValue}>
                    {inr(d?.revenue.offline ?? 0)} · {d && d.revenue.total ? 100 - pct : 0}%
                  </span>
                  <span className={s.meta}>{plural(d?.orderCount.offline ?? 0, 'sale')}</span>
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
