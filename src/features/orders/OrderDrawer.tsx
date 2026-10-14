import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NEXT_STEP, ORDER_STEPS, RuleError, meta, orders } from '@/api';
import { Drawer, Steps, buildSteps } from '@/components/ui/Drawer';
import { CHANNEL, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/badges';
import { fDT, inr, plural, waLink } from '@/lib/format';
import { printInvoice } from '@/lib/invoice';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import d from '@/components/ui/Drawer.module.css';

interface Props {
  orderNo: string;
}

export function OrderDrawer({ orderNo }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);

  const { data: order } = useQuery({
    queryKey: ['order', orderNo],
    queryFn: () => orders.get(orderNo),
  });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });

  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');
  const [note, setNote] = useState('');

  /* Load the shipment and note into local state when the order arrives. */
  useEffect(() => {
    if (!order || !config) return;
    setCourier(order.shipment?.courier || config.defaultCourier || '');
    setAwb(order.shipment?.awb || '');
    setNote(order.note || '');
  }, [order, config]);

  const close = () => navigate('/orders');

  if (!order || !config) return null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['order', orderNo] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['badges'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    void qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
  };

  const online = order.channel === 'online';
  const next = NEXT_STEP[order.status];
  const colorLabel = (k: string) => colors[k]?.label ?? k;
  const firstName = (order.customer.name || '').split(' ')[0];

  const savedCourier = order.shipment
    ? (config.couriers ?? []).find((c) => c.id === order.shipment!.courier)
    : undefined;
  const trackUrl =
    order.shipment?.awb && savedCourier
      ? savedCourier.url.replace('{awb}', encodeURIComponent(order.shipment.awb))
      : '';

  const shipMessage = (config.shipMsg || '')
    .replace('{name}', firstName)
    .replace('{order}', order.id)
    .replace('{link}', trackUrl);

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    try {
      await fn();
      refresh();
      if (okMessage) flash(okMessage);
    } catch (e) {
      flash(e instanceof RuleError ? e.message : 'Could not update the order');
    }
  };

  const totals = [
    ['Subtotal', inr(order.subtotal)],
    ...(order.discount ? [['Discount', '−' + inr(order.discount)]] : []),
    ...(online ? [['Shipping', order.shipping ? inr(order.shipping) : 'Free']] : []),
    ...(order.giftWrap ? [['Gift wrap', inr(order.giftFee || 0)]] : []),
  ] as [string, string][];

  const canCancel = online
    ? ['new', 'packed'].includes(order.status)
    : order.status !== 'cancelled';

  return (
    <Drawer
      label={`Order ${order.id}`}
      onClose={close}
      header={
        <>
          <span className={d.titleRow}>
            <span className={d.id}>{order.id}</span>
            <span
              className={d.pill}
              style={{ background: CHANNEL[order.channel].bg, color: CHANNEL[order.channel].fg }}
            >
              {CHANNEL[order.channel].text}
            </span>
            <span
              className={d.pill}
              style={{
                background: ORDER_STATUS[order.status].bg,
                color: ORDER_STATUS[order.status].fg,
              }}
            >
              {ORDER_STATUS[order.status].text}
            </span>
            <span
              className={d.pill}
              style={{
                background: PAYMENT_STATUS[order.payment.status].bg,
                color: PAYMENT_STATUS[order.payment.status].fg,
              }}
            >
              {PAYMENT_STATUS[order.payment.status].text}
            </span>
          </span>
          <span className={d.when}>{fDT(order.createdAt)}</span>
        </>
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (!printInvoice(order, config, colorLabel)) {
                flash('Allow pop-ups to print the invoice');
              }
            }}
            className={d.footBtn}
          >
            Print invoice
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={() =>
                ask({
                  title: online ? `Cancel ${order.id}?` : `Void sale ${order.id}?`,
                  text: 'Items go back into stock and a paid order is marked as refunded. Refund the customer through your payment provider.',
                  ok: online ? 'Cancel order' : 'Void sale',
                  run: () =>
                    void run(
                      () => orders.cancel(order.id),
                      `${order.id} cancelled. Stock restored.`,
                    ),
                })
              }
              className={d.danger}
            >
              {online ? 'Cancel order' : 'Void this sale'}
            </button>
          )}
        </>
      }
    >
      {order.payment.status === 'pending' && order.status !== 'cancelled' && (
        <div className={d.banner}>
          <span style={{ flex: '1 1 200px', fontSize: 13.5 }}>
            Payment hasn’t come through yet. Check your payment dashboard before packing.
          </span>
          <button
            type="button"
            onClick={() => void run(() => orders.markPaid(order.id), 'Marked as paid')}
            className={d.bannerBtn}
          >
            Mark as paid
          </button>
        </div>
      )}

      {online && order.status !== 'cancelled' && (
        <Steps
          steps={buildSteps(ORDER_STEPS, order.status, order.history).map((st) => ({
            ...st,
            at: st.at ? fDT(st.at) : '',
          }))}
        />
      )}

      {next && order.status !== 'cancelled' && (
        <button
          type="button"
          onClick={() =>
            void run(
              () => orders.advance(order.id, { courier, awb }),
              `${order.id} marked as ${ORDER_STATUS[next[0]].text.toLowerCase()}`,
            )
          }
          className={d.primary}
        >
          {next[1]}
        </button>
      )}

      {order.status === 'cancelled' && (
        <p className={d.notice}>This order was cancelled. Its items were added back to stock.</p>
      )}

      {order.returnId && (
        <Link to={`/returns/${order.returnId}`} className={d.linkCard}>
          This order has a return or exchange request ({order.returnId})<span>Open →</span>
        </Link>
      )}

      <section className={d.section}>
        <h3 className={d.h3}>Customer</h3>
        <div className={d.customerRow}>
          <div className={d.customer}>
            <span style={{ fontWeight: 500 }}>{order.customer.name || 'Walk-in customer'}</span>
            <span>{order.customer.phone || 'No phone'}</span>
            {order.customer.email && <span>{order.customer.email}</span>}
            {order.customer.address && (
              <>
                <span style={{ color: 'var(--ink-3)' }}>{order.customer.address}</span>
                <span style={{ color: 'var(--ink-3)' }}>
                  {[order.customer.city, order.customer.state].filter(Boolean).join(', ')}
                  {order.customer.pin ? ' ' + order.customer.pin : ''}
                </span>
              </>
            )}
            {!online && (
              <span style={{ color: 'var(--ink-3)' }}>Sold at {order.location || '—'}</span>
            )}
          </div>
          {order.customer.phone && (
            <a
              href={waLink(
                order.customer.phone,
                `Hi ${firstName}, this is Veena from Aarunya Jewels about your order ${order.id}.`,
              )}
              target="_blank"
              rel="noopener"
              className={d.whatsapp}
            >
              Message on WhatsApp
            </a>
          )}
        </div>
      </section>

      {online && order.status !== 'cancelled' && (
        <section className={d.panel}>
          <h3 className={d.h3}>Shipping &amp; tracking</h3>
          <div className={d.panelGrid}>
            <select
              aria-label="Courier"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className={f.select}
            >
              {(config.couriers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Tracking number"
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="Tracking number (AWB)"
              className={f.input}
            />
          </div>
          <div className={d.panelRow}>
            <button
              type="button"
              onClick={() =>
                void run(() => orders.saveShipment(order.id, { courier, awb }), 'Tracking saved')
              }
              className={d.ghost}
            >
              {order.shipment?.awb ? 'Update tracking' : 'Save tracking'}
            </button>
            {trackUrl && (
              <a href={trackUrl} target="_blank" rel="noopener" className={d.trackLink}>
                Open tracking page ↗
              </a>
            )}
            {trackUrl && order.customer.phone && config.notifyOnShip !== false && (
              <a
                href={waLink(order.customer.phone, shipMessage)}
                target="_blank"
                rel="noopener"
                className={d.whatsapp}
              >
                Send tracking on WhatsApp
              </a>
            )}
          </div>
        </section>
      )}

      <section className={d.section}>
        <h3 className={d.h3} style={{ marginBottom: 4 }}>
          Items
        </h3>
        {order.items.map((it) => (
          <div key={it.vid} className={d.item}>
            <span
              className={d.itemThumb}
              style={it.img ? { backgroundImage: `url("${it.img}")` } : undefined}
            />
            <span className={d.itemText}>
              <span className={d.itemName}>{it.name}</span>
              <span className={d.itemMeta}>
                {colorLabel(it.color)} · Qty {it.qty}
                {it.qty > 1 ? ` × ${inr(it.price)}` : ''}
              </span>
              <span className={d.itemSku}>{it.sku}</span>
            </span>
            <span className={d.num}>{inr(it.price * it.qty)}</span>
          </div>
        ))}
        <div className={d.totals}>
          {totals.map(([k, v]) => (
            <div key={k} className={d.totalRow}>
              <span className={d.totalKey}>{k}</span>
              <span className={d.num}>{v}</span>
            </div>
          ))}
          <div className={d.grandRow}>
            <span>Total</span>
            <span className={d.num}>{inr(order.total)}</span>
          </div>
          <span className={d.payText}>
            Payment: {[order.payment.method, order.payment.ref].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
      </section>

      <label className={d.noteLabel}>
        Private note
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Only you can see this"
          className={d.noteArea}
        />
        <button
          type="button"
          onClick={() => void run(() => orders.saveNote(order.id, note), 'Note saved')}
          className={d.noteBtn}
        >
          Save note
        </button>
      </label>

      <section className={d.section}>
        <h3 className={d.h3}>History</h3>
        {order.history
          .slice()
          .reverse()
          .map((h, i) => (
            <div key={i} className={d.historyRow}>
              <span className={d.historyAt}>{fDT(h.at)}</span>
              <span>{h.note || ORDER_STATUS[h.status as keyof typeof ORDER_STATUS]?.text || h.status}</span>
            </div>
          ))}
      </section>

      <span className={d.payText}>
        {plural(order.items.reduce((t, l) => t + l.qty, 0), 'item')} in this order
      </span>
    </Drawer>
  );
}
