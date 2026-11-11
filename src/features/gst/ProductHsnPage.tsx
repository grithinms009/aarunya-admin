import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, bpToPct, gst, pctToBp, type BulkInput, type HsnProduct } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { inr, plural } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { GstTabs } from './GstTabs';
import s from './gst.module.css';

interface Edit { hsn: string; pct: string; verified: boolean; note: string }

export function ProductHsnPage() {
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const ask = useUi((st) => st.ask);
  const { data } = useQuery({ queryKey: ['gst-products'], queryFn: gst.products });

  const [filter, setFilter] = useState<'all' | 'issues'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit>({ hsn: '', pct: '', verified: false, note: '' });
  const [editErr, setEditErr] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ hsn: '', pct: '', verified: false, category: '' });
  const [bulkErr, setBulkErr] = useState('');
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const shown = filter === 'issues' ? items.filter((i) => i.issue) : items;

  const refresh = () => void qc.invalidateQueries({ queryKey: ['gst-products'] });

  const startEdit = (p: HsnProduct) => {
    setEditing(p.id);
    setEditErr('');
    setEdit({ hsn: p.hsn ?? '', pct: bpToPct(p.gstRateBp), verified: p.status === 'verified', note: p.note ?? '' });
  };

  const saveEdit = async (p: HsnProduct) => {
    const bp = pctToBp(edit.pct);
    if (Number.isNaN(bp)) return setEditErr('Enter the rate as a percentage, e.g. 3');
    setBusy(true);
    setEditErr('');
    try {
      await gst.saveProduct(p.id, { hsn: edit.hsn.trim(), gstRateBp: bp, verified: edit.verified, note: edit.note.trim() });
      setEditing(null);
      refresh();
      flash(`${p.name} saved`);
    } catch (e) {
      setEditErr(e instanceof ApiError ? Object.values(e.fields ?? {})[0] ?? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id); else n.add(id);
    setPicked(n);
  };
  const allShownPicked = shown.length > 0 && shown.every((p) => picked.has(p.id));
  const togglePage = () => {
    const n = new Set(picked);
    shown.forEach((p) => (allShownPicked ? n.delete(p.id) : n.add(p.id)));
    setPicked(n);
  };

  /* Step 1: preview only. Step 2 (after an explicit dialog): apply with confirm + count. */
  const previewBulk = async () => {
    setBulkErr('');
    const bp = pctToBp(bulk.pct);
    if (bp == null || Number.isNaN(bp)) return setBulkErr('Enter the GST rate as a percentage');
    if (!bulk.hsn.trim()) return setBulkErr('Enter the HSN code');
    const ids = [...picked];
    if (!ids.length && !bulk.category) return setBulkErr('Select products in the table, or choose a category');
    const input: BulkInput = { hsn: bulk.hsn.trim(), gstRateBp: bp, verified: bulk.verified,
      ...(ids.length ? { ids } : { category: bulk.category }) };
    setBusy(true);
    try {
      const pv = await gst.bulkPreview(input);
      if (pv.count === 0) return setBulkErr('That selection contains no products.');
      const names = pv.products.slice(0, 5).join(', ') + (pv.count > 5 ? '…' : '');
      ask({
        title: `Apply HSN ${input.hsn} at ${bulk.pct}% to ${plural(pv.count, 'product')}?`,
        text: `This overwrites the HSN and GST rate of ${plural(pv.count, 'product')} (${names}), marked as ${bulk.verified ? 'VERIFIED' : 'not verified'}. Prices, SKUs and stock are not changed. Only confirm if you have checked the classification with your CA.`,
        ok: `Apply to ${pv.count}`,
        run: () =>
          void gst.bulkApply(input, pv.count)
            .then((r) => { flash(`Updated ${plural(r.updated, 'product')}`); setPicked(new Set()); refresh(); })
            .catch((e: unknown) => setBulkErr(e instanceof Error ? e.message : 'Bulk update failed')),
      });
    } catch (e) {
      setBulkErr(e instanceof ApiError ? Object.values(e.fields ?? {})[0] ?? e.message : 'Could not preview');
    } finally {
      setBusy(false);
    }
  };

  const need = data?.summary.needsAttention ?? 0;

  return (
    <>
      <PageHeader title="GST & Invoices" sub="HSN code and GST rate for every product." />
      <div className={`${s.screen} ${s.wide}`}>
        <GstTabs />

        {need > 0 && (
          <div className={`${s.banner} ${s.bannerWarn}`} role="alert">
            <span className={s.bannerTitle}>{plural(need, 'product')} need HSN/GST classification</span>
            Orders containing an unclassified product cannot get a tax invoice. Shown as "Needs attention" below.
            <div><button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setFilter('issues')}>Show only these</button></div>
          </div>
        )}

        <section className={s.card}>
          <h2 className={s.h2}>Reference — not a classification</h2>
          <ul className={s.note} style={{ paddingLeft: 18, margin: 0 }}>
            {(data?.reference ?? []).map((r) => (
              <li key={r.hsn}><b>{r.hsn}</b> — {r.desc}: tariff currently lists {bpToPct(r.rateBp)}%</li>
            ))}
          </ul>
          <p className={s.note}>
            Which heading applies (7113 genuine/precious-metal jewellery vs 7117 imitation jewellery)
            depends on the actual material of each piece. Confirm the classification with your CA.
            Nothing is assigned automatically.
          </p>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Bulk assign</h2>
          <p className={s.note}>
            Tick products in the table below (or leave all unticked and pick a category), enter the code,
            then preview. You will be asked to confirm the exact number of products before anything changes.
          </p>
          <div className={s.grid}>
            <label className={f.label}>HSN code
              <input className={`${f.input} ${s.mono}`} inputMode="numeric" maxLength={8} value={bulk.hsn} onChange={(e) => setBulk({ ...bulk, hsn: e.target.value.replace(/\D/g, '') })} placeholder="4, 6 or 8 digits" />
            </label>
            <label className={f.label}>GST rate (%)
              <input className={f.input} inputMode="decimal" value={bulk.pct} onChange={(e) => setBulk({ ...bulk, pct: e.target.value })} placeholder="e.g. 3" />
            </label>
            <label className={f.label}>Category (when nothing is ticked)
              <select className={f.select} value={bulk.category} onChange={(e) => setBulk({ ...bulk, category: e.target.value })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={bulk.verified} onChange={(e) => setBulk({ ...bulk, verified: e.target.checked })} />
            Mark as verified (only if you have confirmed this classification)
          </label>
          {bulkErr && <span role="alert" className={f.error}>{bulkErr}</span>}
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => void previewBulk()}>
              Preview{picked.size ? ` (${picked.size} selected)` : ''}
            </button>
            {picked.size > 0 && <button type="button" className={`${s.btn}`} onClick={() => setPicked(new Set())}>Clear selection</button>}
          </div>
        </section>

        <div className={s.row}>
          <button type="button" aria-pressed={filter === 'all'} className={`${s.btn} ${s.btnSm}`} style={filter === 'all' ? { background: 'var(--ink)', color: 'var(--surface)' } : undefined} onClick={() => setFilter('all')}>All ({items.length})</button>
          <button type="button" aria-pressed={filter === 'issues'} className={`${s.btn} ${s.btnSm}`} style={filter === 'issues' ? { background: 'var(--ink)', color: 'var(--surface)' } : undefined} onClick={() => setFilter('issues')}>Needs attention ({need})</button>
        </div>

        <div className={s.tableCard}>
          <div className={s.scroll}>
            <table className={s.table} style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" aria-label="Select all shown" checked={allShownPicked} onChange={togglePage} /></th>
                  <th>Product</th><th>Category</th><th>HSN</th><th className={s.num}>GST rate</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const on = editing === p.id;
                  return (
                    <tr key={p.id}>
                      <td><input type="checkbox" aria-label={`Select ${p.name}`} checked={picked.has(p.id)} onChange={() => toggle(p.id)} /></td>
                      <td>
                        <div className={s.strong}>{p.name}</div>
                        <div className={s.meta}>{[p.material, inr(p.price)].filter(Boolean).join(' · ')}</div>
                        {p.issue && <div className={s.meta} style={{ color: 'var(--orange)' }}>{p.issue}</div>}
                        {on && editErr && <div role="alert" className={f.error}>{editErr}</div>}
                      </td>
                      <td>{p.category}</td>
                      {on ? (
                        <>
                          <td>
                            <input aria-label="HSN" className={`${s.inlineIn} ${s.mono}`} inputMode="numeric" maxLength={8} value={edit.hsn} onChange={(e) => setEdit({ ...edit, hsn: e.target.value.replace(/\D/g, '') })} />
                          </td>
                          <td className={s.num}>
                            <input aria-label="GST rate percent" className={s.inlineIn} style={{ width: 80 }} inputMode="decimal" value={edit.pct} onChange={(e) => setEdit({ ...edit, pct: e.target.value })} /> %
                          </td>
                          <td>
                            <label className={s.check} style={{ fontSize: 13 }}>
                              <input type="checkbox" checked={edit.verified} onChange={(e) => setEdit({ ...edit, verified: e.target.checked })} /> Verified
                            </label>
                            <input aria-label="Note" className={s.inlineIn} placeholder="Note (e.g. confirmed with CA)" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                          </td>
                          <td><span className={s.actions}>
                            <button type="button" className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`} disabled={busy} onClick={() => void saveEdit(p)}>Save</button>
                            <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setEditing(null)}>Cancel</button>
                          </span></td>
                        </>
                      ) : (
                        <>
                          <td className={s.mono}>{p.hsn || '—'}</td>
                          <td className={s.num}>{p.gstRateBp == null ? '—' : `${bpToPct(p.gstRateBp)}%`}</td>
                          <td>
                            <span className={s.pill} style={p.status === 'verified' && !p.issue
                              ? { background: 'var(--green-bg)', color: 'var(--green)' }
                              : { background: 'var(--orange-bg)', color: 'var(--orange)' }}>
                              {p.status === 'verified' && !p.issue ? 'Verified' : 'Needs attention'}
                            </span>
                            {p.note && <div className={s.meta}>{p.note}</div>}
                          </td>
                          <td><button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>Edit</button></td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && (
            <EmptyState title={items.length ? 'Nothing needs attention' : 'No products yet'} body={items.length ? 'Every product has a verified HSN code and GST rate.' : 'Add products first, then classify them here.'} />
          )}
        </div>
      </div>
    </>
  );
}
