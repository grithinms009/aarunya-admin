/* The only module the UI talks to for server data. Swap each file's body for fetch calls
   when the Spring Boot API is ready; nothing in features/ changes. */
export { ApiError, auth } from './auth';
export { meta, type NavBadges } from './meta';
export {
  dashboard,
  type DashboardSummary,
  type LowStockRow,
  type Period,
  type TopSeller,
} from './dashboard';
export {
  ValidationError,
  products,
  type ProductFlag,
  type ProductListResult,
  type ProductQuery,
  type ProductSort,
  type StockFilter,
} from './products';
export { media, type DescriptionInput, type GeneratedLook } from './media';
export { ConflictError, categories, type CategoryDraft } from './categories';
export {
  ADJUST_REASONS,
  inventory,
  type AdjustMode,
  type AdjustReason,
  type InventorySummary,
  type LedgerQuery,
  type StockQuery,
  type StockRow,
} from './inventory';
