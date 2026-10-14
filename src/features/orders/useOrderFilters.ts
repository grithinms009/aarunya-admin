import { create } from 'zustand';
import type { DateRange } from '@/api';
import type { Channel, OrderStatus, PaymentStatus } from '@/data/types';

export type ChannelFilter = 'all' | Channel;

export interface OrderFilters {
  ch: ChannelFilter;
  status: OrderStatus | '';
  pay: PaymentStatus | '';
  range: DateRange;
  from: string;
  to: string;
  q: string;
}

/** The prototype's BLANK_OF. */
export const BLANK_ORDER_FILTERS: OrderFilters = {
  ch: 'all',
  status: '',
  pay: '',
  range: '30',
  from: '',
  to: '',
  q: '',
};

interface Store extends OrderFilters {
  set: (patch: Partial<OrderFilters>) => void;
  reset: () => void;
}

/** Lives outside the screen so the dashboard and customers list can pre-apply filters. */
export const useOrderFilters = create<Store>((set) => ({
  ...BLANK_ORDER_FILTERS,
  set: (patch) => set(patch),
  reset: () => set({ ...BLANK_ORDER_FILTERS }),
}));
