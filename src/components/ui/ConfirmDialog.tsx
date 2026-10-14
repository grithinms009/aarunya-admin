import { useEffect } from 'react';
import { useUi } from '@/store/useUi';
import s from './ConfirmDialog.module.css';

/** Mounted once by Layout; driven by useUi().ask(...). */
export function ConfirmDialog() {
  const confirm = useUi((st) => st.confirm);
  const close = useUi((st) => st.closeConfirm);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, close]);

  if (!confirm) return null;

  return (
    <div role="alertdialog" aria-modal="true" aria-label={confirm.title} className={s.scrim}>
      <div className={s.box}>
        <h2 className={s.title}>{confirm.title}</h2>
        <p className={s.text}>{confirm.text}</p>
        <div className={s.row}>
          <button type="button" onClick={close} className={s.keep}>
            Keep it
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              confirm.run();
            }}
            className={s.go}
          >
            {confirm.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
