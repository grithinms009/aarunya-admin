/* Icon paths, copied from the ICON map and inline SVGs in the prototype. */

export interface IconProps {
  d: string;
  size?: number;
  stroke?: string;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Stroked 24x24 icon, the only icon style the prototype uses. */
export function Icon({ d, size = 17, stroke = 'currentColor', width = 1.7, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{
        flex: 'none',
        fill: 'none',
        stroke,
        strokeWidth: width,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...style,
      }}
    >
      <path d={d} />
    </svg>
  );
}

export const NAV_ICON = {
  dashboard: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  pos: 'M3 9l1.5-5h15L21 9 M4 9v11h16V9 M3 9h18 M9 20v-6h6v6',
  returns: 'M4 9h11a5 5 0 0 1 0 10h-3 M8 5L4 9l4 4',
  products: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  categories: 'M3 12V4h8l10 10-8 8z M7.5 8.5h.01',
  inventory: 'M4 20V10 M10 20V4 M16 20v-7 M21 20H3',
  storefront: 'M3 5h18v14H3z M3 15l5-5 4 4 3-3 6 6 M15.5 9.5h.01',
  customers:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-4 3-6 7-6s7 2 7 6 M16 4a3.5 3.5 0 0 1 0 7 M18 15c2.5.5 4 2.5 4 6',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.7 7.7 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.4z',
} as const;

export const PATH = {
  externalLink: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  menu: 'M4 7h16M4 12h16M4 17h10',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  trashSmall: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  duplicate: 'M8 8h12v12H8z M16 8V4H4v12h4',
  sparkle:
    'M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z',
  sparkleSmall: 'M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z',
  camera: 'M3 6h4l2-2h6l2 2h4v13H3z',
  rupee: 'M7 4h10 M7 8.5h10 M7 4h3.5a4.5 4.5 0 0 1 0 9H7l7.5 7',
  bag: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  trend: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
} as const;
