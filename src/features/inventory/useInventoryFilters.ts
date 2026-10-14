import { create } from 'zustand';
import type { LedgerReason } from '@/data/types';

export type StockLevel = '' | 'in' | 'low' | 'out';

export interface InventoryFilters {
  tab: 'stock' | 'ledger';
  q: string;
  cat: string;
  stock: StockLevel;
  reason: LedgerReason | '';
}

export const BLANK_INVENTORY_FILTERS: InventoryFilters = {
  tab: 'stock',
  q: '',
  cat: '',
  stock: '',
  reason: '',
};

interface Store extends InventoryFilters {
  set: (patch: Partial<InventoryFilters>) => void;
  reset: () => void;
}

/** Outside the screen so the dashboard can jump straight to low or out of stock. */
export const useInventoryFilters = create<Store>((set) => ({
  ...BLANK_INVENTORY_FILTERS,
  set: (patch) => set(patch),
  reset: () => set({ ...BLANK_INVENTORY_FILTERS }),
}));
