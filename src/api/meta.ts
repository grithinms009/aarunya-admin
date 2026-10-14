/* Reference data and nav badge counts — GET /api/admin/settings and the counts the
   dashboard's "Needs attention" block also uses. */
import { db, reply } from './mock/store';
import type { Category, ColorDef, ColorKey, Config } from '@/data/types';

export interface NavBadges {
  orders: number;
  returns: number;
  inventory: number;
}

export const meta = {
  categories: (): Promise<Category[]> => reply(db().categories),
  colors: (): Promise<Record<ColorKey, ColorDef>> => reply(db().colors),
  config: (): Promise<Config> => reply(db().config),

  badges: (): Promise<NavBadges> => {
    const d = db();
    return reply({
      orders: d.orders.filter(
        (o) => o.channel === 'online' && o.status === 'new' && o.payment.status === 'paid',
      ).length,
      returns: d.returns.filter((r) => r.status === 'requested').length,
      inventory: d.products.flatMap((p) => p.variants).filter((v) => v.stock === 0).length,
    });
  },
};
