/* Reference data, nav badge counts and the fixed vocabularies the screens render.

   Nothing in this app hard-codes a reason, a flow step, a link target or a default
   image any more: they all come from GET /api/admin/meta/reference, which the backend
   builds from the same module its own rules read. */
import { req } from './client';
import type {
  Category, ColorDef, ColorKey, Config, OfferMatch, OrderStatus, ReturnStatus,
} from '@/data/types';

export interface NavBadges {
  orders: number;
  returns: number;
  inventory: number;
}

export type AdjustReason = 'restock' | 'damaged' | 'correction' | 'sample' | 'other';

export interface Reference {
  /** Adjustment reason keys with the label written into the ledger note. */
  adjustReasons: [AdjustReason, string][];
  returnReasons: string[];
  refundMethods: string[];
  payModes: string[];
  /** The forward-only order flow: status → [next status, button label]. */
  nextStep: Partial<Record<OrderStatus, [OrderStatus, string]>>;
  orderSteps: [OrderStatus, string][];
  returnSteps: [ReturnStatus, string][];
  /** The three photo slots a variant stores, in order. */
  photoSlots: string[];
  /** Where an offer banner's button can point: [match, href, label]. */
  offerLinks: [OfferMatch, string, string][];
  /** The artwork that ships with the store, for "Restore original". */
  defaultImages: {
    heroDesktop: string;
    personalised: string;
    personalisedMobile: string;
    offers: string[];
  };
  returnWindows: number[];
  dispatchCutoffs: number[];
  categoryTints: string[];
  /** The code maps behind AJ-{CATEGORY}{NUMBER}-{COLOUR}. */
  skuCodes: { categories: Record<string, string>; colors: Record<string, string> };
}

/** Empty shape for the first render, before the query resolves. */
export const EMPTY_REFERENCE: Reference = {
  adjustReasons: [], returnReasons: [], refundMethods: [], payModes: [],
  nextStep: {}, orderSteps: [], returnSteps: [], photoSlots: [], offerLinks: [],
  defaultImages: { heroDesktop: '', personalised: '', personalisedMobile: '', offers: [] },
  returnWindows: [], dispatchCutoffs: [], categoryTints: [],
  skuCodes: { categories: {}, colors: {} },
};

export const meta = {
  categories: () => req<Category[]>('/admin/meta/categories'),
  colors: () => req<Record<ColorKey, ColorDef>>('/admin/meta/colors'),
  config: () => req<Config>('/admin/meta/config'),
  badges: () => req<NavBadges>('/admin/meta/badges'),
  reference: () => req<Reference>('/admin/meta/reference'),
};
