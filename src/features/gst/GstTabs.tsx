import { NavLink } from 'react-router-dom';
import s from './gst.module.css';

const TABS: [string, string][] = [
  ['/gst/settings', 'GST Settings'],
  ['/gst/products', 'Product HSN'],
  ['/gst/invoices', 'Invoices'],
];

export function GstTabs() {
  return (
    <nav aria-label="GST & Invoices" className={s.tabs}>
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => `${s.tab} ${isActive ? s.tabOn : ''}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
