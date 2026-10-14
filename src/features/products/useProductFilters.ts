import { create } from 'zustand';
import type { ProductFlag, ProductSort, StockFilter } from '@/api';
import type { ProductStatus } from '@/data/types';

export interface ProductFilters {
  q: string;
  cat: string;
  sub: string;
  color: string;
  stock: StockFilter;
  status: ProductStatus | '';
  flags: ProductFlag[];
  sort: ProductSort;
}

/** The prototype's BLANK_PF. */
export const BLANK_PRODUCT_FILTERS: ProductFilters = {
  q: '',
  cat: '',
  sub: '',
  color: '',
  stock: '',
  status: '',
  flags: [],
  sort: 'new',
};

interface Store extends ProductFilters {
  set: (patch: Partial<ProductFilters>) => void;
  toggleFlag: (f: ProductFlag) => void;
  reset: () => void;
}

/** Outside the screen so Categories can open the list filtered to one category. */
export const useProductFilters = create<Store>((set, get) => ({
  ...BLANK_PRODUCT_FILTERS,
  set: (patch) => set(patch),
  toggleFlag: (f) => {
    const flags = get().flags;
    set({ flags: flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f] });
  },
  reset: () => set({ ...BLANK_PRODUCT_FILTERS }),
}));
