import { useEffect } from 'react';
import s from './Modal.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  /** Hide the header row, for dialogs that are all body (stock adjust). */
  bare?: boolean;
}

export function Modal({ title, onClose, children, footer, maxWidth = 600, bare }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className={s.scrim}>
      <div className={s.panel} style={{ maxWidth }}>
        {!bare && (
          <div className={s.head}>
            <h2 className={s.title}>{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} className={s.close}>
              ×
            </button>
          </div>
        )}
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>
  );
}
