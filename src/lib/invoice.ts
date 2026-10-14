/* Printable invoice. The backend will render this server-side at
   GET /api/admin/orders/{orderNo}/invoice; until then it is built and printed here,
   from the same order data. */
import { fDT, inr } from './format';
import type { Config, Order } from '@/data/types';

export function printInvoice(
  o: Order,
  config: Config,
  colorLabel: (key: string) => string,
): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;

  const rows = o.items
    .map(
      (l) =>
        `<tr><td>${l.name}<br><small>${colorLabel(l.color)} · ${l.sku || ''}</small></td><td>${
          l.qty
        }</td><td>${inr(l.price)}</td><td>${inr(l.price * l.qty)}</td></tr>`,
    )
    .join('');

  const extra = [
    o.discount ? ['Discount', '−' + inr(o.discount)] : null,
    o.channel === 'online' ? ['Shipping', o.shipping ? inr(o.shipping) : 'Free'] : null,
    o.giftWrap ? ['Gift wrap', inr(o.giftFee)] : null,
  ]
    .filter((x): x is [string, string] => x !== null)
    .map(([k, v]) => `<tr><td colspan="3">${k}</td><td>${v}</td></tr>`)
    .join('');

  const address = o.customer.address
    ? `<br>${o.customer.address}, ${o.customer.city}, ${o.customer.state} ${o.customer.pin}`
    : '';

  w.document.write(`<!doctype html><html><head><title>Invoice ${o.id}</title><style>
body{font-family:Georgia,serif;color:#1E2125;max-width:720px;margin:40px auto;padding:0 24px}
h1{font-weight:500;margin:0}
table{width:100%;border-collapse:collapse;margin-top:24px;font-family:Arial,sans-serif;font-size:13px}
td,th{padding:10px 6px;border-bottom:1px solid #eee;text-align:left}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6B7178}
td:not(:first-child),th:not(:first-child){text-align:right}
.t td{font-weight:bold;font-size:15px;border:none}
small{color:#6B7178}
.m{font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#3D4248}
</style></head><body>
<h1>Aarunya Jewels by Veena</h1>
<p class="m">${config.EMAIL} · +${config.WHATSAPP_NUMBER}</p>
<p class="m"><b>Invoice ${o.id}</b> · ${fDT(o.createdAt)}<br>${
    o.customer.name || 'Walk-in customer'
  }${o.customer.phone ? ' · ' + o.customer.phone : ''}${address}</p>
<table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
${rows}
<tr><td colspan="3">Subtotal</td><td>${inr(o.subtotal)}</td></tr>
${extra}
<tr class="t"><td colspan="3">Total</td><td>${inr(o.total)}</td></tr></table>
<p class="m">Paid by ${o.payment.method || '—'}. Prices include all taxes.</p>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
