/** Auto SKU: AJ-{CATEGORY}{PRODUCT NUMBER}-{COLOUR}.
 *
 *  The code maps come from the API (meta.reference().skuCodes), which is also what the
 *  server uses when it generates the real SKU — this only renders the placeholder that
 *  shows what the SKU will be. */
import type { Reference } from '@/api';

export const skuFor = (
  p: { id: string; category: string },
  color: string,
  codes: Reference['skuCodes'],
): string => {
  const cat = codes.categories[p.category] || String(p.category || 'XX').slice(0, 2).toUpperCase();
  const n = String(p.id).replace(/\D/g, '').padStart(3, '0');
  const col = codes.colors[color] || String(color).slice(0, 3).toUpperCase();
  return `AJ-${cat}${n}-${col}`;
};
