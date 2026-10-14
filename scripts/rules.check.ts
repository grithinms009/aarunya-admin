/* Headless check of the data layer and the business rules. */
import { buildSeed } from '@/data/seed/demo';
import { orders } from '@/api/orders';
import { inventory } from '@/api/inventory';
import { returns } from '@/api/returns';
import { products } from '@/api/products';
import { db, findVariant, resetDb } from '@/api/mock/store';

const fails: string[] = [];
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) fails.push(`${name} ${extra}`);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
};

const seed = buildSeed();
ok('seed products', seed.products.length === 16, `(${seed.products.length})`);
ok('seed categories', seed.categories.length === 8, `(${seed.categories.length})`);
ok('seed orders', seed.orders.length === 31, `(${seed.orders.length})`);
ok('seed returns', seed.returns.length === 6, `(${seed.returns.length})`);
ok('seed ledger', seed.ledger.length > 30, `(${seed.ledger.length})`);
ok('every variant has a SKU', seed.products.every((p) => p.variants.every((v) => /^AJ-[A-Z]{2}\d{3}-[A-Z]{3}$/.test(v.sku))));
ok('online ids sequential from AJ1041', seed.orders.filter((o) => o.channel === 'online').some((o) => o.id === 'AJ1041'));
ok('offline ids start at OS212', seed.orders.filter((o) => o.channel === 'offline').some((o) => o.id === 'OS212'));
ok('shipping free at 499+', seed.orders.filter((o) => o.channel === 'online').every((o) => (o.subtotal >= 499 ? o.shipping === 0 : o.shipping === 60)));

resetDb();

(async () => {
  /* Offline sale reduces stock and writes exactly one ledger row per line. */
  const d0 = db();
  const p = d0.products.find((x) => x.variants[0].stock > 2)!;
  const v = p.variants[0];
  const before = v.stock;
  const ledgerBefore = d0.ledger.length;

  const sale = await orders.recordOfflineSale({
    lines: [{ pid: p.id, vid: v.id, name: p.name, color: v.color, sku: v.sku, img: '', qty: 2, price: p.price }],
    discount: 50, method: 'Cash', location: 'Walk-in', date: '', name: 'Test', phone: '', note: '',
  });
  const [, vAfter] = findVariant(db(), v.id);
  ok('offline sale number', /^OS\d+$/.test(sale.id), sale.id);
  ok('offline sale reduces stock', vAfter!.stock === before - 2, `${before} -> ${vAfter!.stock}`);
  ok('offline sale totals', sale.total === p.price * 2 - 50, String(sale.total));
  ok('one ledger row per line', db().ledger.length === ledgerBefore + 1);
  ok('ledger row is the sale', db().ledger[0].ref === sale.id && db().ledger[0].change === -2);

  /* Cancelling restores stock and refunds a paid order. */
  await orders.cancel(sale.id);
  const [, vCancelled] = findVariant(db(), v.id);
  ok('cancel restores stock', vCancelled!.stock === before, String(vCancelled!.stock));
  ok('cancel refunds payment', db().orders.find((o) => o.id === sale.id)!.payment.status === 'refunded');

  /* Advance is blocked while payment is pending, and shipped needs an AWB. */
  const pending = db().orders.find((o) => o.payment.status === 'pending' && o.status === 'new');
  if (pending) {
    await orders.advance(pending.id, { courier: 'shiprocket', awb: '' }).then(
      () => ok('advance blocked while pending', false),
      (e) => ok('advance blocked while pending', /pending/i.test(e.message)),
    );
  }
  const packed = db().orders.find((o) => o.status === 'packed' && o.payment.status === 'paid');
  if (packed) {
    await orders.advance(packed.id, { courier: 'shiprocket', awb: '' }).then(
      () => ok('shipped needs an AWB', false),
      (e) => ok('shipped needs an AWB', /tracking/i.test(e.message)),
    );
    const shipped = await orders.advance(packed.id, { courier: 'shiprocket', awb: '123456789012' });
    ok('advance with AWB works', shipped.status === 'shipped' && shipped.shipment?.awb === '123456789012');
  }

  /* Stock never goes below zero. */
  const [, low] = findVariant(db(), v.id);
  await inventory.adjust({ vid: v.id, mode: 'remove', qty: low!.stock + 50, reason: 'damaged', note: '' });
  const [, zeroed] = findVariant(db(), v.id);
  ok('stock clamps at zero', zeroed!.stock === 0, String(zeroed!.stock));

  /* Set-exact adjustment and the ledger note. */
  await inventory.adjust({ vid: v.id, mode: 'set', qty: 7, reason: 'correction', note: 'audit' });
  const [, set7] = findVariant(db(), v.id);
  ok('set exact stock', set7!.stock === 7, String(set7!.stock));
  ok('adjust ledger note', db().ledger[0].note === 'Stock count correction · audit', db().ledger[0].note ?? '');

  /* Product validation. */
  const draft = { ...db().products[0], name: '', price: 0 };
  await products.save(draft as never, false).then(
    () => ok('product validation', false),
    (e) => ok('product validation', !!e.fields.name && !!e.fields.price, JSON.stringify(e.fields)),
  );

  const dup = await products.duplicate(db().products[0].id);
  ok('duplicate is a draft', dup.status === 'draft');
  ok('duplicate has zero stock', dup.variants.every((x) => x.stock === 0));
  ok('duplicate SKUs suffixed', dup.variants.every((x) => x.sku.endsWith('-C')));

  /* Returns: restock adds back, replacement takes one, refund marks the order. */
  const pickup = db().returns.find((r) => r.status === 'pickup')!;
  const [, rv0] = findVariant(db(), pickup.item.vid);
  const stockBefore = rv0!.stock;
  await returns.receive(pickup.id, true);
  const [, rv1] = findVariant(db(), pickup.item.vid);
  ok('restocked return adds stock', rv1!.stock === stockBefore + (pickup.item.qty || 1));
  ok('return ledger reason', db().ledger[0].reason === 'return');

  const refunded = await returns.refund(pickup.id, 10, 'UPI');
  ok('part refund marks order', db().orders.find((o) => o.id === refunded.orderId)!.payment.status === 'partial');

  const eligibility = returns.eligibility(db().returns.find((r) => r.reason === 'Changed my mind')!);
  ok('change of mind fails category rule', !eligibility.ok);

  const summary = await inventory.summary();
  ok('inventory summary', summary.units > 0 && summary.variants === db().products.flatMap((x) => x.variants).length);

  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})();
