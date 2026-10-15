/* Customers — GET /api/admin/customers. Everyone who has ordered online or bought in
   person, grouped by phone and falling back to the name for walk-ins with no phone. */
import { download, req } from './client';
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
  list: (query: CustomerQuery = {}) =>
    req<CustomerRow[]>('/admin/customers', { query: { ...query } }),

  exportCsv: (query: CustomerQuery = {}) =>
    download('/admin/customers/export.csv', { ...query }, 'aarunya-customers.csv'),
};
