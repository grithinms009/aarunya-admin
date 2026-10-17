import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { meta, returns, type ReturnTab } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip, Switch } from '@/components/ui/controls';
import { useViewport } from '@/hooks/useViewport';
import { RETURN_STATUS, RETURN_TYPE } from '@/lib/badges';
import { fD } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import { LogRequestModal } from './LogRequestModal';
import { ReturnDrawer } from './ReturnDrawer';
import s from './ReturnsPage.module.css';
import type { ReturnType } from '@/data/types';
import { useReference } from '@/hooks/useReference';
import { EmptyState } from '@/components/ui/EmptyState';

const TABS: [ReturnTab, string][] = [
  ['review', 'Needs review'],
  ['progress', 'In progress'],
  ['closed', 'Closed'],
  ['all', 'All'],
];


export function ReturnsPage() {
  const { returnWindows } = useReference();
  const { returnNo } = useParams();
  const navigate = useNavigate();
  const { w } = useViewport();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);

  const [tab, setTab] = useState<ReturnTab>('review');
  const [q, setQ] = useState('');
  const [type, setType] = useState<ReturnType | ''>('');
  const [logging, setLogging] = useState(false);

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: meta.config });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: meta.categories });
  const { data } = useQuery({
    queryKey: ['returns', tab, q, type],
    queryFn: () => returns.list({ tab, q, type }),
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts;
  const colorLabel = (k: string) => colors[k]?.label ?? k;

  const savePolicy = async (patch: Parameters<typeof returns.savePolicy>[0]) => {
    await returns.savePolicy(patch);
    void qc.invalidateQueries({ queryKey: ['config'] });
    void qc.invalidateQueries({ queryKey: ['returns'] });
    flash('Return policy updated');
  };

  return (
    <>
      <PageHeader
        title="Returns & exchanges"
        sub={`Customers can ask for an exchange within ${config?.returnWindow ?? 3} days of delivery.`}
        actions={[{ label: 'Log a request', onClick: () => setLogging(true), primary: true }]}
      />

      <div
        className={s.grid}
        style={{ gridTemplateColumns: w >= 1180 ? 'minmax(0,1fr) 320px' : '1fr' }}
      >
        <div className={s.main}>
          <div className={s.bar}>
            <div role="tablist" aria-label="Request status" className={s.tabs}>
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`${s.tab} ${tab === k ? s.tabOn : ''}`}
                >
                  {label} ({counts?.[k] ?? 0})
                </button>
              ))}
            </div>
            <input
              type="search"
              aria-label="Search requests"
              placeholder="Search request, order or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${f.input} ${s.search}`}
            />
            <select
              aria-label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as ReturnType | '')}
              className={`${f.select} ${s.type}`}
            >
              <option value="">Replacements &amp; refunds</option>
              <option value="replacement">Replacements</option>
              <option value="refund">Refunds</option>
            </select>
          </div>

          <div className={s.rows}>
            {rows.map((r) => {
              const e = returns.eligibility(r);
              const flagged = !e.ok && r.status === 'requested';
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/returns/${r.id}`)}
                  className={s.row}
                >
                  <span
                    className={s.thumb}
                    style={r.item.img ? { backgroundImage: `url("${r.item.img}")` } : undefined}
                  />
                  <span className={s.body}>
                    <span className={s.idRow}>
                      <span className={s.id}>{r.id}</span>
                      <span className={s.for}>
                        for {r.orderId} · {fD(r.createdAt)}
                      </span>
                      {flagged && <span className={s.flag}>Check policy</span>}
                    </span>
                    <span>
                      {r.customer.name} · {r.item.name} ({colorLabel(r.item.color)})
                    </span>
                    <span className={s.reason}>{r.reason}</span>
                  </span>
                  <span className={s.badges}>
                    <span
                      className={s.statusPill}
                      style={{
                        background: RETURN_STATUS[r.status].bg,
                        color: RETURN_STATUS[r.status].fg,
                      }}
                    >
                      {RETURN_STATUS[r.status].text}
                    </span>
                    <span
                      className={s.typePill}
                      style={{
                        background: RETURN_TYPE[r.type].bg,
                        color: RETURN_TYPE[r.type].fg,
                      }}
                    >
                      {RETURN_TYPE[r.type].text}
                    </span>
                  </span>
                </button>
              );
            })}
            {rows.length === 0 && (
              (counts?.all ?? 0) === 0 ? (
                <EmptyState
                  title="No return requests"
                  body="Requests appear here when a customer raises one from the website, or when you log one yourself."
                />
              ) : (
                <EmptyState
                  title="Nothing in this tab"
                  body="Try another tab, or clear the search."
                />
              )
            )}
          </div>
        </div>

        <aside className={s.aside} style={{ position: w >= 1180 ? 'sticky' : 'static' }}>
          <div className={s.asideHead}>
            <h2 className={s.h2}>Return policy</h2>
            <p className={s.note}>
              Used to flag requests that need a closer look. Changes save straight away.
            </p>
          </div>

          <label className={f.label}>
            Request window
            <select
              value={String(config?.returnWindow ?? 3)}
              onChange={(e) => void savePolicy({ returnWindow: Number(e.target.value) })}
              className={f.select}
            >
              {returnWindows.map((n) => (
                <option key={n} value={String(n)}>
                  {n} days after delivery
                </option>
              ))}
            </select>
          </label>

          <div className={s.group}>
            <span className={s.groupLabel}>Exchange only if damaged</span>
            <div className={s.chips}>
              {categories.map((c) => {
                const on = (config?.nonEligible ?? []).includes(c.slug);
                return (
                  <Chip
                    key={c.slug}
                    label={c.short || c.name}
                    on={on}
                    onClick={() =>
                      void savePolicy({
                        nonEligible: on
                          ? (config?.nonEligible ?? []).filter((x) => x !== c.slug)
                          : [...(config?.nonEligible ?? []), c.slug],
                      })
                    }
                  />
                );
              })}
            </div>
          </div>

          <div className={s.toggleRow}>
            <span className={s.toggleText}>
              <span className={s.toggleTitle}>Unboxing video required</span>
              <span className={s.toggleSub}>Flag requests that come without one.</span>
            </span>
            <Switch
              on={!!config?.requireVideo}
              onChange={(v) => void savePolicy({ requireVideo: v })}
              label="Unboxing video required"
            />
          </div>

          <div className={s.toggleRow}>
            <span className={s.toggleText}>
              <span className={s.toggleTitle}>Allow refunds</span>
              <span className={s.toggleSub}>When off, only replacements can be approved.</span>
            </span>
            <Switch
              on={!!config?.allowRefund}
              onChange={(v) => void savePolicy({ allowRefund: v })}
              label="Allow refunds"
            />
          </div>
        </aside>
      </div>

      {returnNo && <ReturnDrawer returnNo={returnNo} />}

      {logging && (
        <LogRequestModal
          onClose={() => setLogging(false)}
          onSaved={(id) => {
            void qc.invalidateQueries({ queryKey: ['returns'] });
            void qc.invalidateQueries({ queryKey: ['badges'] });
            setLogging(false);
            navigate(`/returns/${id}`);
          }}
        />
      )}
    </>
  );
}
