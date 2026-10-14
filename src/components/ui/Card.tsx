import { Link } from 'react-router-dom';
import s from './Card.module.css';

interface CardProps {
  title?: string;
  /** Small muted text at the right of the header. */
  note?: string;
  /** "View all ↗" style link at the right of the header. */
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ title, note, linkTo, linkLabel, children, style, className }: CardProps) {
  return (
    <section className={`${s.card} ${className ?? ''}`} style={style}>
      {title && (
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          {note && <span className={s.aside}>{note}</span>}
          {linkTo && (
            <Link to={linkTo} className={s.link}>
              {linkLabel} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export const CardBody = ({ children }: { children: React.ReactNode }) => (
  <div className={s.body}>{children}</div>
);

export const CardEmpty = ({ children }: { children: React.ReactNode }) => (
  <p className={s.empty}>{children}</p>
);

export const CardScroll = ({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth: number;
}) => (
  <div className={s.scroll}>
    <div style={{ minWidth }}>{children}</div>
  </div>
);
