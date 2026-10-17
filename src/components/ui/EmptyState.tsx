/* The "there is nothing here" panel.
 *
 * A screen with no rows has two quite different causes, and telling them apart is the
 * whole point of this component:
 *
 *   · the shop has none of these yet     → say what to create, and link to it
 *   · a filter or search excluded them   → say that, and offer to clear it
 *
 * Showing "No products match these filters" to someone who has not added a product is
 * confusing: it implies a filter is at fault and hides the thing they actually need to
 * do next. Pass `setup` for the first case and `filtered` for the second.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './EmptyState.module.css';

export function EmptyState({
  title,
  body,
  action,
  onAction,
  actionLabel,
}: {
  title: string;
  body?: ReactNode;
  /** Where the next step lives, when it is a different screen. */
  action?: string;
  /** Or a handler, when the next step is on this screen. */
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className={s.wrap} role="status">
      <p className={s.title}>{title}</p>
      {body && <p className={s.body}>{body}</p>}

      {action && actionLabel && (
        <Link to={action} className={s.action}>
          {actionLabel}
        </Link>
      )}
      {!action && onAction && actionLabel && (
        <button type="button" onClick={onAction} className={s.action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
