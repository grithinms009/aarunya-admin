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
export {
  NEXT_STEP,
  ORDER_STEPS,
  RuleError,
  orders,
  type DateRange,
  type OrderListResult,
  type OrderQuery,
} from './orders';
export {
  RETURN_REASONS,
  RETURN_STEPS,
  ReturnRuleError,
  eligibility,
  returns,
  type Eligibility,
  type ReturnListResult,
  type ReturnQuery,
  type ReturnTab,
} from './returns';
export {
  DEFAULT_IMAGES,
  OFFER_LINKS,
  storefront,
  type StorefrontContent,
} from './storefront';
export { customers, type CustomerQuery, type CustomerRow } from './customers';
export {
  SettingsValidationError,
  settings,
  type SettingsDraftInput,
  type SettingsPayload,
} from './settings';
