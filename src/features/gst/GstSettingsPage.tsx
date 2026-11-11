import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, gst, type GstSettings, type GstSettingsInput } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { fDT } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { GstTabs } from './GstTabs';
import s from './gst.module.css';

const toInput = (g: GstSettings): GstSettingsInput => ({
  registered: g.registered, gstin: g.gstin, legalName: g.legalName, tradeName: g.tradeName,
  address: { ...g.address }, stateCode: g.stateCode, phone: g.phone, email: g.email,
  invoicePrefix: g.invoicePrefix, priceMode: g.priceMode, rounding: g.rounding,
  roundOffToRupee: g.roundOffToRupee, reverseCharge: g.reverseCharge, template: { ...g.template },
});

const identity = (g: GstSettingsInput) =>
  JSON.stringify([g.registered, g.gstin.trim().toUpperCase(), g.legalName.trim(), g.tradeName.trim(),
    [g.address.line1, g.address.line2, g.address.city, g.address.pin].map((x) => x.trim()), g.stateCode]);

export function GstSettingsPage() {
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);
  const { data: view } = useQuery({ queryKey: ['gst-settings'], queryFn: gst.settings });
  const { data: seq } = useQuery({ queryKey: ['gst-sequence'], queryFn: gst.sequence });
  const { data: comp } = useQuery({ queryKey: ['gst-compliance'], queryFn: gst.compliance });

  const [draft, setDraft] = useState<GstSettingsInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  const [seqVal, setSeqVal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (view && !draft) setDraft(toInput(view.settings));
  }, [view, draft]);

  if (!view || !draft) return null;
  const g = view.settings;
  const set = (patch: Partial<GstSettingsInput>) => setDraft({ ...draft, ...patch });
  const setAddr = (patch: Partial<GstSettingsInput['address']>) =>
    setDraft({ ...draft, address: { ...draft.address, ...patch } });
  const setTpl = (patch: Partial<GstSettingsInput['template']>) =>
    setDraft({ ...draft, template: { ...draft.template, ...patch } });
  const err = (k: string) => errors[k];
  const Err = ({ k }: { k: string }) =>
    err(k) ? <span role="alert" className={f.error}>{err(k)}</span> : null;
  const bad = (k: string) => (err(k) ? { borderColor: 'var(--red-line)' } : undefined);

  const identityChanged = identity(draft) !== identity(toInput(g));
  const exclusive = draft.priceMode === 'exclusive';

  const applyView = (v: typeof view) => {
    qc.setQueryData(['gst-settings'], v);
    setDraft(toInput(v.settings));
  };

  const save = async () => {
    setBusy(true);
    try {
      const v = await gst.saveSettings({ ...draft, gstin: draft.gstin.trim().toUpperCase(),
        invoicePrefix: draft.invoicePrefix.trim().toUpperCase() });
      setErrors({});
      applyView(v);
      flash(g.verified && !v.settings.verified ? 'Saved. Verification was cleared; please verify again.' : 'GST settings saved');
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields ?? {});
        flash(e.message);
        if (!e.fields) setErrors({ invoicePrefix: e.status === 409 ? e.message : '' });
      } else flash('Could not save GST settings');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setVerifyErr('');
    try {
      applyView(await gst.verify(note.trim()));
      setConfirmed(false);
      setNote('');
      flash('GSTIN verification recorded');
    } catch (e) {
      setVerifyErr(e instanceof ApiError ? (e.fields?.note ?? e.message) : 'Could not record verification');
    }
  };

  const unverify = () =>
    ask({
      title: 'Remove verification?',
      text: 'Invoicing will be locked until the GSTIN is verified again.',
      ok: 'Remove verification',
      run: () => void gst.unverify().then(applyView).catch((e: unknown) => flash(e instanceof Error ? e.message : 'Failed')),
    });

  const seqOf = (series: 'INV' | 'CN') => seq?.sequences.find((x) => x.series === series && x.fy === seq.currentFy)?.lastNo ?? 0;
  const moveSeq = (series: 'INV' | 'CN') => {
    const n = Number(seqVal[series]);
    if (!Number.isInteger(n) || n < 0) return flash('Enter a whole number');
    ask({
      title: `Continue ${series} numbering from ${n}?`,
      text: `The next ${series === 'INV' ? 'invoice' : 'credit note'} in ${seq?.currentFy} will be number ${n + 1}. This can never be moved back.`,
      ok: 'Move forward',
      run: () =>
        void gst.setSequence(series, n)
          .then(() => { void qc.invalidateQueries({ queryKey: ['gst-sequence'] }); setSeqVal({ ...seqVal, [series]: '' }); flash('Numbering updated'); })
          .catch((e: unknown) => flash(e instanceof Error ? e.message : 'Failed')),
    });
  };

  const st = view.status;
  return (
    <>
      <PageHeader
        title="GST & Invoices"
        sub="Supplier details, numbering and tax invoice settings."
        actions={[{ label: busy ? 'Saving…' : 'Save GST settings', onClick: () => void save(), primary: true, disabled: busy }]}
      />
      <div className={s.screen}>
        <GstTabs />

        {st.active ? (
          <div className={`${s.banner} ${s.bannerOk}`} role="status">
            <span className={s.bannerTitle}>GST invoicing is active</span>
            Tax invoices are issued when an order is dispatched.
          </div>
        ) : (
          <div className={`${s.banner} ${s.bannerWarn}`} role="alert">
            <span className={s.bannerTitle}>Invoicing locked because…</span>
            <ul>{st.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}

        <section className={s.card}>
          <h2 className={s.h2}>Supplier details</h2>
          <p className={s.note}>
            Enter the legal name and address exactly as shown on the GST portal record. The GSTIN
            below is only a candidate read from sample invoices — it is not verified.
          </p>
          <label className={s.check}>
            <input type="checkbox" checked={draft.registered} onChange={(e) => set({ registered: e.target.checked })} />
            The business is registered under GST
          </label>
          <div className={s.grid}>
            <label className={f.label}>GSTIN
              <input className={`${f.input} ${s.mono}`} maxLength={15} value={draft.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} style={bad('gstin')} />
              <Err k="gstin" />
            </label>
            <label className={f.label}>State of registration
              <select className={f.select} value={draft.stateCode} onChange={(e) => set({ stateCode: e.target.value })} style={bad('stateCode')}>
                <option value="">Choose a state</option>
                {view.states.map((x) => <option key={x.code} value={x.code}>{x.code} - {x.name}</option>)}
              </select>
              <Err k="stateCode" />
            </label>
            <label className={f.label}>Legal name
              <input className={f.input} maxLength={200} value={draft.legalName} onChange={(e) => set({ legalName: e.target.value })} placeholder="As on the GST registration" />
            </label>
            <label className={f.label}>Trade name
              <input className={f.input} maxLength={200} value={draft.tradeName} onChange={(e) => set({ tradeName: e.target.value })} />
            </label>
            <label className={f.label}>Address line 1
              <input className={f.input} maxLength={200} value={draft.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} />
            </label>
            <label className={f.label}>Address line 2
              <input className={f.input} maxLength={200} value={draft.address.line2} onChange={(e) => setAddr({ line2: e.target.value })} />
            </label>
            <label className={f.label}>City
              <input className={f.input} maxLength={100} value={draft.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
            </label>
            <label className={f.label}>PIN code
              <input className={f.input} inputMode="numeric" maxLength={6} value={draft.address.pin} onChange={(e) => setAddr({ pin: e.target.value })} style={bad('address.pin')} />
              <Err k="address.pin" />
            </label>
            <label className={f.label}>Phone
              <input className={f.input} maxLength={20} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label className={f.label}>Email
              <input className={f.input} type="email" maxLength={200} value={draft.email} onChange={(e) => set({ email: e.target.value })} style={bad('email')} />
              <Err k="email" />
            </label>
          </div>
          {identityChanged && g.verified && (
            <div className={`${s.banner} ${s.bannerWarn}`} role="alert">
              Changing registration, GSTIN, names, address or state removes the GST portal
              verification when you save. You will need to verify again before invoices can be issued.
            </div>
          )}
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Verification</h2>
          {g.verified ? (
            <>
              <div className={`${s.banner} ${s.bannerOk}`}>
                <span className={s.bannerTitle}>Verified on the GST portal</span>
                <span>By {g.verifiedBy || 'an admin'}{g.verifiedAt ? ` on ${fDT(g.verifiedAt)}` : ''}.</span>
                {g.verificationNote && <span>Note: {g.verificationNote}</span>}
              </div>
              <div className={s.row}>
                <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={unverify}>Remove verification</button>
              </div>
            </>
          ) : (
            <>
              <p className={s.note}>
                Look up the GSTIN on the official GST portal (services.gst.gov.in → Search Taxpayer)
                and check that it is active and that the legal name, trade name, state and address
                above match the portal record. Save any changes first, then confirm here.
              </p>
              {identityChanged && <p className={s.note} role="status">You have unsaved changes. Save them before verifying.</p>}
              <label className={s.check}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I checked this GSTIN on the GST portal and the details above match the portal record.
              </label>
              <label className={f.label}>Where and when you checked (required)
                <input className={f.input} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. services.gst.gov.in, 10 Nov 2026, status Active" />
              </label>
              {verifyErr && <span role="alert" className={f.error}>{verifyErr}</span>}
              <div className={s.row}>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!confirmed || note.trim().length < 5 || identityChanged} onClick={() => void verify()}>
                  Record verification
                </button>
              </div>
            </>
          )}
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Invoice numbering</h2>
          <label className={f.label} style={{ maxWidth: 240 }}>Invoice prefix
            <input className={`${f.input} ${s.mono}`} maxLength={4} value={draft.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase() })} style={bad('invoicePrefix')} />
            <span className={f.hint}>1–4 capital letters, digits or hyphens. Cannot change after the first invoice is issued.</span>
            <Err k="invoicePrefix" />
          </label>
          <div className={`${s.banner} ${s.bannerInfo}`}>
            The sample invoices were numbered 99 by another billing app. If the business has already
            issued invoices elsewhere this financial year, ask the owner or CA whether numbering should
            continue from that number. The series can only be moved forward, never back, so a number is never reused.
          </div>
          {seq && (
            <div className={s.grid}>
              {(['INV', 'CN'] as const).map((series) => (
                <div key={series} className={s.sec}>
                  <span className={s.strong}>{series === 'INV' ? 'Invoices' : 'Credit notes'} · FY {seq.currentFy}</span>
                  <span className={s.meta}>Last number used: {seqOf(series)}</span>
                  <div className={s.seqRow}>
                    <label className={f.label} style={{ flex: 1 }}>Continue from (last used)
                      <input className={f.input} inputMode="numeric" value={seqVal[series] ?? ''} onChange={(e) => setSeqVal({ ...seqVal, [series]: e.target.value.replace(/\D/g, '') })} placeholder={String(seqOf(series))} />
                    </label>
                    <button type="button" className={s.btn} disabled={!seqVal[series] || Number(seqVal[series]) < seqOf(series)} onClick={() => moveSeq(series)}>Set</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Pricing & rounding</h2>
          <div className={s.grid}>
            <label className={f.label}>Prices in the shop are
              <select className={f.select} value={draft.priceMode} onChange={(e) => set({ priceMode: e.target.value as 'inclusive' | 'exclusive', roundOffToRupee: e.target.value === 'exclusive' ? true : draft.roundOffToRupee })}>
                <option value="inclusive">GST inclusive</option>
                <option value="exclusive">GST exclusive (added on top)</option>
              </select>
            </label>
            <label className={f.label}>Rounding policy
              <select className={f.select} value={draft.rounding} onChange={(e) => set({ rounding: e.target.value as 'line' | 'invoice' })}>
                <option value="line">Round tax per line</option>
                <option value="invoice">Round tax on the invoice total</option>
              </select>
            </label>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={exclusive || draft.roundOffToRupee} disabled={exclusive} onChange={(e) => set({ roundOffToRupee: e.target.checked })} />
            Round the grand total off to the nearest rupee{exclusive ? ' (always on when prices are exclusive)' : ''}
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={draft.reverseCharge} onChange={(e) => set({ reverseCharge: e.target.checked })} />
            Tax is payable on reverse charge
          </label>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Invoice template</h2>
          <label className={f.label}>Terms
            <textarea className={f.textarea} rows={3} maxLength={1000} value={draft.template.terms} onChange={(e) => setTpl({ terms: e.target.value })} />
          </label>
          <div className={s.grid}>
            <label className={f.label}>Footer note
              <input className={f.input} maxLength={300} value={draft.template.footerNote} onChange={(e) => setTpl({ footerNote: e.target.value })} />
            </label>
            <label className={f.label}>Signature text
              <input className={f.input} maxLength={60} value={draft.template.signatureText} onChange={(e) => setTpl({ signatureText: e.target.value })} />
            </label>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={draft.template.showSignature} onChange={(e) => setTpl({ showSignature: e.target.checked })} />
            Show the signature block
          </label>
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => void save()} disabled={busy}>Save GST settings</button>
          </div>
        </section>

        {comp && (
          <section className={s.card}>
            <h2 className={s.h2}>Compliance notes</h2>
            <p className={s.note}>Guidance checked on {comp.verifiedOn}. Confirm with your CA.</p>
            {comp.items.map((it) => (
              <div key={it.topic} className={s.sec}>
                <span className={s.strong}>
                  {it.topic}{' '}
                  <span className={s.pill} style={it.applicable === true
                    ? { background: 'var(--green-bg)', color: 'var(--green)' }
                    : it.applicable === 'conditional'
                      ? { background: 'var(--amber-bg)', color: 'var(--amber)' }
                      : { background: 'var(--neutral-bg)', color: 'var(--neutral)' }}>
                    {it.applicable === true ? 'Applies' : it.applicable === 'conditional' ? 'Conditional' : 'Not applicable'}
                  </span>
                </span>
                <span className={s.note}>{it.why}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
