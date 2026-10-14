/** Formatting helpers, matching the prototype exactly (inr, fD, fT, fDT, ymd). */

export const num = (x: unknown): number => Number(x) || 0;

export const DAY = 864e5;

/** Whole rupees with en-IN grouping, as every screen in the prototype shows them. */
export const inr = (n: unknown): string =>
  '₹' + Math.round(num(n)).toLocaleString('en-IN');

export const ymd = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

export const fD = (iso?: string): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

export const fT = (iso?: string): string =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

export const fDT = (iso?: string): string => (iso ? `${fD(iso)}, ${fT(iso)}` : '');

/** Start of today, in local time. */
export const sod = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return +d;
};

export const slugify = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

export const plural = (n: number, one: string, many = one + 's'): string =>
  `${n} ${n === 1 ? one : many}`;

/** Pale tint derived from a hex, as Settings does when a colour is added. */
export const tintOf = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const m = (v: number) => Math.round(v + (255 - v) * 0.78);
  return (
    '#' +
    [m(n >> 16), m((n >> 8) & 255), m(n & 255)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
};

/** wa.me deep link; bare 10-digit numbers get the India country code. */
export const waLink = (phone: string | undefined, text = ''): string => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : '';
};
