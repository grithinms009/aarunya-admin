/* GST & invoicing — /api/admin/gst/*. The server is authoritative for every tax figure;
   money arrives as integer paise and is only ever formatted here, never computed. */
import { fetchBlob, req } from './client';

export interface GstAddress {
  line1: string;
  line2: string;
  city: string;
  pin: string;
}

export interface GstTemplate {
  terms: string;
  footerNote: string;
  signatureText: string;
  showSignature: boolean;
}

export interface GstSettings {
  registered: boolean;
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: string;
  verificationNote: string;
  gstin: string;
  legalName: string;
  tradeName: string;
  address: GstAddress;
  stateCode: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  priceMode: 'inclusive' | 'exclusive';
  rounding: 'line' | 'invoice';
  roundOffToRupee: boolean;
  reverseCharge: boolean;
  template: GstTemplate;
}

export type GstSettingsInput = Omit<
  GstSettings,
  'verified' | 'verifiedAt' | 'verifiedBy' | 'verificationNote'
>;

export interface GstSettingsView {
  settings: GstSettings;
  status: { active: boolean; problems: string[] };
  states: { code: string; name: string }[];
}

export interface HsnProduct {
  id: string;
  name: string;
  category: string;
  material: string;
  description: string;
  price: number;
  hsn: string | null;
  gstRateBp: number | null;
  status: 'verified' | 'unverified' | string;
  note: string;
  verifiedAt: string | null;
  verifiedBy: string;
  issue: string | null;
  stock: number;
}

export interface HsnList {
  items: HsnProduct[];
  summary: { total: number; needsAttention: number };
  reference: { hsn: string; rateBp: number; desc: string }[];
}

export interface ClassificationInput {
  hsn: string;
  gstRateBp: number | null;
  verified: boolean;
  note: string;
}

export interface BulkInput {
  ids?: string[];
  category?: string;
  hsn: string;
  gstRateBp: number;
  verified: boolean;
}

export interface BulkPreview {
  preview: true;
  count: number;
  products: string[];
}

export interface CreditNoteSummary {
  id: number;
  noteNo: string;
  kind: string;
  issuedAt: string;
  totalPaise: number;
  reason: string;
}

export interface InvoiceRow {
  id: number;
  invoiceNo: string;
  orderId: string;
  status: 'issued' | 'cancelled';
  issuedAt: string;
  customer: string;
  phone: string;
  placeOfSupply: string;
  placeOfSupplyName: string;
  taxType: 'intra' | 'inter';
  taxTypeLabel: string;
  taxablePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grandTotalPaise: number;
  receivedPaise: number;
  payStatus: string;
  legacy: boolean;
  creditedPaise: number;
  creditNotes: CreditNoteSummary[];
}

export interface InvoiceQuery {
  q?: string;
  from?: string;
  to?: string;
  status?: '' | 'issued' | 'cancelled';
}

export interface InvoiceList {
  rows: InvoiceRow[];
  summary: { count: number; taxablePaise: number; taxPaise: number; grandTotalPaise: number };
}

/* The detail payload stores supplier / customer / lines / totals as JSON snapshots, so
   they are read defensively. */
export type Snapshot = Record<string, unknown>;

export interface InvoiceDetail {
  invoice: {
    id: number;
    invoiceNo: string;
    orderId: string;
    status: 'issued' | 'cancelled';
    issuedAt: string;
    placeOfSupply: string;
    taxType: 'intra' | 'inter';
    priceMode: string;
    reverseCharge: boolean;
    supplier: Snapshot;
    customer: Snapshot;
    lines: Snapshot[];
    totals: Snapshot;
    legacy: boolean;
    cancelledAt: string | null;
    cancelReason: string | null;
  };
  creditNotes: {
    id: number;
    noteNo: string;
    kind: string;
    reason: string;
    issuedAt: string;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    returnId: string | null;
  }[];
  events: { event: string; actor: string; detail: unknown; at: string }[];
}

export interface PendingOrder {
  orderId: string;
  createdAt: string;
  customer: string;
  total: number;
  status: string;
  owesInvoice: boolean;
  issues: unknown[];
}

export interface CreditNoteInput {
  kind: 'cancellation' | 'refund';
  reason: string;
  /** Rupees, GST-inclusive; refund only. */
  amount?: number;
}

export interface SequenceView {
  currentFy: string;
  sequences: { series: 'INV' | 'CN'; fy: string; lastNo: number }[];
}

export interface ComplianceView {
  verifiedOn: string;
  items: { topic: string; applicable: boolean | 'conditional'; why: string }[];
}

const P = '/admin/gst';

export const gst = {
  settings: () => req<GstSettingsView>(`${P}/settings`),
  saveSettings: (b: GstSettingsInput) =>
    req<GstSettingsView>(`${P}/settings`, { method: 'PUT', body: b }),
  verify: (note: string) =>
    req<GstSettingsView>(`${P}/settings/verify`, { method: 'POST', body: { confirm: true, note } }),
  unverify: () => req<GstSettingsView>(`${P}/settings/unverify`, { method: 'POST' }),

  products: () => req<HsnList>(`${P}/products`),
  saveProduct: (id: string, b: ClassificationInput) =>
    req<HsnProduct>(`${P}/products/${encodeURIComponent(id)}`, { method: 'PUT', body: b }),
  bulkPreview: (b: BulkInput) =>
    req<BulkPreview>(`${P}/products/bulk`, { method: 'POST', body: { ...b, confirm: false } }),
  /** Only ever called after the admin has confirmed the count from bulkPreview. */
  bulkApply: (b: BulkInput, expectedCount: number) =>
    req<{ preview: false; updated: number }>(`${P}/products/bulk`, {
      method: 'POST',
      body: { ...b, confirm: true, expectedCount },
    }),

  invoices: (query: InvoiceQuery = {}) => req<InvoiceList>(`${P}/invoices`, { query: { ...query } }),
  invoice: (id: number) => req<InvoiceDetail>(`${P}/invoices/${id}`),
  pending: () => req<PendingOrder[]>(`${P}/pending`),
  generate: (orderId: string) =>
    req<InvoiceRow>(`${P}/orders/${encodeURIComponent(orderId)}/invoice`, { method: 'POST' }),
  creditNote: (invoiceId: number, b: CreditNoteInput) =>
    req<{ noteNo: string; id: number; cancelled: boolean }>(
      `${P}/invoices/${invoiceId}/credit-notes`,
      { method: 'POST', body: b },
    ),

  sequence: () => req<SequenceView>(`${P}/sequence`),
  setSequence: (series: 'INV' | 'CN', lastNo: number) =>
    req<{ series: string; fy: string; lastNo: number }>(`${P}/sequence`, {
      method: 'PUT',
      body: { series, lastNo },
    }),
  compliance: () => req<ComplianceView>(`${P}/compliance`),

  /** The PDF endpoints need the session cookie, so fetch, then hand the browser a Blob URL. */
  openInvoicePdf: (id: number) => openPdf(`${P}/invoices/${id}/pdf`),
  openCreditNotePdf: (id: number) => openPdf(`${P}/credit-notes/${id}/pdf`),
};

async function openPdf(path: string): Promise<void> {
  /* Open the tab synchronously (popup blockers), then point it at the blob. */
  const w = window.open('', '_blank');
  try {
    const blob = await fetchBlob(path);
    const url = URL.createObjectURL(blob);
    if (w) w.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Basis points → "3" / "1.5" for the admin; the inverse for the API. */
export const bpToPct = (bp: number | null | undefined): string =>
  bp == null ? '' : String(Math.round(bp) / 100);
export const pctToBp = (pct: string): number | null => {
  if (pct.trim() === '') return null;
  const n = Number(pct);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
