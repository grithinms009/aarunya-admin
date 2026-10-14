import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RETURN_REASONS, ReturnRuleError, meta, orders, returns } from '@/api';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/controls';
import { fD } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import m from '@/components/ui/Modal.module.css';
import s from './ReturnsPage.module.css';
import type { ReturnType } from '@/data/types';

interface Props {
  onClose: () => void;
  onSaved: (returnNo: string) => void;
}

/** For customers who ask by WhatsApp or phone rather than through the store. */
export function LogRequestModal({ onClose, onSaved }: Props) {
  const flash = useUi((st) => st.flash);
  const { data: list = [] } = useQuery({
    queryKey: ['returnable-orders'],
    queryFn: () => orders.returnable(60),
  });
  const { data: colors = {} } = useQuery({ queryKey: ['colors'], queryFn: meta.colors });

  const [orderId, setOrderId] = useState('');
  const [vid, setVid] = useState('');
  const [type, setType] = useState<ReturnType>('replacement');
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [note, setNote] = useState('');
  const [video, setVideo] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /* Default to the most recent delivered order, as the prototype does. */
  useEffect(() => {
    if (orderId || !list.length) return;
    const delivered = list.find((o) => o.status === 'delivered') ?? list[0];
    setOrderId(delivered.id);
    setVid(delivered.items[0]?.vid ?? '');
  }, [list, orderId]);

  const order = list.find((o) => o.id === orderId);

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const req = await returns.log({ orderId, vid, type, reason, note, video });
      flash(`Request ${req.id} logged`);
      onSaved(req.id);
    } catch (e) {
      if (e instanceof ReturnRuleError) setErr(e.message);
      else flash('Could not log the request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Log a request"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={m.cancel}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy} className={m.confirm}>
            Log request
          </button>
        </>
      }
    >
      <p className={s.note}>For customers who message you on WhatsApp or by phone.</p>

      <label className={f.label}>
        Order
        <select
          value={orderId}
          onChange={(e) => {
            const next = list.find((o) => o.id === e.target.value);
            setOrderId(e.target.value);
            setVid(next?.items[0]?.vid ?? '');
          }}
          className={f.select}
        >
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id} · {o.customer.name} · {fD(o.createdAt)}
            </option>
          ))}
        </select>
      </label>

      <label className={f.label}>
        Piece
        <select value={vid} onChange={(e) => setVid(e.target.value)} className={f.select}>
          {(order?.items ?? []).map((l) => (
            <option key={l.vid} value={l.vid}>
              {l.name} · {colors[l.color]?.label ?? l.color}
            </option>
          ))}
        </select>
      </label>

      <div className={m.group}>
        <span className={m.fieldLabel}>Customer wants</span>
        <div role="group" aria-label="Type" className={s.segGroup} style={{ alignSelf: 'flex-start' }}>
          {(
            [
              ['replacement', 'Replacement'],
              ['refund', 'Refund'],
            ] as [ReturnType, string][]
          ).map(([k, label]) => (
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
      </div>

      <label className={f.label}>
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={f.select}>
          {RETURN_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <textarea
        rows={2}
        aria-label="Details"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What the customer told you"
        className={f.textarea}
      />

      <div className={s.toggleRow}>
        <span className={s.toggleText}>
          <span className={s.toggleTitle}>Unboxing video received</span>
        </span>
        <Switch on={video} onChange={setVideo} label="Unboxing video received" />
      </div>

      {err && (
        <p role="alert" className={m.error}>
          {err}
        </p>
      )}
    </Modal>
  );
}
