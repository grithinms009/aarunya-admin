import type { Badge } from '@/lib/badges';
import s from './controls.module.css';

export function Pill({ badge, style }: { badge: Badge; style?: React.CSSProperties }) {
  return (
    <span className={s.pill} style={{ color: badge.fg, background: badge.bg, ...style }}>
      {badge.text}
    </span>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  role = 'group',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  role?: 'group' | 'tablist';
}) {
  return (
    <div role={role} aria-label={label} className={s.segGroup}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={role === 'tablist' ? 'tab' : undefined}
            aria-selected={role === 'tablist' ? on : undefined}
            aria-pressed={role === 'tablist' ? undefined : on}
            onClick={() => onChange(o.value)}
            className={`${s.segBtn} ${on ? s.segBtnOn : ''}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`${s.chip} ${on ? s.chipOn : ''}`}
    >
      {label}
    </button>
  );
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`${s.switch} ${on ? s.switchOn : ''}`}
    >
      <span className={`${s.knob} ${on ? s.knobOn : ''}`} />
    </button>
  );
}
