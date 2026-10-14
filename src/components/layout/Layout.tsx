import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { meta } from '@/api';
import { Icon, NAV_ICON, PATH } from '@/components/ui/icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { useViewport } from '@/hooks/useViewport';
import { useAuth } from '@/store/useAuth';
import { useUi } from '@/store/useUi';
import s from './Layout.module.css';

type NavKey = keyof typeof NAV_ICON;
type BadgeKey = 'orders' | 'returns' | 'inventory';

const GROUPS: { title: string; items: [NavKey, string][] }[] = [
  { title: 'Overview', items: [['dashboard', 'Dashboard']] },
  {
    title: 'Sales',
    items: [
      ['orders', 'Orders'],
      ['pos', 'Offline sale'],
      ['returns', 'Returns & exchanges'],
    ],
  },
  {
    title: 'Catalogue',
    items: [
      ['products', 'Products'],
      ['categories', 'Categories'],
      ['inventory', 'Inventory'],
    ],
  },
  {
    title: 'Store',
    items: [
      ['storefront', 'Banners & homepage'],
      ['customers', 'Customers'],
      ['settings', 'Settings'],
    ],
  },
];

const STORE_URL = import.meta.env.VITE_STORE_URL ?? 'http://localhost:5173';

export function Layout() {
  const { w, desk } = useViewport();
  const { pathname } = useLocation();
  const { menu, openMenu, closeMenu } = useUi();
  const user = useAuth((st) => st.user);
  const signOut = useAuth((st) => st.signOut);
  const { data: badges } = useQuery({ queryKey: ['badges'], queryFn: meta.badges });

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  const open = desk || menu;
  const name = user?.name ?? '';

  return (
    <div>
      <div
        aria-hidden="true"
        onClick={closeMenu}
        className={s.overlay}
        style={{
          opacity: !desk && menu ? 1 : 0,
          pointerEvents: !desk && menu ? 'auto' : 'none',
        }}
      />

      <aside
        aria-label="Admin navigation"
        className={s.aside}
        style={{
          transform: open ? 'none' : 'translateX(-104%)',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <div className={s.rail}>
          <Link to="/dashboard" aria-label="Dashboard" className={s.railMark}>
            <img
              src="/assets/aarunya-mark-sm.png"
              alt=""
              style={{ display: 'block', height: 28, width: 'auto' }}
            />
          </Link>
          <span style={{ flex: 1 }} />
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener"
            aria-label="View store"
            title="View store"
            className={s.railBtn}
          >
            <Icon d={PATH.externalLink} size={18} />
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Log out"
            title="Log out"
            className={s.railBtn}
          >
            <Icon d={PATH.logout} size={18} />
          </button>
          <span title={name} aria-hidden="true" className={s.railAvatar}>
            {(name || 'A').charAt(0)}
          </span>
        </div>

        <div className={s.panel}>
          <div className={s.panelHead}>
            <img
              src="/assets/aarunya-wordmark-sm.png"
              alt="Aarunya by Veena"
              style={{ display: 'block', height: 18, width: 'auto', alignSelf: 'flex-start' }}
            />
            <span className={s.panelSub}>Store admin · {name}</span>
          </div>

          <nav className={s.nav}>
            {GROUPS.map((g) => (
              <div key={g.title} className={s.group}>
                <span className={s.groupTitle}>{g.title}</span>
                {g.items.map(([key, label]) => {
                  const n = badges?.[key as BadgeKey] ?? 0;
                  return (
                    <NavLink key={key} to={`/${key}`} className={s.item}>
                      {({ isActive }) => (
                        <>
                          <Icon
                            d={NAV_ICON[key]}
                            stroke={isActive ? 'var(--gold)' : 'var(--ink-faint)'}
                          />
                          <span className="label">{label}</span>
                          {n > 0 && <span className={s.badge}>{n}</span>}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={s.panelFoot}>
            <Link to="/products/new" className={s.newProduct}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, color: 'var(--gold)' }}>
                +
              </span>
              New product
            </Link>
          </div>
        </div>
      </aside>

      <div style={{ marginLeft: desk ? 'var(--sidebar-w)' : 0, minWidth: 0 }}>
        {!desk && (
          <header className={s.topbar}>
            <button type="button" aria-label="Open menu" onClick={openMenu} className={s.hamburger}>
              <Icon d={PATH.menu} size={22} width={1.8} />
            </button>
            <Link to="/dashboard" className={s.topbarBrand}>
              <img
                src="/assets/aarunya-mark-sm.png"
                alt=""
                style={{ display: 'block', height: 30, width: 'auto' }}
              />
              <span className={s.topbarAdmin}>Admin</span>
            </Link>
            <span style={{ flex: 1 }} />
            <Link to="/pos" className={s.topbarCta}>
              + Offline sale
            </Link>
          </header>
        )}

        <main
          className={s.main}
          style={{ padding: w >= 700 ? '32px 32px 72px' : '20px 16px 56px' }}
        >
          <Outlet />
        </main>
      </div>

      <ConfirmDialog />
      <Toast />
    </div>
  );
}
