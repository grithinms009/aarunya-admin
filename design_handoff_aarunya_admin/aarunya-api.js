(function () {
// Aarunya Jewels by Veena — config, mock data and API service layer.
// Loaded as a plain <script>; everything is exposed on window.AarunyaAPI (see bottom).
// To connect the Spring Boot backend: set USE_MOCK = false and API_BASE to your server.
// UI code only talks to `api.*`, so nothing else needs to change.

const CONFIG = {
  API_BASE: 'http://localhost:8080/api',
  USE_MOCK: true,
  WHATSAPP_NUMBER: '919876543210', // country code + number, digits only — REPLACE
  WHATSAPP_TEXT: 'Hi Aarunya Jewels by Veena, I would like to know more about your jewellery.',
  INSTAGRAM_HANDLE: 'aarunyajewelsbyveena',
  EMAIL: 'hello@aarunyajewels.in', // REPLACE
  FREE_SHIPPING_THRESHOLD: 499,
  SHIPPING_FEE: 60,
  PAYMENT_PROVIDER: 'razorpay', // or 'cashfree'
  GIFT_WRAP_FEE: 49, // REVIEW — set 0 for free gift wrap
  DISPATCH_CUTOFF_HOUR: 16, // orders before 4 pm dispatch the same working day
  HOME_STATE_PIN_PREFIXES: ['67', '68', '69'], // Kerala — faster delivery
  DELIVERY_DAYS: { local: [2, 3], rest: [4, 7] },
};

// Scrolling announcement bar at the top of every page. Add / remove offers here.
const ANNOUNCEMENTS = [
  'Pan India Shipping',
  'Free Shipping on Orders Above ₹499',
  'Anti-Tarnish Jewellery, Made for Everyday',
  'New Arrivals Every Week',
];

// Colour options a variant may use. Each product only lists the colours it is made in.
const COLORS = {
  gold:   { label: 'Gold',      hex: '#CDA349', tint: '#F5E8CD' },
  rose:   { label: 'Rose Gold', hex: '#D9A38E', tint: '#F7E1D9' },
  silver: { label: 'Silver',    hex: '#C3C7CC', tint: '#ECEDEF' },
  black:  { label: 'Black',     hex: '#2E2826', tint: '#E6DFDC' },
  green:  { label: 'Green',     hex: '#3F7B5D', tint: '#DFECE3' },
};

// subs: optional sub-categories ("types"). Products reference one via `type`.
const CATEGORIES = [
  { slug: 'necklaces',  name: 'Anti-Tarnish Necklaces',  short: 'Necklaces',  ph: 'necklace',  tint: '#F7E4E4',
    subs: [{ slug: 'short', name: 'Short Necklaces' }, { slug: 'long', name: 'Long Necklaces' }, { slug: 'chokers', name: 'Chokers' }, { slug: 'layered', name: 'Layered Necklaces' }] },
  { slug: 'bangles',    name: 'Anti-Tarnish Bangles',    short: 'Bangles',    ph: 'bangle',    tint: '#F5ECDD',
    subs: [{ slug: 'kadas', name: 'Kadas' }, { slug: 'bangle-sets', name: 'Bangle Sets' }, { slug: 'stone', name: 'Stone Bangles' }] },
  { slug: 'bracelets',  name: 'Anti-Tarnish Bracelets',  short: 'Bracelets',  ph: 'bracelet',  tint: '#F3E1D7',
    subs: [{ slug: 'chain', name: 'Chain Bracelets' }, { slug: 'charm', name: 'Charm Bracelets' }, { slug: 'cuffs', name: 'Cuffs' }] },
  { slug: 'rings',      name: 'Anti-Tarnish Rings',      short: 'Rings',      ph: 'ring',      tint: '#F7E4E4' },
  { slug: 'handchains', name: 'Anti-Tarnish Handchains', short: 'Handchains', ph: 'handchain', tint: '#F5ECDD' },
  { slug: 'hipchains',  name: 'Anti-Tarnish Hipchains',  short: 'Hipchains',  ph: 'hipchain',  tint: '#F3E1D7' },
  { slug: 'earrings',   name: 'Anti-Tarnish Earrings',   short: 'Earrings',   ph: 'earring',   tint: '#F7E4E4',
    subs: [{ slug: 'studs', name: 'Studs' }, { slug: 'jhumkas', name: 'Jhumkas' }, { slug: 'drops', name: 'Drops & Danglers' }, { slug: 'hoops', name: 'Hoops' }] },
  { slug: 'nose-rings', name: 'Anti-Tarnish Nose Rings', short: 'Nose Rings', ph: 'nose ring', tint: '#F5ECDD',
    subs: [{ slug: 'nose-pins', name: 'Nose Pins' }, { slug: 'clip-ons', name: 'Clip-ons' }, { slug: 'nath', name: 'Nath' }] },
];

// Home page "Sale & Offers" banners. match: 'sale' (MRP above price) or a price key ('u500', '500-1000', 'o1000').
// {maxOff} in badge is replaced with the biggest live discount.
const OFFERS = [
  { badge: 'Up to {maxOff}% off', title: 'Festive', accent: 'Sale Picks', sub: 'Real savings on everyday favourites', cta: 'Shop the sale', href: '#/shop?sale=1', match: 'sale', image: 'assets/offer-festive-sale.jpg', w: 846, btn: 'solid', bx: 6.74, by: 77.6 },
  { badge: 'Under ₹500', title: 'Little', accent: 'Gifts of Love', sub: 'Thoughtful pieces for every budget', cta: 'Find a gift', href: '#/shop?price=u500', match: 'u500', image: 'assets/offer-little-gifts.jpg', w: 878, btn: 'outline', bx: 5.81, by: 81 },
];

// "Pair it up" suggestions on the product page: which categories complete the look.
const PAIRINGS = {
  necklaces: ['earrings', 'bangles'], earrings: ['necklaces', 'rings'], bangles: ['earrings', 'rings'],
  bracelets: ['rings', 'necklaces'], rings: ['bracelets', 'earrings'], handchains: ['bangles', 'earrings'],
  hipchains: ['necklaces', 'earrings'], 'nose-rings': ['earrings', 'necklaces'],
};

// Variant: one colour of a product, with its own images and stock.
// images: array of URLs (front, on model, detail). Empty → UI shows a placeholder.
const v = (id, color, stock, images = []) => ({ id, color, stock, images });

// type: sub-category slug (or null). popularity: units sold, used for "Popularity" sort.
const PRODUCTS = [
  { id: 'p01', slug: 'mango-mala-necklace', name: 'Mango Mala Necklace', category: 'necklaces', type: 'long', popularity: 142, price: 1290, mrp: 1690, featured: true, isNew: false, createdAt: '2026-07-10', rating: null, reviewCount: 0,
    description: 'A Kerala-inspired mango motif necklace with a soft matte finish, made for festive mornings and family functions.',
    material: 'Brass base with anti-tarnish gold plating and kemp-style stones.',
    variants: [v('p01-gold', 'gold', 6), v('p01-rose', 'rose', 2)] },
  { id: 'p02', slug: 'pearl-drop-choker', name: 'Pearl Drop Choker', category: 'necklaces', type: 'chokers', popularity: 210, price: 899, mrp: 1199, featured: true, isNew: true, createdAt: '2026-09-20', rating: null, reviewCount: 0,
    description: 'A delicate choker with tiny pearl drops that sits close to the neck. Lovely with sarees and simple kurtis alike.',
    material: 'Stainless steel base with anti-tarnish plating and shell pearls.',
    variants: [v('p02-gold', 'gold', 8), v('p02-silver', 'silver', 4)] },
  { id: 'p03', slug: 'lakshmi-coin-short-necklace', name: 'Lakshmi Coin Short Necklace', category: 'necklaces', type: 'short', popularity: 64, price: 1490, mrp: 1490, featured: false, isNew: false, createdAt: '2026-05-02', rating: null, reviewCount: 0,
    description: 'Traditional coin necklace with Lakshmi motifs, a short length that works with every neckline.',
    material: 'Brass base with anti-tarnish gold plating.',
    variants: [v('p03-gold', 'gold', 3)] },
  { id: 'p04', slug: 'butterfly-pendant-chain', name: 'Butterfly Pendant Chain', category: 'necklaces', type: 'short', popularity: 188, price: 599, mrp: 799, featured: false, isNew: true, createdAt: '2026-09-28', rating: null, reviewCount: 0,
    description: 'A tiny butterfly on a fine chain. The kind of piece you put on once and forget to take off.',
    material: '316L stainless steel with anti-tarnish PVD coating.',
    variants: [v('p04-gold', 'gold', 10), v('p04-rose', 'rose', 5), v('p04-silver', 'silver', 0)] },
  { id: 'p05', slug: 'classic-kada-bangle-pair', name: 'Classic Kada Bangle Pair', category: 'bangles', type: 'kadas', popularity: 256, price: 749, mrp: 999, featured: true, isNew: false, createdAt: '2026-06-14', rating: null, reviewCount: 0,
    description: 'A pair of smooth, everyday kadas with a gentle shine. Stack them or wear one on each wrist.',
    material: 'Stainless steel with anti-tarnish PVD coating.',
    variants: [v('p05-gold', 'gold', 12), v('p05-rose', 'rose', 6), v('p05-silver', 'silver', 3)] },
  { id: 'p06', slug: 'emerald-stone-bangle-pair', name: 'Emerald Stone Bangle Pair', category: 'bangles', type: 'stone', popularity: 58, price: 849, mrp: 849, featured: false, isNew: false, createdAt: '2026-04-21', rating: null, reviewCount: 0,
    description: 'Gold-toned bangles set with a row of coloured stones, made for weddings and Onam.',
    material: 'Brass base with anti-tarnish gold plating and glass stones.',
    variants: [v('p06-green', 'green', 4), v('p06-black', 'black', 2)] },
  { id: 'p07', slug: 'twisted-rope-bracelet', name: 'Twisted Rope Bracelet', category: 'bracelets', type: 'chain', popularity: 173, price: 449, mrp: 599, featured: true, isNew: false, createdAt: '2026-03-30', rating: null, reviewCount: 0,
    description: 'A twisted rope bracelet with a secure lobster clasp. Light enough to wear every day.',
    material: '316L stainless steel with anti-tarnish PVD coating.',
    variants: [v('p07-gold', 'gold', 9), v('p07-silver', 'silver', 7), v('p07-rose', 'rose', 0)] },
  { id: 'p08', slug: 'evil-eye-charm-bracelet', name: 'Evil Eye Charm Bracelet', category: 'bracelets', type: 'charm', popularity: 121, price: 399, mrp: 549, featured: false, isNew: true, createdAt: '2026-09-12', rating: null, reviewCount: 0,
    description: 'A fine chain bracelet with a small evil eye charm, adjustable to fit most wrists.',
    material: 'Stainless steel with anti-tarnish plating and enamel charm.',
    variants: [v('p08-gold', 'gold', 15), v('p08-silver', 'silver', 6)] },
  { id: 'p09', slug: 'everyday-band-ring', name: 'Everyday Band Ring', category: 'rings', type: null, popularity: 96, price: 299, mrp: 299, featured: false, isNew: false, createdAt: '2026-02-18', rating: null, reviewCount: 0,
    description: 'A slim, comfortable band in four finishes. Wear one alone or stack a few.',
    material: '316L stainless steel with anti-tarnish PVD coating.',
    variants: [v('p09-gold', 'gold', 14), v('p09-silver', 'silver', 9), v('p09-rose', 'rose', 5), v('p09-black', 'black', 3)] },
  { id: 'p10', slug: 'floral-cz-adjustable-ring', name: 'Floral CZ Adjustable Ring', category: 'rings', type: null, popularity: 77, price: 349, mrp: 449, featured: false, isNew: true, createdAt: '2026-09-05', rating: null, reviewCount: 0,
    description: 'A little flower of sparkling stones on an adjustable band.',
    material: 'Brass base with anti-tarnish plating and cubic zirconia.',
    variants: [v('p10-gold', 'gold', 5), v('p10-rose', 'rose', 3)] },
  { id: 'p11', slug: 'petal-handchain', name: 'Petal Handchain', category: 'handchains', type: null, popularity: 49, price: 699, mrp: 899, featured: true, isNew: false, createdAt: '2026-06-01', rating: null, reviewCount: 0,
    description: 'A handchain with petal links that joins a ring and bracelet, pretty for mehendi and haldi.',
    material: 'Brass base with anti-tarnish gold plating.',
    variants: [v('p11-gold', 'gold', 4)] },
  { id: 'p12', slug: 'oddiyanam-hipchain', name: 'Oddiyanam Hipchain', category: 'hipchains', type: null, popularity: 31, price: 1890, mrp: 2290, featured: false, isNew: false, createdAt: '2026-05-19', rating: null, reviewCount: 0,
    description: 'A lightweight oddiyanam-style hipchain with temple detailing, adjustable at the back.',
    material: 'Brass base with anti-tarnish gold plating.',
    variants: [v('p12-gold', 'gold', 2)] },
  { id: 'p13', slug: 'mini-jhumka-drops', name: 'Mini Jhumka Drops', category: 'earrings', type: 'jhumkas', popularity: 298, price: 549, mrp: 699, featured: true, isNew: false, createdAt: '2026-07-22', rating: null, reviewCount: 0,
    description: 'Small, light jhumkas with a soft bell shape. Comfortable enough for a full day.',
    material: 'Brass base with anti-tarnish gold plating. Nickel-free hooks.',
    variants: [v('p13-gold', 'gold', 10), v('p13-green', 'green', 4)] },
  { id: 'p14', slug: 'pearl-huggie-hoops', name: 'Pearl Huggie Hoops', category: 'earrings', type: 'hoops', popularity: 134, price: 399, mrp: 399, featured: false, isNew: true, createdAt: '2026-09-16', rating: null, reviewCount: 0,
    description: 'Tiny huggie hoops with a single pearl drop.',
    material: 'Stainless steel with anti-tarnish plating and shell pearls.',
    variants: [v('p14-gold', 'gold', 8), v('p14-silver', 'silver', 5)] },
  { id: 'p15', slug: 'tiny-stud-nose-pin', name: 'Tiny Stud Nose Pin', category: 'nose-rings', type: 'nose-pins', popularity: 167, price: 199, mrp: 199, featured: false, isNew: false, createdAt: '2026-01-10', rating: null, reviewCount: 0,
    description: 'A tiny sparkling stud nose pin with a comfortable screw back.',
    material: 'Surgical steel with anti-tarnish plating.',
    variants: [v('p15-gold', 'gold', 20), v('p15-silver', 'silver', 12), v('p15-rose', 'rose', 6)] },
  { id: 'p16', slug: 'clip-on-nose-ring', name: 'Clip-on Nose Ring', category: 'nose-rings', type: 'clip-ons', popularity: 88, price: 249, mrp: 299, featured: false, isNew: false, createdAt: '2026-03-08', rating: null, reviewCount: 0,
    description: 'A clip-on nose ring, no piercing needed.',
    material: 'Brass base with anti-tarnish plating.',
    variants: [v('p16-gold', 'gold', 0)] },
];


// ---- DEMO PHOTOS (Unsplash, free licence) — replace with your own product shots ----
const U = (id) => `assets/demo/${id}.jpg`; // demo photos stored locally so the page works offline
const DEMO_IMAGES = {
  p01: ['1601121141461-9d6647bca1ed', '1722410180687-b05b50922362', '1601121141418-c1caa10a2a0b'],
  p02: ['1722410180670-b6d5a2e704fa', '1722410180644-5955f83ec8b1', '1601121141461-920cb1993441'],
  p03: ['1651160670627-2896ddf7822f', '1722410180687-b05b50922362', '1721807644561-9efcabee5c42'],
  p04: ['1611107683227-e9060eccd846', '1601121141461-920cb1993441', '1722410180644-5955f83ec8b1'],
  p05: ['1626784215013-13322cb0e471', '1679156271456-d6068c543ee7', '1721206625226-c064ff8d92a7'],
  p06: ['1724594888502-34f2b647ce33', '1626784215013-13322cb0e471', '1721206625226-c064ff8d92a7'],
  p07: ['1679156271456-d6068c543ee7', '1633810542706-90e5ff7557be', '1626784215013-13322cb0e471'],
  p08: ['1633810542706-90e5ff7557be', '1679156271456-d6068c543ee7', '1721807644561-9efcabee5c42'],
  p09: ['1689367436629-1d288f1e23b6', '1731406322264-dac59f83828b', '1724594963412-d98c3cd9eab6'],
  p10: ['1626784213922-d9f1e050cf8f', '1724594963412-d98c3cd9eab6', '1689367436629-1d288f1e23b6'],
  p11: ['1731406322264-dac59f83828b', '1633810542706-90e5ff7557be', '1721807644561-9efcabee5c42'],
  p12: ['1641699862936-be9f49b1c38d', '1617627143750-d86bc21e42bb', '1721206625226-c064ff8d92a7'],
  p13: ['1701450723521-788008974862', '1671642883395-0ab89c3ac890', '1688382654723-a7366006519b'],
  p14: ['1671642883395-0ab89c3ac890', '1701450723521-788008974862', '1722410180687-b05b50922362'],
  p15: ['1652374968229-a66a1c170c04', '1740431377901-c2f28d50c759', '1677084214263-13a2ef96a54c'],
  p16: ['1733937108021-d5db469f2216', '1652375152241-d3e62ab52b57', '1652374968229-a66a1c170c04'],
};
// Each colour variant gets the set rotated, so switching colour visibly swaps the photo.
PRODUCTS.forEach((p) => {
  const ids = DEMO_IMAGES[p.id] || [];
  p.variants.forEach((vr, i) => { if (!vr.images.length) vr.images = ids.map((_, k) => U(ids[(k + i) % ids.length])); });
});
CATEGORIES.forEach((c) => { const p = PRODUCTS.find((x) => x.category === c.slug); c.image = p ? p.variants[0].images[0] : ''; });

// Shared PDP copy — REVIEW before launch.
const CONTENT = {
  care: [
    'Keep away from perfume, sanitiser and water to help the finish last longer.',
    'Wipe gently with a soft, dry cloth after wearing.',
    'Store each piece separately in its pouch or an airtight box.',
  ],
  delivery: [
    'Dispatched within 1–2 working days.',
    'Delivered in 3–7 working days across India.',
  ],
  returns: [
    'Exchange available within 3 days of delivery for damaged or incorrect items.',
    'Please record an unboxing video; it helps us sort things out quickly.',
    'Earrings and nose rings are not eligible for exchange, for hygiene reasons.',
  ],
};

// Policy page copy — placeholder wording, REVIEW before launch.
const POLICIES = {
  'shipping-policy': { title: 'Shipping Policy', updated: 'October 2026', sections: [
    { h: 'Where we ship', p: 'We deliver across India through trusted courier partners.' },
    { h: 'Shipping charges', p: '₹60 shipping on orders below ₹499. FREE shipping on orders of ₹499 and above.' },
    { h: 'Dispatch & delivery', p: 'Orders are packed and dispatched within 1–2 working days. Delivery usually takes 3–7 working days depending on your PIN code. You will receive tracking details on WhatsApp or email once your order ships.' },
  ] },
  'return-policy': { title: 'Return & Exchange Policy', updated: 'October 2026', sections: [
    { h: 'Exchanges', p: 'If your piece arrives damaged or is not what you ordered, message us within 3 days of delivery and we will arrange an exchange.' },
    { h: 'Unboxing video', p: 'Please record a video while opening your parcel. It helps us resolve any issue quickly.' },
    { h: 'Not eligible', p: 'Earrings and nose rings cannot be exchanged for hygiene reasons, unless they arrive damaged.' },
  ] },
  'privacy-policy': { title: 'Privacy Policy', updated: 'October 2026', sections: [
    { h: 'What we collect', p: 'Your name, phone number, email and delivery address, used only to process and deliver your order.' },
    { h: 'Payments', p: 'Payments are handled by our payment partner. We never see or store your card or UPI details.' },
    { h: 'Your choices', p: 'You can ask us to update or delete your details at any time by contacting us on WhatsApp or email.' },
  ] },
  terms: { title: 'Terms & Conditions', updated: 'October 2026', sections: [
    { h: 'Products', p: 'Colours may look slightly different on screen. Anti-tarnish finishes last longest with the care steps on each product page.' },
    { h: 'Pricing', p: 'All prices are in Indian Rupees and inclusive of applicable taxes.' },
    { h: 'Orders', p: 'An order is confirmed once payment is successful. We may cancel and refund an order if an item goes out of stock.' },
  ] },
};

const STATES = ['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

// ---- Admin panel overrides (prototype only) ----
// Aarunya Admin.dc.html saves everything to localStorage `aj_admin_db`. When it exists it replaces the data
// above, so admin edits show on the store. Production: delete this block; the backend serves the same shapes.
const DEFAULTS = JSON.parse(JSON.stringify({ PRODUCTS, CATEGORIES, OFFERS, ANNOUNCEMENTS, COLORS, PAIRINGS, CONFIG }));
let BANNERS = { heroDesktop: '', heroMobile: '', heroAlt: '', personalised: '', personalisedMobile: '', personalisedAlt: '', personalisedCta: '' };
const ADMIN_KEY = 'aj_admin_db';
const readAdmin = () => { try { const d = JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null'); return d && d.v === 1 && d.products ? d : null; } catch (e) { return null; } };
(function applyAdmin() {
  const db = readAdmin(); if (!db) return;
  const live = db.products.filter((p) => p.status !== 'draft');
  PRODUCTS.splice(0, PRODUCTS.length, ...live);
  CATEGORIES.splice(0, CATEGORIES.length, ...db.categories.map((c) => {
    const p = live.find((x) => x.category === c.slug);
    const out = { ...c, image: c.image || (p && p.variants[0] ? p.variants[0].images[0] : '') };
    if (!c.subs || !c.subs.length) delete out.subs;
    return out;
  }));
  Object.keys(PAIRINGS).forEach((k) => delete PAIRINGS[k]);
  db.categories.forEach((c) => { if (c.pairs && c.pairs.length) PAIRINGS[c.slug] = c.pairs; });
  if (db.offers) OFFERS.splice(0, OFFERS.length, ...db.offers.filter((o) => !o.hidden));
  if (db.announcements && db.announcements.length) ANNOUNCEMENTS.splice(0, ANNOUNCEMENTS.length, ...db.announcements);
  if (db.colors) { Object.keys(COLORS).forEach((k) => delete COLORS[k]); Object.assign(COLORS, db.colors); }
  if (db.config) ['WHATSAPP_NUMBER', 'EMAIL', 'INSTAGRAM_HANDLE', 'FREE_SHIPPING_THRESHOLD', 'SHIPPING_FEE', 'GIFT_WRAP_FEE', 'DISPATCH_CUTOFF_HOUR', 'PAYMENT_PROVIDER'].forEach((k) => { if (db.config[k] !== undefined && db.config[k] !== '') CONFIG[k] = db.config[k]; });
  if (db.banners) BANNERS = { ...BANNERS, ...db.banners };
})();
// Mock checkout: writes the order into the admin data and reduces stock, so it appears in Admin > Orders.
function recordOrder(order) {
  const db = readAdmin();
  let orderId = 'AJ' + String(Date.now()).slice(-6);
  if (db && db.orders) {
    const max = db.orders.filter((o) => o.channel === 'online').reduce((m, o) => Math.max(m, parseInt(String(o.id).slice(2), 10) || 0), 1000);
    orderId = 'AJ' + (max + 1);
    const now = new Date().toISOString(); const c = order.customer || {};
    const items = (order.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId); const vr = p && p.variants.find((x) => x.id === l.variantId);
      if (vr) { vr.stock = Math.max(0, vr.stock - l.qty); db.ledger.unshift({ at: now, pid: p.id, vid: vr.id, sku: vr.sku, name: p.name, color: vr.color, change: -l.qty, reason: 'online', ref: orderId, note: '' }); }
      return { pid: l.productId, vid: l.variantId, name: p ? p.name : l.productId, color: vr ? vr.color : '', sku: vr ? vr.sku : '', qty: l.qty, price: p ? p.price : 0, img: (vr && vr.images[0]) || '' };
    });
    db.orders.unshift({ id: orderId, channel: 'online', createdAt: now, customer: { name: c.name || '', phone: c.phone || '', email: c.email || '', address: [c.house, c.address, c.landmark].filter(Boolean).join(', '), city: c.city || '', state: c.state || '', pin: c.pin || '' }, items, subtotal: order.subtotal, shipping: order.shipping, giftWrap: !!order.giftWrap, giftFee: order.giftFee || 0, discount: 0, total: order.total, payment: { status: 'pending', method: 'Online', provider: CONFIG.PAYMENT_PROVIDER }, status: 'new', shipment: null, location: '', note: '', history: [{ at: now, status: 'new', note: 'Order placed on website' }] });
    try { localStorage.setItem(ADMIN_KEY, JSON.stringify(db)); } catch (e) {}
  }
  return { orderId, status: 'CREATED', amount: order.total };
}

// ---- HTTP + service layer ----
async function http(path, { method = 'GET', body } = {}) {
  const res = await fetch(CONFIG.API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return res.json();
}
const mock = (data) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(data))), 60));
const qs = (o) => { const s = new URLSearchParams(o).toString(); return s ? `?${s}` : ''; };

const api = {
  // GET /products
  getProducts: (params = {}) => CONFIG.USE_MOCK ? mock(PRODUCTS) : http('/products' + qs(params)),
  // GET /products/{slug}
  getProduct: (slug) => CONFIG.USE_MOCK ? mock(PRODUCTS.find((p) => p.slug === slug) || null) : http(`/products/${slug}`),
  // GET /categories
  getCategories: () => CONFIG.USE_MOCK ? mock(CATEGORIES) : http('/categories'),
  // POST /cart  — items: [{ productId, variantId, qty }]
  syncCart: (items) => CONFIG.USE_MOCK ? mock({ ok: true }) : http('/cart', { method: 'POST', body: { items } }),
  // POST /orders — { customer, items, subtotal, shipping, total }
  createOrder: (order) => CONFIG.USE_MOCK
    ? mock(recordOrder(order))
    : http('/orders', { method: 'POST', body: order }),
  // GET /delivery/estimate?pin=XXXXXX — mock: Kerala PINs 2–3 days, rest of India 4–7 days.
  checkDelivery: (pin) => CONFIG.USE_MOCK
    ? mock((() => { if (!/^[1-9]\d{5}$/.test(pin)) return { ok: false }; const local = CONFIG.HOME_STATE_PIN_PREFIXES.some((x) => pin.startsWith(x)); const [min, max] = CONFIG.DELIVERY_DAYS[local ? 'local' : 'rest']; return { ok: true, pin, minDays: min, maxDays: max, cod: false }; })())
    : http('/delivery/estimate' + qs({ pin })),
  // POST /payments/create — backend creates a Razorpay/Cashfree order and returns what the checkout SDK needs.
  // No gateway is simulated here.
  createPayment: ({ orderId, amount }) => CONFIG.USE_MOCK
    ? mock({ status: 'GATEWAY_NOT_CONFIGURED', provider: CONFIG.PAYMENT_PROVIDER, orderId, amount })
    : http('/payments/create', { method: 'POST', body: { orderId, amount, provider: CONFIG.PAYMENT_PROVIDER } }),
};

const calcShipping = (subtotal) =>
  subtotal <= 0 ? 0 : subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : CONFIG.SHIPPING_FEE;

const whatsappUrl = (text = CONFIG.WHATSAPP_TEXT) =>
  `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

window.AarunyaAPI = { DEFAULTS, BANNERS, ANNOUNCEMENTS, OFFERS, PAIRINGS, CONFIG, COLORS, CATEGORIES, PRODUCTS, CONTENT, POLICIES, STATES, api, calcShipping, whatsappUrl };
})();
