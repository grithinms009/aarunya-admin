import { Link } from 'react-router-dom';
import s from './PageHeader.module.css';

export interface HeaderAction {
  label: string;
  /** Internal route. */
  to?: string;
  /** External URL, opened in a new tab. */
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}

interface Props {
  title: string;
  sub?: string;
  backTo?: string;
  backLabel?: string;
  actions?: HeaderAction[];
}

export function PageHeader({ title, sub, backTo, backLabel, actions = [] }: Props) {
  return (
    <div className={s.head}>
      <div className={s.left}>
        {backTo && (
          <Link to={backTo} className={s.back}>
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
              ‹
            </span>
            <span>Back to {backLabel}</span>
          </Link>
        )}
        <h1 className={s.title}>{title}</h1>
        {sub && <p className={s.sub}>{sub}</p>}
      </div>

      {actions.length > 0 && (
        <div className={s.actions}>
          {actions.map((a) => {
            const cls = `${s.action} ${a.primary ? s.primary : ''}`;
            if (a.to) {
              return (
                <Link key={a.label} to={a.to} className={cls}>
                  {a.label}
                </Link>
              );
            }
            if (a.href) {
              return (
                <a key={a.label} href={a.href} target="_blank" rel="noopener" className={cls}>
                  {a.label}
                </a>
              );
            }
            return (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={cls}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
