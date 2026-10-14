import { useUi } from '@/store/useUi';
import s from './Toast.module.css';

export function Toast() {
  const { toast, toastOn } = useUi();
  return (
    <div
      role="status"
      aria-live="polite"
      className={s.toast}
      style={{
        transform: `translateX(-50%) translateY(${toastOn ? '0' : '12px'})`,
        opacity: toastOn ? 1 : 0,
      }}
    >
      {toast}
    </div>
  );
}
