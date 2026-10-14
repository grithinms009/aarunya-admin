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
