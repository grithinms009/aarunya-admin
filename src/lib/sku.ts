/** Auto SKU: AJ-{CATEGORY}{PRODUCT NUMBER}-{COLOUR}, the same rule as skuFor in
 *  design_handoff_aarunya_admin/aarunya-admin-db.js. */

const COLOR_CODE: Record<string, string> = {
  gold: 'GLD',
  rose: 'RSG',
  silver: 'SLV',
  black: 'BLK',
  green: 'GRN',
};

const CAT_CODE: Record<string, string> = {
  necklaces: 'NK',
  bangles: 'BG',
  bracelets: 'BR',
  rings: 'RG',
  handchains: 'HC',
  hipchains: 'HP',
  earrings: 'ER',
  'nose-rings': 'NR',
};

export const skuFor = (
  p: { id: string; category: string },
  color: string,
): string => {
  const cat = CAT_CODE[p.category] || String(p.category || 'XX').slice(0, 2).toUpperCase();
  const n = String(p.id).replace(/\D/g, '').padStart(3, '0');
  const col = COLOR_CODE[color] || String(color).slice(0, 3).toUpperCase();
  return `AJ-${cat}${n}-${col}`;
};
