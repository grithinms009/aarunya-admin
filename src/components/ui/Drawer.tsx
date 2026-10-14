import { useEffect } from 'react';
import s from './Drawer.module.css';

interface Props {
  label: string;
  onClose: () => void;
  /** Header content: id, badges and the timestamp line. */
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({ label, onClose, header, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className={s.scrim} />
      <aside role="dialog" aria-modal="true" aria-label={label} className={s.drawer}>
        <div className={s.head}>
          <div className={s.headText}>{header}</div>
          <button type="button" aria-label="Close" onClick={onClose} className={s.close}>
            ×
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </aside>
    </>
  );
}

export interface StepView {
  label: string;
  at: string;
  done: boolean;
  lineOn: boolean;
  notLast: boolean;
}

/** Shared step timeline for the order and return flows. */
export function Steps({ steps }: { steps: StepView[] }) {
  return (
    <div className={s.steps}>
      {steps.map((st) => (
        <div key={st.label} className={s.step}>
          {st.notLast && (
            <span
              aria-hidden="true"
              className={s.line}
              style={{ background: st.lineOn ? 'var(--gold)' : 'var(--line-nav)' }}
            />
          )}
          <span
            className={s.dot}
            style={{
              border: `2px solid ${st.done ? 'var(--gold)' : 'var(--line-toggle)'}`,
              background: st.done ? 'var(--gold)' : 'var(--surface)',
            }}
          />
          <span
            className={s.stepLabel}
            style={{ color: st.done ? 'var(--ink)' : 'var(--ink-faint)' }}
          >
            {st.label}
          </span>
          <span className={s.stepAt}>{st.at}</span>
        </div>
      ))}
    </div>
  );
}

/** Builds the timeline from a flow definition, the current status and the history. */
export function buildSteps<T extends string>(
  defs: [T, string][],
  current: T,
  history: { at: string; status: string }[],
): StepView[] {
  const idx = defs.findIndex((d) => d[0] === current);
  return defs.map(([key, label], i) => {
    const hit = history.filter((h) => h.status === key).pop();
    const done = i <= idx;
    return {
      label,
      at: hit && done ? hit.at : '',
      done,
      lineOn: i < idx,
      notLast: i < defs.length - 1,
    };
  });
}
