/* Dashboard numbers. Computed here from the mock dataset; becomes
   GET /api/admin/dashboard?period=today|7|30, which returns this same DTO. */
import { DAY, sod } from '@/lib/format';
import { db, reply } from './mock/store';
import type { Order } from '@/data/types';

export type Period = 'today' | '7' | '30';

export interface TopSeller {
  pid: string;
  name: string;
  img: string;
  units: number;
  revenue: number;
}

export interface LowStockRow {
  pid: string;
  name: string;
  color: string;
  sku: string;
  img: string;
  stock: number;
}

export interface DashboardSummary {
  period: Period;
  revenue: { total: number; online: number; offline: number };
  orderCount: { total: number; online: number; offline: number };
  units: number;
  pieces: number;
  average: number;
  attention: {
    paidToPack: number;
    packedToShip: number;
    awaitingPayment: number;
    returnsToReview: number;
    lowStock: number;
    outOfStock: number;
  };
  recent: Order[];
  top: TopSeller[];
  low: LowStockRow[];
}

export const dashboard = {
  summary(period: Period): Promise<DashboardSummary> {
    const d = db();
    const low = d.config.LOW_STOCK || 2;
    const start = period === 'today' ? sod() : Date.now() - Number(period) * DAY;

    /** Cancelled orders are excluded from every revenue and count figure. */
    const live = d.orders.filter(
      (o) => +new Date(o.createdAt) >= start && o.status !== 'cancelled',
    );
    const online = live.filter((o) => o.channel === 'online');
    const offline = live.filter((o) => o.channel === 'offline');
    const sum = (a: Order[]) => a.reduce((t, o) => t + o.total, 0);

    const allV = d.products.flatMap((p) => p.variants.map((v) => ({ p, v })));
    const lowRows = allV.filter((x) => x.v.stock > 0 && x.v.stock <= low);
    const outRows = allV.filter((x) => x.v.stock === 0);

    const tops = new Map<string, TopSeller>();
    live.forEach((o) =>
      o.items.forEach((l) => {
        const t =
          tops.get(l.pid) ??
          ({ pid: l.pid, name: l.name, img: l.img, units: 0, revenue: 0 } as TopSeller);
        t.units += l.qty;
        t.revenue += l.qty * l.price;
        tops.set(l.pid, t);
      }),
    );

    const revenue = sum(live);
    return reply({
      period,
      revenue: { total: revenue, online: sum(online), offline: sum(offline) },
      orderCount: { total: live.length, online: online.length, offline: offline.length },
      units: live.reduce((t, o) => t + o.items.reduce((u, l) => u + l.qty, 0), 0),
      pieces: new Set(live.flatMap((o) => o.items.map((l) => l.pid))).size,
      average: live.length ? revenue / live.length : 0,
      attention: {
        paidToPack: d.orders.filter(
          (o) => o.channel === 'online' && o.status === 'new' && o.payment.status === 'paid',
        ).length,
        packedToShip: d.orders.filter((o) => o.status === 'packed').length,
        awaitingPayment: d.orders.filter(
          (o) => o.payment.status === 'pending' && o.status !== 'cancelled',
        ).length,
        returnsToReview: d.returns.filter((r) => r.status === 'requested').length,
        lowStock: lowRows.length,
        outOfStock: outRows.length,
      },
      recent: d.orders.slice(0, 6),
      top: [...tops.values()]
        .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
        .slice(0, 5),
      low: [...outRows, ...lowRows]
        .sort((a, b) => a.v.stock - b.v.stock)
        .slice(0, 6)
        .map(({ p, v }) => ({
          pid: p.id,
          name: p.name,
          color: v.color,
          sku: v.sku,
          img: v.images[0] || '',
          stock: v.stock,
        })),
    });
  },
};
