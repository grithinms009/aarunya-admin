(function () {
// Aarunya Admin — prototype data layer. Persists to localStorage key `aj_admin_db`.
// The storefront (aarunya-api.js) reads the same key, so admin edits show on the store.
// Production: replace load/save with calls to the Spring Boot admin API (see README).
const KEY = 'aj_admin_db';
const clone = (o) => JSON.parse(JSON.stringify(o));
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const COLOR_CODE = { gold: 'GLD', rose: 'RSG', silver: 'SLV', black: 'BLK', green: 'GRN' };
const CAT_CODE = { necklaces: 'NK', bangles: 'BG', bracelets: 'BR', rings: 'RG', handchains: 'HC', hipchains: 'HP', earrings: 'ER', 'nose-rings': 'NR' };
const skuFor = (p, color) => `AJ-${CAT_CODE[p.category] || String(p.category || 'XX').slice(0, 2).toUpperCase()}${String(p.id).replace(/\D/g, '').padStart(3, '0')}-${COLOR_CODE[color] || String(color).slice(0, 3).toUpperCase()}`;
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

const PEOPLE = [
  ['Anjali Menon', 'Kochi', 'Kerala', '682020'], ['Lakshmi Nair', 'Thrissur', 'Kerala', '680001'], ['Fathima Rahman', 'Kozhikode', 'Kerala', '673001'],
  ['Divya Pillai', 'Thiruvananthapuram', 'Kerala', '695001'], ['Sneha Thomas', 'Kottayam', 'Kerala', '686001'], ['Aparna Krishnan', 'Palakkad', 'Kerala', '678001'],
  ['Meera Varghese', 'Kochi', 'Kerala', '682016'], ['Nikhila Joseph', 'Kannur', 'Kerala', '670001'], ['Gayathri Suresh', 'Alappuzha', 'Kerala', '688001'],
  ['Riya Mathew', 'Bengaluru', 'Karnataka', '560034'], ['Ananya Rao', 'Bengaluru', 'Karnataka', '560076'], ['Priya Sharma', 'New Delhi', 'Delhi', '110017'],
  ['Kavya Reddy', 'Hyderabad', 'Telangana', '500081'], ['Shruti Iyer', 'Chennai', 'Tamil Nadu', '600020'], ['Neha Kulkarni', 'Pune', 'Maharashtra', '411038'],
  ['Haritha Das', 'Thrissur', 'Kerala', '680005'],
];
const COURIERS = [
  { id: 'shiprocket', name: 'Shiprocket', url: 'https://shiprocket.co/tracking/{awb}' },
  { id: 'delhivery', name: 'Delhivery', url: 'https://www.delhivery.com/track/package/{awb}' },
  { id: 'dtdc', name: 'DTDC', url: 'https://www.dtdc.in/tracking.asp?awb={awb}' },
  { id: 'indiapost', name: 'India Post (Speed Post)', url: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id={awb}' },
];
const OFFLINE_LOCATIONS = ['Home studio, Thrissur', 'Exhibition / pop-up', 'Walk-in', 'Phone / WhatsApp (paid offline)'];
const FLOW = ['new', 'packed', 'shipped', 'out', 'delivered'];

function seedOrders(products, now) {
  const r = rng(20261008);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const DAY = 864e5;
  const orders = [];
  let on = 1041, off = 212;
  const ages = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 18, 20, 21, 23, 25, 26, 28, 30, 33, 36, 39];
  ages.reverse().forEach((age, i) => {
    const offline = r() < 0.3;
    const person = pick(PEOPLE);
    const lines = [];
    const n = 1 + Math.floor(r() * (offline ? 2 : 3));
    for (let k = 0; k < n; k++) {
      const p = pick(products); const v = pick(p.variants);
      if (lines.find((l) => l.vid === v.id)) continue;
      lines.push({ pid: p.id, vid: v.id, name: p.name, color: v.color, sku: v.sku, qty: r() < 0.2 ? 2 : 1, price: p.price, img: v.images[0] || '' });
    }
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
    const gift = !offline && r() < 0.25;
    const shipping = offline ? 0 : subtotal >= 499 ? 0 : 60;
    const discount = offline && r() < 0.3 ? Math.round(subtotal * 0.1 / 10) * 10 : 0;
    const total = subtotal + shipping + (gift ? 49 : 0) - discount;
    const at = now - age * DAY - Math.floor(r() * 9 * 36e5) - 36e5;
    const phone = '9' + String(Math.floor(r() * 1e9)).padStart(9, '0');
    const o = {
      id: offline ? 'OS' + (off++) : 'AJ' + (on++), channel: offline ? 'offline' : 'online', createdAt: new Date(at).toISOString(),
      customer: offline ? { name: r() < 0.7 ? person[0] : '', phone: r() < 0.6 ? phone : '', email: '', address: '', city: '', state: '', pin: '' }
        : { name: person[0], phone, email: person[0].split(' ')[0].toLowerCase() + '@gmail.com', address: `${10 + Math.floor(r() * 90)}, ${pick(['Rose Villa', 'Sreenilayam', 'Green Park Apts', 'Lakshmi Bhavan', 'Palm Grove'])}, ${pick(['MG Road', 'Temple Road', 'Church Lane', 'Station Road'])}`, city: person[1], state: person[2], pin: person[3] },
      items: lines, subtotal, shipping, giftWrap: gift, giftFee: gift ? 49 : 0, discount, total,
      payment: offline ? { status: 'paid', method: pick(['Cash', 'UPI', 'UPI', 'Card']) } : { status: 'paid', method: pick(['UPI', 'UPI', 'Card', 'Netbanking']), provider: 'razorpay', ref: 'pay_' + Math.floor(r() * 1e12).toString(36) },
      status: 'completed', shipment: null, location: offline ? pick(OFFLINE_LOCATIONS.slice(0, 3)) : '', note: '', history: [],
    };
    if (!offline) {
      let st = age === 0 ? 'new' : age === 1 ? 'packed' : age <= 3 ? 'shipped' : age === 4 ? 'out' : 'delivered';
      if (age === 0 && i % 2 === 0) o.payment.status = 'pending';
      if (age > 6 && r() < 0.08) st = 'cancelled';
      o.status = st;
      o.history.push({ at: o.createdAt, status: 'new', note: 'Order placed on website' });
      const idx = FLOW.indexOf(st);
      for (let k = 1; k <= idx; k++) o.history.push({ at: new Date(at + k * 0.9 * DAY).toISOString(), status: FLOW[k], note: '' });
      if (idx >= 2) {
        const c = r() < 0.6 ? 'shiprocket' : 'delhivery';
        o.shipment = { courier: c, awb: String(Math.floor(1e11 + r() * 9e11)), shippedAt: new Date(at + 1.8 * DAY).toISOString() };
      }
      if (st === 'cancelled') { o.payment.status = 'refunded'; o.history.push({ at: new Date(at + 0.4 * DAY).toISOString(), status: 'cancelled', note: 'Cancelled by customer' }); }
    } else {
      o.history.push({ at: o.createdAt, status: 'completed', note: 'Offline sale recorded' });
    }
    orders.push(o);
  });
  return orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function seedReturns(orders, now) {
  const delivered = orders.filter((o) => o.channel === 'online' && o.status === 'delivered');
  const spec = [
    ['requested', 'replacement', 'Arrived damaged', 'The clasp came off when I opened the box.', true],
    ['requested', 'replacement', 'Received wrong colour', 'I ordered rose gold but got gold.', true],
    ['approved', 'replacement', 'Stone missing', 'One stone is missing from the left side.', true],
    ['pickup', 'refund', 'Different from photos', 'The size is much smaller than it looked.', false],
    ['completed', 'replacement', 'Clasp broken', 'Hook is bent.', true],
    ['rejected', 'refund', 'Changed my mind', 'Would like to return it.', false],
  ];
  return spec.map(([status, type, reason, note, video], i) => {
    const o = delivered[i % Math.max(1, delivered.length)];
    if (!o) return null;
    const it = o.items[0];
    const at = new Date(now - (i + 1) * 0.7 * 864e5).toISOString();
    const history = [{ at, status: 'requested', note: 'Requested by customer' }];
    const order = ['requested', 'approved', 'pickup', 'received', 'completed'];
    if (status === 'rejected') history.push({ at, status: 'rejected', note: 'Not eligible: change of mind is not covered by policy' });
    else for (let k = 1; k <= order.indexOf(status); k++) history.push({ at, status: order[k], note: '' });
    o.returnId = 'RX' + (301 + i);
    return { id: 'RX' + (301 + i), orderId: o.id, customer: { name: o.customer.name, phone: o.customer.phone }, item: { ...it, qty: 1 }, type, reason, note, video, photos: video ? 2 : 0, createdAt: at, deliveredAt: (o.history.find((h) => h.status === 'delivered') || {}).at || o.createdAt, status, resolution: status === 'completed' ? 'Replacement shipped' : '', pickup: status === 'pickup' ? { courier: 'shiprocket', date: new Date(now + 864e5).toISOString().slice(0, 10) } : null, history };
  }).filter(Boolean);
}

function seedLedger(orders, products, now) {
  const L = [];
  orders.forEach((o) => {
    o.items.forEach((l) => L.push({ at: o.createdAt, pid: l.pid, vid: l.vid, sku: l.sku, name: l.name, color: l.color, change: -l.qty, reason: o.channel, ref: o.id }));
    if (o.status === 'cancelled') o.items.forEach((l) => L.push({ at: o.history[o.history.length - 1].at, pid: l.pid, vid: l.vid, sku: l.sku, name: l.name, color: l.color, change: l.qty, reason: 'cancel', ref: o.id }));
  });
  products.slice(0, 5).forEach((p, i) => { const v = p.variants[0]; L.push({ at: new Date(now - (20 + i) * 864e5).toISOString(), pid: p.id, vid: v.id, sku: v.sku, name: p.name, color: v.color, change: 10, reason: 'adjust', ref: '', note: 'New stock from supplier' }); });
  return L.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function seed(A) {
  const now = Date.now();
  const products = clone(A.PRODUCTS).map((p) => ({
    ...p, status: 'active', giftWrap: true, exchange: !['earrings', 'nose-rings'].includes(p.category), seoTitle: '', seoDesc: '',
    specs: [{ k: 'Finish', v: 'Anti-tarnish, nickel-free' }],
    variants: p.variants.map((v) => ({ ...v, sku: skuFor(p, v.color) })),
  }));
  const categories = clone(A.CATEGORIES).map((c) => ({ ...c, subs: c.subs || [], pairs: (A.PAIRINGS || {})[c.slug] || [], image: '' }));
  const orders = seedOrders(products, now);
  const returns = seedReturns(orders, now);
  return {
    v: 1, products, categories,
    banners: {
      heroDesktop: 'assets/aarunya-hero-pastel.jpg', heroMobile: '', heroAlt: 'Hi, I am Aarunya. Illustration of a little girl holding jewellery.',
      personalised: 'assets/personalised-banner.jpg', personalisedMobile: 'assets/personalised-gift-box-v2.jpg', personalisedAlt: 'Made just for you. Personalised Gift, anti-tarnish jewellery, personalised with love.', personalisedCta: 'Personalise Your Gift',
    },
    offers: clone(A.OFFERS).map((o) => ({ ...o, alt: o.alt || `${o.title} ${o.accent}. ${o.sub}` })),
    announcements: [...(A.ANNOUNCEMENTS || [])],
    config: {
      ...clone(A.CONFIG), LOW_STOCK: 2, couriers: COURIERS, defaultCourier: 'shiprocket', notifyOnShip: true,
      shipMsg: 'Hi {name}, your Aarunya order {order} is on its way! Track it here: {link}',
      returnWindow: 3, nonEligible: ['earrings', 'nose-rings'], requireVideo: true, allowRefund: true,
      locations: OFFLINE_LOCATIONS,
    },
    orders, returns, ledger: seedLedger(orders, products, now),
    admin: { email: 'veena@aarunyajewels.in', pass: 'aarunya123', name: 'Veena' },
  };
}

function load() {
  try { const db = JSON.parse(localStorage.getItem(KEY) || 'null'); if (db && db.v === 1 && db.products) return db; } catch (e) {}
  return null;
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { console.warn('Aarunya admin: storage full', e); return false; }
}
function reset() { try { localStorage.removeItem(KEY); } catch (e) {} }

// ---- images ----
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const readFile = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
async function resizeFile(file, max = 1000, q = 0.84) {
  const img = await loadImg(await readFile(file));
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
// Prototype stand-in for an image-generation API: composes the photo onto studio backgrounds.
async function compose(src, kind, alt = 0) {
  const img = await loadImg(src);
  const S = 900; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  if (alt) { x.translate(S, 0); x.scale(-1, 1); }
  if (kind === 'detail') {
    const s = Math.min(img.width, img.height) * (alt ? 0.45 : 0.58);
    x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
    return c.toDataURL('image/jpeg', 0.86);
  }
  let g;
  if (kind === 'flatlay') { g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#F4E9DC'); g.addColorStop(1, '#E3D0BA'); }
  else if (kind === 'blush') { g = x.createRadialGradient(S / 2, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.8); g.addColorStop(0, '#FFF8F6'); g.addColorStop(1, alt ? '#F1D4D6' : '#F5DFDC'); }
  else { g = x.createRadialGradient(S / 2, S * 0.45, S * 0.1, S / 2, S / 2, S * 0.8); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F3F0EE'); }
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const box = (kind === 'flatlay' ? 0.62 : 0.7) * (alt ? 1.08 : 1);
  const r = Math.min(S * box / img.width, S * box / img.height); const w = img.width * r, h = img.height * r;
  const X = (S - w) / 2, Y = (S - h) / 2 - S * 0.02;
  x.save(); x.shadowColor = 'rgba(48,39,34,.20)'; x.shadowBlur = 40; x.shadowOffsetY = 18; x.fillStyle = '#FFFFFF'; rr(x, X, Y, w, h, 16); x.fill(); x.restore();
  x.save(); rr(x, X, Y, w, h, 16); x.clip(); x.drawImage(img, X, Y, w, h); x.restore();
  if (kind === 'flatlay') { x.strokeStyle = 'rgba(199,154,69,.55)'; x.lineWidth = 2; rr(x, X - 18, Y - 18, w + 36, h + 36, 26); x.stroke(); }
  return c.toDataURL('image/jpeg', 0.86);
}

function csv(rows) {
  return rows.map((r) => r.map((v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
}
function download(name, text, type = 'text/csv') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

window.AarunyaAdminDB = { KEY, seed, load, save, reset, clone, slugify, skuFor, resizeFile, compose, csv, download, FLOW, COURIERS };
})();
