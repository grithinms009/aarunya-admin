/* Customers. Becomes GET /api/admin/customers.

   Everyone who has ordered online or bought in person, keyed by phone number and
   falling back to the name for walk-ins with no phone. The backend will keep a
   customer row per person and link orders to it; the shape returned here is the same. */
import { db, reply } from './mock/store';
import type { Channel } from '@/data/types';

export interface CustomerRow {
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  orders: number;
  spent: number;
  lastOrderAt: string;
  channels: Channel[];
}

export interface CustomerQuery {
  q?: string;
  channel?: Channel | '';
}

export const customers = {
  list(query: CustomerQuery = {}): Promise<CustomerRow[]> {
    const map = new Map<string, CustomerRow & { channelSet: Set<Channel> }>();

    db().orders.forEach((o) => {
      const c = o.customer;
      const key = c.phone.replace(/\D/g, '') || c.name.trim().toLowerCase();
      if (!key) return;

      const row =
        map.get(key) ??
        {
          key,
          name: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city,
          orders: 0,
          spent: 0,
          lastOrderAt: o.createdAt,
          channels: [],
          channelSet: new Set<Channel>(),
        };

      /* Fill in anything the first order didn't carry. */
      if (!row.name && c.name) row.name = c.name;
      if (!row.city && c.city) row.city = c.city;
      if (!row.email && c.email) row.email = c.email;
      /* Cancelled orders don't count towards orders or spend. */
      if (o.status !== 'cancelled') {
        row.orders += 1;
        row.spent += o.total;
      }
      row.channelSet.add(o.channel);
      if (o.createdAt > row.lastOrderAt) row.lastOrderAt = o.createdAt;
      map.set(key, row);
    });

    const q = (query.q ?? '').trim().toLowerCase();
    const rows = [...map.values()]
      .map(({ channelSet, ...row }) => ({ ...row, channels: [...channelSet] }))
      .filter(
        (m) =>
          (!query.channel || m.channels.includes(query.channel)) &&
          (!q || `${m.name} ${m.phone} ${m.email} ${m.city}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : -1));

    return reply(rows);
  },
};
