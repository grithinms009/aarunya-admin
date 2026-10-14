import { useState } from 'react';
import { ADJUST_REASONS, inventory, type AdjustMode, type AdjustReason, type StockRow } from '@/api';
import { Modal } from '@/components/ui/Modal';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import s from './InventoryPage.module.css';

const MODES: [AdjustMode, string][] = [
  ['add', 'Add'],
  ['remove', 'Remove'],
  ['set', 'Set exact'],
];

interface Props {
  row: StockRow;
  colorLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AdjustStockModal({ row, colorLabel, onClose, onSaved }: Props) {
  const flash = useUi((st) => st.flash);
  const [mode, setMode] = useState<AdjustMode>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<AdjustReason>('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const n = parseInt(qty, 10) || 0;
  const next = mode === 'add' ? row.stock + n : mode === 'remove' ? Math.max(0, row.stock - n) : n;

  const save = async () => {
    setBusy(true);
    try {
      await inventory.adjust({ vid: row.vid, mode, qty: parseInt(qty, 10), reason, note });
      flash('Stock updated');
      onSaved();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not update stock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Adjust stock" onClose={onClose} maxWidth={440} bare>
      <div className={s.adjHead}>
        <span
          className={s.adjThumb}
          style={row.img ? { backgroundImage: `url("${row.img}")` } : undefined}
        />
        <span className={s.stack} style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>{row.name}</span>
          <span className={s.meta}>
            {colorLabel} · {row.sku} · {row.stock} in stock now
          </span>
        </span>
      </div>

      <div role="group" aria-label="Adjustment" className={s.modes}>
        {MODES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
            className={`${s.mode} ${mode === k ? s.modeOn : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={s.adjGrid}>
        <label className={f.label}>
          {mode === 'set' ? 'New stock count' : 'Quantity'}
          <input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className={s.qty}
          />
        </label>
        <label className={f.label}>
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as AdjustReason)}
            className={f.select}
            style={{ height: 42 }}
          >
            {ADJUST_REASONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        aria-label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional), e.g. supplier invoice no."
        className={f.input}
      />

      <div className={s.adjFoot}>
        <span className={s.preview}>
          Stock:{' '}
          <strong className={s.previewValue}>
            {row.stock} → {next}
          </strong>
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40,
              padding: '0 14px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              height: 40,
              padding: '0 16px',
              border: 'none',
              borderRadius: 'var(--r)',
              background: 'var(--gold)',
              color: 'var(--surface)',
              fontSize: 13.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Update stock
          </button>
        </span>
      </div>
    </Modal>
  );
}
