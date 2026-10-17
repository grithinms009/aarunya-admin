/* Admin panel scenario tests, driven as a real user. */
import { execFileSync } from 'node:child_process';
import { launchChrome, openTab, stopChrome, check, scenario, summary } from './harness.mjs';

const ADMIN = 'http://localhost:5174';
const BACKEND = process.env.BACKEND_DIR || new URL('../../aarunya-backend', import.meta.url).pathname;

/* Every run starts from the same empty store, so results are repeatable. */
console.log('resetting the store…');
execFileSync('npm', ['run', 'db:reset'], { cwd: BACKEND, stdio: 'pipe' });
const SHOTS = process.argv[2] || new URL('../test-screenshots', import.meta.url).pathname;

await launchChrome();
const t = await openTab(ADMIN + '/');
await t.wait(`document.querySelector('#root')?.children.length>0`, 'mount');
await t.pause(800);

/* ---------------------------------------------------------------- sign in */
let s = scenario('Sign in');
if (await t.ev(`!!document.querySelector('input[type=email]')`)) {
  check(s, 'login screen shown when signed out', true);
  await t.type('input[type=email]', 'veena@aarunyajewels.in');
  await t.type('input[type=password]', 'wrong-password');
  await t.ev(`document.querySelector('button[type=submit]').click()`);
  await t.pause(1800);
  check(s, 'wrong password is rejected with a message',
    await t.has('don.t match|incorrect|try again'), (await t.text()).match(/don.t match[^\n]*/i)?.[0] ?? '');

  await t.setInput('input[type=password]', 'aarunya123');
  await t.ev(`document.querySelector('button[type=submit]').click()`);
}
await t.wait(`document.body.innerText.includes('Dashboard')`, 'dashboard');
await t.pause(1200);
check(s, 'correct password signs in', await t.has('Dashboard'));

/* ---------------------------------------------------------------- empty store */
const EMPTY_PAGES = [
  ['/dashboard', 'Dashboard'],
  ['/products', 'Products'],
  ['/categories', 'Categories'],
  ['/inventory', 'Inventory'],
  ['/orders', 'Orders'],
  ['/returns', 'Returns'],
  ['/customers', 'Customers'],
  ['/pos', 'Offline sale'],
  ['/storefront', 'Banners'],
  ['/settings', 'Settings'],
];

s = scenario('Every screen on an empty store');
for (const [path, heading] of EMPTY_PAGES) {
  t.clear();
  await t.route(path, 2200);
  const body = await t.text();
  /* The content region, excluding the fixed nav, is what the user came for. */
  const main = await t.ev(`(()=>{const m=document.querySelector('main')||document.querySelector('#root')?.lastElementChild;
    return (m?.innerText||'').replace(/\\s+/g,' ').trim()})()`) || '';
  const thin = main.length < 80;
  check(s, `${path} renders content`, !thin && body.includes(heading),
    thin ? `content area only ${main.length} chars` : '');
  check(s, `${path} has no console errors`, t.errors.length === 0, t.errors[0] ?? '');
  check(s, `${path} has no failing API calls`, t.netErrors.length === 0, t.netErrors[0] ?? '');
}

/* ---------------------------------------------------------------- prerequisite guidance */
s = scenario('Prerequisites are explained, not left blank');

t.clear();
await t.route('/products/new', 2600);
check(s, 'Add product with no categories explains what to do first',
  await t.has('create a category first'),
  (await t.text()).replace(/\s+/g,' ').slice(-90));
await t.shot(SHOTS, '01-new-product-no-categories');

await t.route('/pos', 2200);
check(s, 'Offline sale with no products guides the user',
  await t.has('nothing to sell'),
  (await t.text()).slice(-120));
await t.shot(SHOTS, '02-pos-no-products');

await t.route('/returns', 2200);
await t.click('Log a request');
await t.pause(1500);
check(s, 'Log a request with no orders guides the user',
  await t.has('no orders to raise a request against'),
  (await t.text()).slice(-140));
await t.shot(SHOTS, '03-log-request-no-orders');
await t.click('Cancel|Close');
await t.pause(600);

await t.route('/inventory', 2200);
check(s, 'Inventory with no products guides the user',
  await t.has('no stock to show yet'),
  '');

for (const [path, phrase] of [['/products','no products yet'],['/categories','no categories yet'],
                              ['/orders','no orders yet'],['/customers','no customers yet'],
                              ['/returns','no return requests']]) {
  await t.route(path, 2200);
  check(s, `${path} says nothing exists yet, not that a filter matched nothing`,
    await t.has(phrase), (await t.text()).slice(-90).replace(/\s+/g,' '));
}

/* ---------------------------------------------------------------- set the shop up */
s = scenario('Setting the shop up');

await t.route('/settings', 2400);
await t.click('Add colour', { exact: false });
await t.pause(500);
await t.setInput('input[aria-label="Colour name"]', 'Gold', 'last');
await t.pause(300);
await t.click('Save settings');
await t.pause(2200);
check(s, 'colour saved', await t.has('Settings saved'), (await t.text()).match(/Settings saved|fix the highlighted/i)?.[0] ?? '');

await t.route('/categories', 2000);
await t.click('Add category');
await t.pause(1200);
await t.setInput('input[placeholder="e.g. Anti-Tarnish Anklets"]', 'Anti-Tarnish Necklaces');
await t.pause(400);
await t.click('Add category', { exact: true, nth: 'last' });
await t.pause(2200);
check(s, 'category created', await t.has('Necklaces'), '');

t.clear();
await t.route('/products/new', 2600);
check(s, 'Add product now shows the form', await t.has('Product details'), '');
await t.setInput('input[placeholder="e.g. Mango Mala Necklace"]', 'Pearl Drop Choker');
await t.pause(500);
await t.setSelectByText('Necklaces');
await t.pause(700);
await t.setInput('input[placeholder="0"]', '899');
await t.setInput('input[placeholder="Same as price"]', '1199');
await t.pause(400);
const colour = await t.setSelectByText('^Gold$');
check(s, 'the colour added in Settings is selectable', !!colour, String(colour));
await t.setInput('input[placeholder="0"]', '5', 'last');
await t.pause(400);

/* save with a missing name to see validation */
await t.setInput('input[placeholder="e.g. Mango Mala Necklace"]', '');
await t.pause(300);
await t.click('Save product');
await t.pause(2000);
check(s, 'saving without a name shows a field error',
  await t.has('Add a product name|fix the highlighted'), '');

await t.setInput('input[placeholder="e.g. Mango Mala Necklace"]', 'Pearl Drop Choker');
await t.pause(400);
await t.click('Save product');
await t.pause(2600);
check(s, 'product saves', /\/products\/p/.test(await t.ev('location.pathname')),
  await t.ev('location.pathname'));
check(s, 'no console errors while saving', t.errors.length === 0, t.errors[0] ?? '');

/* ---------------------------------------------------------------- operations */
s = scenario('Day-to-day operations');

t.clear();
await t.route('/pos', 2400);
check(s, 'POS lists the product', await t.has('Pearl Drop Choker'), '');
await t.click('Gold');
await t.pause(1200);
check(s, 'adding a colour fills the bill', await t.has('1 item|Record sale'), '');
await t.click('Record sale');
await t.pause(2600);
check(s, 'offline sale recorded', await t.has('OS2|sale recorded|Sale recorded|WhatsApp receipt'),
  (await t.text()).slice(-120));
check(s, 'no errors recording a sale', t.errors.length === 0, t.errors[0] ?? '');

t.clear();
await t.route('/orders', 2400);
check(s, 'the offline sale appears in orders', await t.has('OS2'), '');

await t.route('/inventory', 2400);
check(s, 'inventory shows the variant', await t.has('Pearl Drop Choker'), '');
check(s, 'stock went down after the sale', await t.has('\\b4\\b'), '');

await t.route('/customers', 2200);
check(s, 'customers screen loads after a sale', await t.has('Customer|customers|No customers'), '');

t.clear();
await t.route('/settings', 2400);
await t.setInput('input[value="919747738193"], input[name=WHATSAPP_NUMBER]', '123');
await t.pause(300);
await t.click('Save settings');
await t.pause(2000);
check(s, 'bad WhatsApp number is rejected',
  await t.has('country code|fix the highlighted'), (await t.text()).match(/country code[^\n]*/i)?.[0] ?? '');

/* ---------------------------------------------------------------- order workflow */
s = scenario('Order workflow in the drawer');

/* place a website order so there is something with a payment state to move through */
const place = await fetch('http://localhost:4000/api/orders', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer: { name: 'Asha Menon', phone: '9876500011', email: 'asha@example.com',
      address: 'MG Road', house: '14B', city: 'Thrissur', state: 'Kerala', pin: '680001' },
    items: [{ productId: 'x', variantId: await (async () => {
      const r = await fetch('http://localhost:4000/api/products'); const p = (await r.json())[0];
      return p.variants[0].id; })(), qty: 1 }],
    giftWrap: false }),
});
const placedOrder = await place.json();
check(s, 'a website order can be placed for the test', !!placedOrder.orderId, placedOrder.orderId ?? JSON.stringify(placedOrder).slice(0,60));

t.clear();
await t.route('/orders', 2600);
await t.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/AJ10\\d\\d/.test(x.textContent||''));b&&b.click();return !!b})()`);
await t.pause(2000);
check(s, 'the order drawer opens', await t.has('Customer|Shipping & tracking'), '');
check(s, 'an unpaid order is flagged', await t.has('pending|Mark as paid'), '');

/* advancing an unpaid order must be refused, not silently allowed */
await t.click('Mark as packed');
await t.pause(1800);
check(s, 'an unpaid order cannot be advanced',
  await t.has('payment is still pending|mark it as paid'),
  (await t.text()).match(/payment is still pending[^\n]*/i)?.[0] ?? '');

await t.click('Mark as paid');
await t.pause(2000);
await t.click('Mark as packed');
await t.pause(2200);
check(s, 'a paid order advances to packed', await t.has('Packed'), '');

await t.click('Mark as shipped');
await t.pause(2000);
check(s, 'shipping without a tracking number is refused',
  await t.has('tracking number|courier'), '');
check(s, 'no console errors through the order flow', t.errors.length === 0, t.errors[0] ?? '');
await t.shot(SHOTS, '04-order-drawer');

/* ---------------------------------------------------------------- returns workflow */
s = scenario('Returns workflow');
t.clear();
await t.route('/returns', 2400);
await t.click('Log a request');
await t.pause(1600);
check(s, 'the log-request form is usable once orders exist',
  await t.has('Order') && !(await t.has('no orders to raise')), '');
await t.click('Log request', { exact: true, nth: 'last' });
await t.pause(2400);
check(s, 'a request is created', await t.has('RX3'), (await t.text()).match(/RX\d+/)?.[0] ?? '');
check(s, 'no console errors logging a request', t.errors.length === 0, t.errors[0] ?? '');

await t.route('/returns', 2400);
await t.ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>/RX3/.test(x.textContent||''));b&&b.click();return !!b})()`);
await t.pause(2200);
check(s, 'the return drawer opens with a policy check',
  await t.has('policy|within|eligib'), '');
await t.shot(SHOTS, '05-return-drawer');

console.log('\nconsole errors seen anywhere:', t.errors.length ? t.errors.join(' | ') : 'none');
await t.close();
stopChrome();
process.exit(summary() ? 1 : 0);
