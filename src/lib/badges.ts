/* Status badge text and colours, copied from the ST / RST / PAY / LEDGER / CH maps and the
   stock pills in the prototype. */
import type { Channel, LedgerReason, OrderStatus, PaymentStatus, ReturnStatus } from '@/data/types';

export interface Badge {
  text: string;
  fg: string;
  bg: string;
}

const B = (text: string, fg: string, bg: string): Badge => ({ text, fg, bg });

export const ORDER_STATUS: Record<OrderStatus, Badge> = {
  new: B('New', '#A8822F', '#FAF4E6'),
  packed: B('Packed', '#4B5157', '#EFF1F3'),
  shipped: B('Shipped', '#2F5D8A', '#E6EEF6'),
  out: B('Out for delivery', '#5B4A9A', '#ECE8F6'),
  delivered: B('Delivered', '#2F6B4F', '#E3F0E8'),
  cancelled: B('Cancelled', '#4B5157', '#EFF1F3'),
  completed: B('Completed', '#2F6B4F', '#E3F0E8'),
};

export const RETURN_STATUS: Record<ReturnStatus, Badge> = {
  requested: B('Needs review', '#A8822F', '#FAF4E6'),
  approved: B('Approved', '#4B5157', '#EFF1F3'),
  pickup: B('Pickup scheduled', '#2F5D8A', '#E6EEF6'),
  received: B('Item received', '#5B4A9A', '#ECE8F6'),
  completed: B('Resolved', '#2F6B4F', '#E3F0E8'),
  rejected: B('Rejected', '#4B5157', '#EFF1F3'),
};

export const PAYMENT_STATUS: Record<PaymentStatus, Badge> = {
  paid: B('Paid', '#2F6B4F', '#E3F0E8'),
  pending: B('Payment pending', '#8A4B12', '#FBEBD9'),
  refunded: B('Refunded', '#4B5157', '#EFF1F3'),
  partial: B('Part refunded', '#4B5157', '#EFF1F3'),
};

export const LEDGER_REASON: Record<LedgerReason, Badge> = {
  online: B('Online order', '#A8822F', '#FAF4E6'),
  offline: B('Offline sale', '#3D4248', '#EFF1F3'),
  cancel: B('Order cancelled', '#4B5157', '#EFF1F3'),
  return: B('Return restocked', '#2F6B4F', '#E3F0E8'),
  replacement: B('Replacement sent', '#5B4A9A', '#ECE8F6'),
  adjust: B('Manual adjustment', '#7A5A1F', '#F7EEDC'),
};

export const CHANNEL: Record<Channel, Badge> = {
  online: B('Online', '#A8822F', '#FAF4E6'),
  offline: B('Offline', '#3D4248', '#EFF1F3'),
};

export const STOCK_OUT = B('Out of stock', '#A63D40', '#FBEDEC');
export const STOCK_LOW = B('Low stock', '#7A5A1F', '#F7EEDC');
export const STOCK_OK = B('In stock', '#2F6B4F', '#E3F0E8');
export const leftBadge = (n: number): Badge => B(`${n} left`, '#7A5A1F', '#F7EEDC');

export const RETURN_TYPE = {
  replacement: B('Replacement', '#5B4A9A', '#ECE8F6'),
  refund: B('Refund', '#2F5D8A', '#E6EEF6'),
} as const;

/** Fall back to a neutral badge for a value the map doesn't know. */
export const badgeOf = <K extends string>(
  map: Record<K, Badge>,
  key: K | string,
): Badge => (map as Record<string, Badge>)[key] ?? B(String(key), '#4B5157', '#EFF1F3');
