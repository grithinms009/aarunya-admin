/* Entity shapes, ported from design_handoff_aarunya_admin/aarunya-admin-db.js and
   aarunya-api.js. These are the shapes the backend will serve, so the UI is written
   against them and only src/api/* changes when the API lands. */

export type ColorKey = string;

export interface ColorDef {
  label: string;
  hex: string;
  /** Pale version of hex, used as an image placeholder background on the store. */
  tint: string;
}

export type ProductStatus = 'active' | 'draft';

export interface Variant {
  id: string;
  color: ColorKey;
  stock: number;
  sku: string;
  /** [front, on model, detail] — may be shorter or hold empty strings. */
  images: string[];
}

export interface Spec {
  k: string;
  v: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  /** Sub-category slug, or null. */
  type: string | null;
  popularity: number;
  price: number;
  mrp: number;
  featured: boolean;
  isNew: boolean;
  createdAt: string;
  rating: number | null;
  reviewCount: number;
  description: string;
  material: string;
  status: ProductStatus;
  giftWrap: boolean;
  exchange: boolean;
  seoTitle: string;
  seoDesc: string;
  specs: Spec[];
  variants: Variant[];
}

export interface SubCategory {
  slug: string;
  name: string;
}

export interface Category {
  slug: string;
  name: string;
  short: string;
  /** Placeholder label stem on the store, e.g. "necklace". */
  ph: string;
  tint: string;
  image: string;
  subs: SubCategory[];
  /** Category slugs suggested by "Pair it up". */
  pairs: string[];
}

export type Channel = 'online' | 'offline';
export type OrderStatus =
  | 'new'
  | 'packed'
  | 'shipped'
  | 'out'
  | 'delivered'
  | 'cancelled'
  | 'completed';
export type PaymentStatus = 'paid' | 'pending' | 'refunded' | 'partial';

export interface OrderCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pin: string;
}

export interface OrderItem {
  pid: string;
  vid: string;
  name: string;
  color: ColorKey;
  sku: string;
  qty: number;
  price: number;
  img: string;
}

export interface Payment {
  status: PaymentStatus;
  method: string;
  provider?: string;
  ref?: string;
}

export interface Shipment {
  courier: string;
  awb: string;
  shippedAt: string;
}

export interface HistoryEntry {
  at: string;
  status: string;
  note: string;
}

export interface Order {
  id: string;
  channel: Channel;
  createdAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  giftWrap: boolean;
  giftFee: number;
  discount: number;
  total: number;
  payment: Payment;
  status: OrderStatus;
  shipment: Shipment | null;
  location: string;
  note: string;
  history: HistoryEntry[];
  /** Set when a return or exchange has been raised against this order. */
  returnId?: string;
}

export type ReturnType = 'replacement' | 'refund';
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'pickup'
  | 'received'
  | 'completed'
  | 'rejected';

export interface ReturnRequest {
  id: string;
  orderId: string;
  customer: { name: string; phone: string };
  item: OrderItem;
  type: ReturnType;
  reason: string;
  note: string;
  video: boolean;
  photos: number;
  createdAt: string;
  deliveredAt: string;
  status: ReturnStatus;
  resolution: string;
  restocked?: boolean;
  pickup: { courier: string; date: string } | null;
  history: HistoryEntry[];
}

export type LedgerReason =
  | 'online'
  | 'offline'
  | 'cancel'
  | 'return'
  | 'replacement'
  | 'adjust';

export interface LedgerEntry {
  at: string;
  pid: string;
  vid: string;
  sku: string;
  name: string;
  color: ColorKey;
  change: number;
  reason: LedgerReason;
  ref: string;
  note?: string;
}

export interface Banners {
  heroDesktop: string;
  heroMobile: string;
  heroAlt: string;
  personalised: string;
  personalisedMobile: string;
  personalisedAlt: string;
  personalisedCta: string;
}

export type OfferMatch = 'sale' | 'u500' | '500-1000' | 'o1000';

export interface Offer {
  badge: string;
  title: string;
  accent: string;
  sub: string;
  cta: string;
  href: string;
  match: OfferMatch;
  image: string;
  /** Natural image width; the store sizes columns proportionally. */
  w: number;
  btn: 'solid' | 'outline';
  /** CTA position over the artwork, as a percentage. */
  bx: number;
  by: number;
  alt: string;
  hidden?: boolean;
}

export interface Courier {
  id: string;
  name: string;
  /** {awb} is replaced by the tracking number. */
  url: string;
}

export interface Config {
  WHATSAPP_NUMBER: string;
  WHATSAPP_TEXT: string;
  INSTAGRAM_HANDLE: string;
  EMAIL: string;
  FREE_SHIPPING_THRESHOLD: number;
  SHIPPING_FEE: number;
  GIFT_WRAP_FEE: number;
  DISPATCH_CUTOFF_HOUR: number;
  PAYMENT_PROVIDER: 'razorpay' | 'cashfree';
  HOME_STATE_PIN_PREFIXES: string[];
  DELIVERY_DAYS: Record<string, [number, number]>;
  LOW_STOCK: number;
  couriers: Courier[];
  defaultCourier: string;
  notifyOnShip: boolean;
  shipMsg: string;
  returnWindow: number;
  /** Category slugs that can only be exchanged when damaged. */
  nonEligible: string[];
  requireVideo: boolean;
  allowRefund: boolean;
  locations: string[];
}

export interface AdminUser {
  email: string;
  name: string;
}

/** The whole admin dataset. Mirrors what the backend will expose per resource. */
export interface AdminDb {
  v: number;
  products: Product[];
  categories: Category[];
  colors: Record<ColorKey, ColorDef>;
  banners: Banners;
  offers: Offer[];
  announcements: string[];
  config: Config;
  orders: Order[];
  returns: ReturnRequest[];
  ledger: LedgerEntry[];
  admin: AdminUser & { pass: string };
}
