import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, gst, type InvoiceQuery, type InvoiceRow } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { fD, fDT, inr, inrPaise, plural } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { GstTabs } from './GstTabs';
import s from './gst.module.css';

const GREEN = { background: 'var(--green-bg)', color: 'var(--green)' };
const GREY = { background: 'var(--neutral-bg)', color: 'var(--neutral)' };
const AMBER = { background: 'var(--orange-bg)', color: 'var(--orange)' };

const issueText = (i: unknown): string => {
  if (typeof i === 'string') return i;
  const o = (i ?? {}) as { name?: string; problem?: string };
  return [o.name, o.problem].filter(Boolean).join(': ') || 'Not ready for a tax invoice';
};

const errText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? (Object.values(e.fields ?? {})[0] ?? e.message) : fallback;

async function openPdf(fn: () => Promise<void>, flash: (t: string) => void) {
  try { await fn(); } catch (e) { flash(errText(e, 'Could not open the PDF')); }
}

export function InvoicesPage() {
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const [filters, setFilters] = useState<InvoiceQuery>({ q: '', from: '', to: '', status: '' });
  const [viewId, setViewId] = useState<number | null>(null);
  const [cnFor, setCnFor] = useState<InvoiceRow | null>(null);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<Record<string, string>>({});

  const { data } = useQuery({ queryKey: ['gst-invoices', filters], queryFn: () => gst.invoices(filters) });
  const { data: pending = [] } = useQuery({ queryKey: ['gst-pending'], queryFn: gst.pending });
  const rows = data?.rows ?? [];
  const sum = data?.summary;
  const hasFilters = !!(filters.q || filters.from || filters.to || filters.status);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['gst-invoices'] });
    void qc.invalidateQueries({ queryKey: ['gst-pending'] });
    void qc.invalidateQueries({ queryKey: ['gst-invoice'] });
    void qc.invalidateQueries({ queryKey: ['gst-order-invoice'] });
  };

  const generate = async (orderId: string) => {
    setGenBusy(orderId);
    setGenErr((m) => ({ ...m, [orderId]: '' }));
    try {
      const inv = await gst.generate(orderId);
      flash(`Invoice ${inv.invoiceNo} issued`);
      refresh();
    } catch (e) {
      setGenErr((m) => ({ ...m, [orderId]: e instanceof ApiError ? e.message : 'Could not generate the invoice' }));
    } finally {
      setGenBusy(null);
    }
  };

  const cards = [
    ['Invoices', String(sum?.count ?? 0)],
    ['Taxable value', inrPaise(sum?.taxablePaise ?? 0)],
    ['GST', inrPaise(sum?.taxPaise ?? 0)],
    ['Total', inrPaise(sum?.grandTotalPaise ?? 0)],
  ];

  return (
    <>
      <PageHeader title="GST & Invoices" sub="Tax invoices, credit notes and orders awaiting an invoice." />
      <div className={`${s.screen} ${s.wide}`}>
        <GstTabs />

        {pending.length > 0 && (
          <section className={s.card} aria-label="Awaiting invoice">
            <h2 className={s.h2}>Awaiting invoice ({pending.length})</h2>
            <p className={s.note}>
              Paid orders with no tax invoice yet. Invoices are normally issued at dispatch; use this for
              orders placed before GST invoicing was switched on or ones that were blocked.
            </p>
            <div className={s.scroll}>
              <table className={s.table} style={{ minWidth: 640 }}>
                <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th className={s.num}>Total</th><th>Why waiting</th><th /></tr></thead>
                <tbody>
                  {pending.map((o) => (
                    <tr key={o.orderId}>
                      <td className={s.strong}>{o.orderId}</td>
                      <td>{o.customer || '—'}</td>
                      <td>{fD(o.createdAt)}</td>
                      <td className={s.num}>{inr(o.total)}</td>
                      <td>
                        {o.issues.length > 0
                          ? o.issues.map((i, k) => <div key={k} className={s.meta} style={{ color: 'var(--orange)' }}>{issueText(i)}</div>)
                          : <span className={s.meta}>{o.status === 'delivered' || o.status === 'shipped' ? 'Not issued yet' : 'Issued at dispatch'}</span>}
                        {genErr[o.orderId] && <div role="alert" className={f.error}>{genErr[o.orderId]}</div>}
                      </td>
                      <td>
                        <button type="button" className={`${s.btn} ${s.btnSm}`} disabled={genBusy === o.orderId} onClick={() => void generate(o.orderId)}>
                          {genBusy === o.orderId ? 'Generating…' : 'Generate invoice'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className={s.filters}>
          <input type="search" aria-label="Search invoices" className={f.input} placeholder="Invoice no., order no. or customer" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <label className={f.label}>From<input type="date" className={f.input} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
          <label className={f.label}>To<input type="date" className={f.input} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
          <label className={f.label}>Status
            <select className={f.select} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as InvoiceQuery['status'] })}>
              <option value="">Any status</option><option value="issued">Issued</option><option value="cancelled">Cancelled</option>
            </select>
          </label>
          {hasFilters && <button type="button" className={s.btn} style={{ alignSelf: 'end' }} onClick={() => setFilters({ q: '', from: '', to: '', status: '' })}>Reset filters</button>}
        </div>

        <div className={s.sumGrid}>
          {cards.map(([l, v]) => (
            <div key={l} className={s.sumCard}><span className={s.sumLabel}>{l}</span><span className={s.sumValue}>{v}</span></div>
          ))}
        </div>
        <p className={s.note} style={{ marginTop: -8 }}>Taxable, GST and total exclude cancelled invoices.</p>

        <div className={s.tableCard}>
          <div className={s.scroll}>
            <table className={s.table} style={{ minWidth: 1250 }}>
              <thead>
                <tr>
                  <th>Invoice</th><th>Order</th><th>Customer</th><th>Date</th><th>Place of supply</th><th>Tax</th>
                  <th className={s.num}>Taxable</th><th className={s.num}>GST</th><th className={s.num}>Total</th>
                  <th>Payment</th><th>Status</th><th>Credit notes</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={s.strong}>{r.invoiceNo}</td>
                    <td>{r.orderId}</td>
                    <td>{r.customer || '—'}</td>
                    <td>{fD(r.issuedAt)}</td>
                    <td>{r.placeOfSupply} - {r.placeOfSupplyName}</td>
                    <td>{r.taxTypeLabel}</td>
                    <td className={s.num}>{inrPaise(r.taxablePaise)}</td>
                    <td className={s.num}>{inrPaise(r.taxPaise)}</td>
                    <td className={s.num}>{inrPaise(r.grandTotalPaise)}</td>
                    <td><span className={s.pill} style={r.payStatus === 'paid' ? GREEN : GREY}>{r.payStatus}</span></td>
                    <td><span className={s.pill} style={r.status === 'cancelled' ? AMBER : GREEN}>{r.status === 'cancelled' ? 'Cancelled' : 'Issued'}</span></td>
                    <td>{r.creditNotes.length}</td>
                    <td>
                      <span className={s.actions}>
                        <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setViewId(r.id)} aria-label={`View ${r.invoiceNo}`}>View</button>
                        <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => void openPdf(() => gst.openInvoicePdf(r.id), flash)} aria-label={`Download PDF ${r.invoiceNo}`}>PDF</button>
                        {r.status === 'issued' && (
                          <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setCnFor(r)} aria-label={`Cancel or credit ${r.invoiceNo}`}>Cancel / credit</button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <EmptyState
              title={hasFilters ? 'No invoices match these filters' : 'No invoices yet'}
              body={hasFilters ? 'Try a wider date range or clear the search.' : 'A tax invoice is issued when an order is dispatched, once GST invoicing is active.'}
              onAction={hasFilters ? () => setFilters({ q: '', from: '', to: '', status: '' }) : undefined}
              actionLabel="Reset filters"
            />
          )}
        </div>
        <span className={s.meta}>{plural(rows.length, 'invoice')} shown</span>
      </div>

      {viewId !== null && <InvoiceDrawer id={viewId} onClose={() => setViewId(null)} onCredit={(r) => setCnFor(r)} rows={rows} />}
      {cnFor && <CreditNoteModal inv={cnFor} onClose={() => setCnFor(null)} onDone={() => { setCnFor(null); refresh(); }} />}
    </>
  );
}

/* ---------------------------------------------------------------- detail drawer */

const str = (v: unknown): string => (v == null ? '' : String(v));
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function PartyBlock({ title, p }: { title: string; p: Record<string, unknown> }) {
  return (
    <div className={s.sec}>
      <h3 className={s.h2}>{title}</h3>
      <div className={s.addr}>
        <b>{str(p.legalName || p.name)}</b>
        {p.tradeName ? <><br />{str(p.tradeName)}</> : null}
        {p.gstin ? <><br />GSTIN {str(p.gstin)}</> : null}
        {(() => {
          const a = rec(p.address);
          const line = typeof p.address === 'string'
            ? [p.address, p.city, p.state, p.pin]
            : [a.line1, a.line2, a.city, a.pin, p.state];
          return <><br />{line.filter(Boolean).join(', ')}</>;
        })()}
        {p.phone ? <><br />{str(p.phone)}</> : null}
      </div>
    </div>
  );
}

function InvoiceDrawer({ id, onClose, onCredit, rows }: { id: number; onClose: () => void; onCredit: (r: InvoiceRow) => void; rows: InvoiceRow[] }) {
  const flash = useUi((st) => st.flash);
  const { data } = useQuery({ queryKey: ['gst-invoice', id], queryFn: () => gst.invoice(id) });
  const inv = data?.invoice;
  const row = rows.find((r) => r.id === id);
  const t = rec(inv?.totals);
  const cust = rec(inv?.customer);

  return (
    <Drawer
      label={`Invoice ${inv?.invoiceNo ?? ''}`}
      onClose={onClose}
      header={
        <>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{inv?.invoiceNo ?? 'Invoice'}</span>
          {inv && <span className={s.meta}>Order {inv.orderId} · {fDT(inv.issuedAt)} · <span className={s.pill} style={inv.status === 'cancelled' ? AMBER : GREEN}>{inv.status === 'cancelled' ? 'Cancelled' : 'Issued'}</span></span>}
        </>
      }
      footer={inv && (
        <>
          <button type="button" className={s.btn} onClick={() => void openPdf(() => gst.openInvoicePdf(inv.id), flash)}>Download PDF</button>
          {inv.status === 'issued' && row && <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => onCredit(row)}>Cancel / credit note</button>}
        </>
      )}
    >
      {!inv ? <p className={s.note}>Loading…</p> : (
        <>
          {inv.status === 'cancelled' && (
            <div className={`${s.banner} ${s.bannerWarn}`}>Cancelled{inv.cancelledAt ? ` on ${fDT(inv.cancelledAt)}` : ''}{inv.cancelReason ? `: ${inv.cancelReason}` : ''}. The invoice itself is unchanged; a credit note records the cancellation.</div>
          )}
          {inv.legacy && <p className={s.note}>Imported or manually issued invoice.</p>}
          <div className={s.twoCol}>
            <PartyBlock title="Supplier" p={rec(inv.supplier)} />
            <div className={s.sec}>
              <h3 className={s.h2}>Supply</h3>
              <div className={s.addr}>
                Place of supply: {inv.placeOfSupply}<br />
                {inv.taxType === 'intra' ? 'CGST + SGST' : 'IGST'}<br />
                Prices {inv.priceMode}{inv.reverseCharge ? ' · reverse charge' : ''}
              </div>
            </div>
            <PartyBlock title="Bill to" p={rec(cust.billing)} />
            <PartyBlock title="Ship to" p={rec(cust.shipping)} />
          </div>

          <div className={s.scroll}>
            <table className={s.table} style={{ minWidth: 640 }}>
              <thead><tr><th>Item</th><th>HSN</th><th className={s.num}>Qty</th><th className={s.num}>Taxable</th><th className={s.num}>Rate</th><th className={s.num}>CGST</th><th className={s.num}>SGST</th><th className={s.num}>IGST</th><th className={s.num}>Total</th></tr></thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{str(l.name)}<div className={s.meta}>{str(l.sku)}</div></td>
                    <td className={s.mono}>{str(l.hsn) || '—'}</td>
                    <td className={s.num}>{str(l.qty)}</td>
                    <td className={s.num}>{inrPaise(l.taxablePaise)}</td>
                    <td className={s.num}>{Number(l.rateBp) / 100}%</td>
                    <td className={s.num}>{inrPaise(l.cgstPaise)}</td>
                    <td className={s.num}>{inrPaise(l.sgstPaise)}</td>
                    <td className={s.num}>{inrPaise(l.igstPaise)}</td>
                    <td className={s.num}>{inrPaise(l.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={s.lines}>
            {([['Taxable value', t.taxable], ['CGST', t.cgst], ['SGST', t.sgst], ['IGST', t.igst], ['Round off', t.roundOff]] as [string, unknown][])
              .filter(([k, v]) => (k === 'Taxable value' || Number(v)) )
              .map(([k, v]) => <div key={k} className={s.kv}><span>{k}</span><span className={s.num}>{inrPaise(v)}</span></div>)}
            <div className={s.kv} style={{ fontWeight: 600, fontSize: 15 }}><span>Grand total</span><span>{inrPaise(t.grandTotal)}</span></div>
            <div className={s.kv}><span className={s.meta}>Received</span><span className={s.meta}>{inrPaise(t.receivedPaise)}</span></div>
          </div>

          <div className={s.sec}>
            <h3 className={s.h2}>Credit notes ({data.creditNotes.length})</h3>
            {data.creditNotes.length === 0 && <span className={s.meta}>None.</span>}
            {data.creditNotes.map((n) => (
              <div key={n.id} className={s.kv}>
                <span><b>{n.noteNo}</b> · {n.kind} · {fD(n.issuedAt)}<div className={s.meta}>{n.reason}</div></span>
                <span className={s.actions}>
                  <span>{inrPaise(n.totalPaise)}</span>
                  <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => void openPdf(() => gst.openCreditNotePdf(n.id), flash)}>PDF</button>
                </span>
              </div>
            ))}
          </div>

          <div className={s.sec}>
            <h3 className={s.h2}>Audit events</h3>
            {data.events.map((e, i) => (
              <div key={i} className={s.event}>
                <span className={s.meta} style={{ whiteSpace: 'nowrap' }}>{fDT(e.at)}</span>
                <span>{e.event} <span className={s.meta}>by {e.actor}</span></span>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ---------------------------------------------------------------- credit note */

function CreditNoteModal({ inv, onClose, onDone }: { inv: InvoiceRow; onClose: () => void; onDone: () => void }) {
  const flash = useUi((st) => st.flash);
  const [kind, setKind] = useState<'cancellation' | 'refund'>('cancellation');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const left = (inv.grandTotalPaise - inv.creditedPaise) / 100;

  const submit = async () => {
    setErr('');
    const amt = Number(amount);
    if (reason.trim().length < 3) return setErr('Give a reason');
    if (kind === 'refund' && !(amt > 0)) return setErr('Enter the amount to credit, in rupees');
    setBusy(true);
    try {
      const r = await gst.creditNote(inv.id, { kind, reason: reason.trim(), ...(kind === 'refund' ? { amount: amt } : {}) });
      flash(`Credit note ${r.noteNo} issued${r.cancelled ? '; invoice cancelled' : ''}`);
      onDone();
    } catch (e) {
      setErr(errText(e, 'Could not issue the credit note'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${kind === 'cancellation' ? 'Cancel' : 'Credit'} ${inv.invoiceNo}`}
      onClose={onClose}
      maxWidth={520}
      footer={
        <>
          <button type="button" className={s.btn} onClick={onClose}>Keep invoice</button>
          <button type="button" className={`${s.btn} ${s.btnDanger}`} disabled={busy || !ack} onClick={() => void submit()}>
            {kind === 'cancellation' ? 'Issue cancellation credit note' : 'Issue credit note'}
          </button>
        </>
      }
    >
      <div className={s.lines}>
        <div className={`${s.banner} ${s.bannerInfo}`}>
          An issued invoice is never edited or deleted. Instead a credit note is issued against it, with
          its own number, and that number is never reused. Order {inv.orderId} is not changed by this;
          refund the customer separately.
        </div>
        <div className={s.row} role="group" aria-label="Type">
          <button type="button" aria-pressed={kind === 'cancellation'} className={`${s.btn} ${s.btnSm}`} style={kind === 'cancellation' ? { background: 'var(--ink)', color: 'var(--surface)' } : undefined} onClick={() => setKind('cancellation')}>Cancel whole invoice</button>
          <button type="button" aria-pressed={kind === 'refund'} className={`${s.btn} ${s.btnSm}`} style={kind === 'refund' ? { background: 'var(--ink)', color: 'var(--surface)' } : undefined} onClick={() => setKind('refund')}>Partial refund</button>
        </div>
        <label className={f.label}>Reason (required)
          <input className={f.input} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {kind === 'refund' && (
          <label className={f.label}>Amount to credit (₹, GST-inclusive)
            <input className={f.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className={f.hint}>Invoice total {inrPaise(inv.grandTotalPaise)}; about ₹{left.toFixed(2)} not yet credited. The system splits it into taxable value and GST.</span>
          </label>
        )}
        <label className={s.check}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I understand this issues a permanent credit note.
        </label>
        {err && <span role="alert" className={f.error}>{err}</span>}
      </div>
    </Modal>
  );
}
