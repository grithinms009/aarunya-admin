import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RETURN_STEPS,
  ReturnRuleError,
  meta,
  products,
  returns,
} from '@/api';
import { Drawer, Steps, buildSteps } from '@/components/ui/Drawer';
import { Switch } from '@/components/ui/controls';
import { RETURN_STATUS, RETURN_TYPE } from '@/lib/badges';
import { fD, fDT, inr, waLink, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import d from '@/components/ui/Drawer.module.css';
import s from './ReturnsPage.module.css';
import type { ReturnType } from '@/data/types';

const REFUND_METHODS = ['Original payment method', 'UPI', 'Bank transfer', 'Store credit'];

export function ReturnDrawer({ returnNo }: { returnNo: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);

  const { data: request } = useQuery({
    queryKey: ['return', returnNo],
    queryFn: () => returns.get(returnNo),
  });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data: product } = useQuery({
    queryKey: ['product', request?.item.pid],
    queryFn: () => products.get(request!.item.pid),
    enabled: !!request,
  });

  const [type, setType] = useState<ReturnType>('replacement');
  const [reject, setReject] = useState('');
  const [courier, setCourier] = useState('');
  const [date, setDate] = useState(ymd(new Date(Date.now() + 864e5)));
  const [restock, setRestock] = useState(false);
  const [vid, setVid] = useState('');
  const [awb, setAwb] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(REFUND_METHODS[0]);

  /* Seed the action fields from the request when it loads. */
  useEffect(() => {
    if (!request || !config) return;
    setType(request.type);
    setCourier(config.defaultCourier || '');
    setVid(request.item.vid);
    setAmount(String(request.item.price * (request.item.qty || 1)));
  }, [request, config]);

  const close = () => navigate('/returns');
  if (!request || !config) return null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['return', returnNo] });
    void qc.invalidateQueries({ queryKey: ['returns'] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['badges'] });
    void qc.invalidateQueries({ queryKey: ['inventory-stock'] });
    void qc.invalidateQueries({ queryKey: ['inventory-ledger'] });
  };

  const run = async (fn: () => Promise<unknown>, okMessage: string) => {
    try {
      await fn();
      refresh();
      flash(okMessage);
    } catch (e) {
      flash(e instanceof ReturnRuleError ? e.message : 'Could not update the request');
    }
  };

  const e = returns.eligibility(request);
  const category = categories.find((c) => c.slug === e.category);
  const colorLabel = (k: string) => colors[k]?.label ?? k;
  const courierName = (id: string) =>
    (config.couriers ?? []).find((c) => c.id === id)?.name ?? id;
  const firstName = (request.customer.name || '').split(' ')[0];

  const checks = [
    {
      ok: e.inWindow,
      label: e.inWindow
        ? `Requested ${e.days} day${e.days === 1 ? '' : 's'} after delivery`
        : `Requested ${e.days} days after delivery. The window is ${config.returnWindow} days.`,
    },
    {
      ok: e.categoryOk,
      label: e.categoryOk
        ? 'Category is eligible'
        : `${category ? category.short : 'This category'} can only be exchanged if it arrived damaged`,
    },
    {
      ok: e.videoOk,
      label: e.videoOk
        ? request.video
          ? 'Unboxing video provided'
          : 'Video not required'
        : 'Unboxing video is missing',
    },
  ];

  const typeOptions = (
    [
      ['replacement', 'Replacement'],
      ['refund', 'Refund'],
    ] as [ReturnType, string][]
  ).filter(([k]) => k === 'replacement' || config.allowRefund || request.type === 'refund');

  return (
    <Drawer
      label={`Request ${request.id}`}
      onClose={close}
      header={
        <>
          <span className={d.titleRow}>
            <span className={d.id}>{request.id}</span>
            <span
              className={d.pill}
              style={{
                background: RETURN_STATUS[request.status].bg,
                color: RETURN_STATUS[request.status].fg,
              }}
            >
              {RETURN_STATUS[request.status].text}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {request.type === 'replacement' ? 'Replacement' : 'Refund'}
            </span>
          </span>
          <span className={d.when}>
            {fDT(request.createdAt)} · for <Link to={`/orders/${request.orderId}`}>{request.orderId}</Link>
          </span>
        </>
      }
    >
      {request.status !== 'rejected' && (
        <Steps
          steps={buildSteps(RETURN_STEPS, request.status, request.history).map((st) => ({
            ...st,
            at: st.at ? fDT(st.at) : '',
          }))}
        />
      )}

      {request.resolution && <p className={s.resolution}>{request.resolution}</p>}

      <div className={s.itemCard}>
        <span
          className={s.itemThumb}
          style={request.item.img ? { backgroundImage: `url("${request.item.img}")` } : undefined}
        />
        <span className={s.itemText}>
          <span style={{ fontWeight: 500 }}>{request.item.name}</span>
          <span className={d.itemMeta}>
            {colorLabel(request.item.color)} · {request.item.sku}
          </span>
        </span>
        <span className={d.num}>{inr(request.item.price)}</span>
      </div>

      <section className={s.said}>
        <h3 className={d.h3}>What the customer said</h3>
        <span style={{ fontWeight: 500 }}>{request.reason}</span>
        <span className={s.quote}>“{request.note || 'No note'}”</span>
        <span className={s.proof}>
          {[
            request.video ? 'Unboxing video received' : 'No unboxing video',
            request.photos ? `${request.photos} photos` : 'No photos',
          ].join(' · ')}
        </span>
        <div className={s.custRow}>
          <span style={{ fontSize: 13.5 }}>
            {request.customer.name} · {request.customer.phone || 'No phone'}
          </span>
          {request.customer.phone && (
            <a
              href={waLink(
                request.customer.phone,
                `Hi ${firstName}, this is Veena from Aarunya Jewels about your request ${request.id} for order ${request.orderId}.`,
              )}
              target="_blank"
              rel="noopener"
              className={s.waSmall}
            >
              WhatsApp
            </a>
          )}
        </div>
      </section>

      <section className={s.said}>
        <h3 className={d.h3}>Policy check</h3>
        {checks.map((c) => (
          <div key={c.label} className={s.check}>
            <span
              aria-hidden="true"
              className={s.checkIcon}
              style={{
                background: c.ok ? 'var(--green-bg)' : 'var(--orange-bg)',
                color: c.ok ? 'var(--green)' : 'var(--orange)',
              }}
            >
              {c.ok ? '✓' : '!'}
            </span>
            <span>{c.label}</span>
          </div>
        ))}
      </section>

      {request.status === 'requested' && (
        <section className={s.action}>
          <h3 className={s.actionTitle}>Decide</h3>
          <div className={s.actionRow}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Approve as</span>
            <div role="group" aria-label="Resolution" className={s.segGroup}>
              {typeOptions.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={type === k}
                  onClick={() => setType(k)}
                  className={`${s.seg} ${type === k ? s.segOn : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                void run(
                  () => returns.approve(request.id, type),
                  `${request.id}: approved`,
                )
              }
              className={s.approve}
            >
              Approve
            </button>
          </div>
          <div className={s.rejectRow}>
            <input
              aria-label="Reason for rejecting"
              value={reject}
              onChange={(ev) => setReject(ev.target.value)}
              placeholder="Reason, if you reject (sent to the customer)"
              className={s.rejectInput}
            />
            <button
              type="button"
              onClick={() =>
                void run(
                  () => returns.reject(request.id, reject),
                  `${request.id}: rejected`,
                )
              }
              className={s.reject}
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {request.status === 'approved' && (
        <section className={s.action}>
          <h3 className={s.actionTitle}>Schedule a pickup</h3>
          <div className={s.twoCol}>
            <select
              aria-label="Courier"
              value={courier}
              onChange={(ev) => setCourier(ev.target.value)}
              className={f.select}
            >
              {(config.couriers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Pickup date"
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
              className={f.input}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              void run(
                () =>
                  returns.schedulePickup(
                    request.id,
                    courier,
                    date,
                    courierName(courier),
                    fD(date),
                  ),
                `${request.id}: pickup scheduled`,
              )
            }
            className={s.approve}
            style={{ alignSelf: 'flex-start' }}
          >
            Confirm pickup
          </button>
        </section>
      )}

      {request.status === 'pickup' && (
        <section className={s.action}>
          <h3 className={s.actionTitle}>
            Pickup:{' '}
            {request.pickup
              ? `${courierName(request.pickup.courier)} · ${fD(request.pickup.date)}`
              : ''}
          </h3>
          <div className={s.toggleRow}>
            <span className={s.toggleText}>
              <span className={s.toggleTitle}>Add back to stock</span>
              <span className={s.toggleSub}>
                Only if the piece came back unused and undamaged.
              </span>
            </span>
            <Switch on={restock} onChange={setRestock} label="Add back to stock" />
          </div>
          <button
            type="button"
            onClick={() =>
              void run(() => returns.receive(request.id, restock), 'Marked as received')
            }
            className={s.approve}
            style={{ alignSelf: 'flex-start' }}
          >
            Mark item received
          </button>
        </section>
      )}

      {request.status === 'received' && (
        <section className={s.action}>
          {request.type === 'replacement' ? (
            <>
              <h3 className={s.actionTitle}>Send the replacement</h3>
              <div className={s.twoCol}>
                <select
                  aria-label="Replacement colour"
                  value={vid}
                  onChange={(ev) => setVid(ev.target.value)}
                  className={f.select}
                >
                  {(product?.variants ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {colorLabel(v.color)} · {v.stock} in stock
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Tracking number"
                  value={awb}
                  onChange={(ev) => setAwb(ev.target.value)}
                  placeholder="Tracking number (optional)"
                  className={f.input}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => returns.sendReplacement(request.id, vid, awb),
                    'Replacement sent. Stock updated.',
                  )
                }
                className={s.approve}
                style={{ alignSelf: 'flex-start' }}
              >
                Replacement sent
              </button>
            </>
          ) : (
            <>
              <h3 className={s.actionTitle}>Record the refund</h3>
              <div className={s.twoCol}>
                <label className={s.amountBox}>
                  <span className={s.amountRupee}>₹</span>
                  <input
                    aria-label="Refund amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(ev) => setAmount(ev.target.value.replace(/\D/g, ''))}
                    className={s.amountInput}
                  />
                </label>
                <select
                  aria-label="Refund method"
                  value={method}
                  onChange={(ev) => setMethod(ev.target.value)}
                  className={f.select}
                >
                  {REFUND_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => returns.refund(request.id, Number(amount), method),
                    'Refund recorded',
                  )
                }
                className={s.approve}
                style={{ alignSelf: 'flex-start' }}
              >
                Refund done
              </button>
            </>
          )}
        </section>
      )}

      <section className={d.section}>
        <h3 className={d.h3}>History</h3>
        {request.history
          .slice()
          .reverse()
          .map((h, i) => (
            <div key={i} className={d.historyRow}>
              <span className={d.historyAt}>{fDT(h.at)}</span>
              <span>
                {h.note ||
                  RETURN_STATUS[h.status as keyof typeof RETURN_STATUS]?.text ||
                  h.status}
              </span>
            </div>
          ))}
      </section>

      <span className={d.payText}>
        {RETURN_TYPE[request.type].text} · raised {fD(request.createdAt)}
      </span>
    </Drawer>
  );
}
