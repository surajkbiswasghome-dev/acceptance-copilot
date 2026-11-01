// Seeded synthetic data generator. Synthetic only: no real merchants, issuers or payments.
import fs from 'node:fs';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SEED = Number(process.env.SEED || 11);
const R = rng(SEED);
const pick = (arr, w) => { const s = w.reduce((a, b) => a + b, 0); let x = R() * s; for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return i; } return arr.length - 1; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());

export const ACQUIRERS = ['Acquirer A', 'Acquirer B', 'Acquirer C', 'Acquirer D'];
export const INSTRUMENTS = ['RuPay debit', 'RuPay credit', 'Visa', 'Mastercard', 'UPI bank', 'UPI + RuPay credit', 'UPI + credit line'];
export const ISSUERS = Array.from({ length: 11 }, (_, i) => 'Issuer ' + String(i + 1).padStart(2, '0'));
export const DECLINES = ['timeout', 'issuer_decline', 'insufficient_funds', 'auth_failed', 'risk', 'config'];
const CATS = [
  ['Electronics', 6, 28000, 0.6], ['Travel', 6, 14000, 0.65], ['Grocery', 6, 900, 0.7], ['Fashion', 5, 2800, 0.6],
  ['Healthcare', 4, 4500, 0.7], ['Education', 3, 22000, 0.55], ['Home improvement', 3, 15000, 0.6], ['Restaurants', 4, 700, 0.5], ['Fuel', 3, 1800, 0.4]
];
const NAMES = {
  Electronics: ['Orbit Electronics', 'Pixel Hub', 'Volt Mart', 'Circuit House', 'Nova Gadgets', 'Lumen Digital'],
  Travel: ['Skyline Travels', 'Wayfarer Tours', 'Compass Trips', 'Meridian Holidays', 'Jetstream Bookings', 'Harbor Voyages'],
  Grocery: ['Fresh Basket', 'Green Cart', 'Daily Pantry', 'Corner Larder', 'Harvest Mart', 'Metro Provisions'],
  Fashion: ['Thread & Loom', 'Urban Weave', 'Indigo Row', 'Saffron Style', 'Cotton Lane'],
  Healthcare: ['CareFirst Clinic', 'Vitalis Labs', 'Wellspring Pharmacy', 'Mediquick'],
  Education: ['Bright Path Institute', 'Scholar Academy', 'Learnwell Centre'],
  'Home improvement': ['BuildRight Supplies', 'Hearth & Home', 'Tile Studio'],
  Restaurants: ['Spice Route Kitchen', 'Tandoor Table', 'Bean & Leaf', 'Rolls Express'],
  Fuel: ['Highway Fuel Stop', 'City Petro', 'Ring Road Fuels']
};
const SEGMENTS = { Electronics: 'Organised retail', Travel: 'Travel & hospitality', Grocery: 'Organised retail', Fashion: 'Organised retail', Healthcare: 'MSME', Education: 'MSME', 'Home improvement': 'MSME', Restaurants: 'Micro-merchant', Fuel: 'Organised retail' };

const merchants = [];
CATS.forEach(([cat, n, median, spread]) => {
  for (let i = 0; i < n; i++) {
    const acq = ACQUIRERS[pick(ACQUIRERS, [28, 25, 29, 18])];
    const en = [1, R() < 0.9 ? 1 : 0, 1, 1, 1, 0, 0];
    const hi = cat === 'Electronics' || cat === 'Travel';
    en[5] = R() < (hi ? 0.67 : 0.55) ? 1 : 0;
    en[6] = R() < 0.42 ? 1 : 0;
    merchants.push({ id: merchants.length, name: NAMES[cat][i], category: cat, segment: SEGMENTS[cat], acquirer: acq, median, spread, enabled: en });
  }
});
// guarantee at least one acquirer-C merchant takes RuPay volume in several categories (random draw already does; sanity below)

const BASE = [92.0, 91.6, 92.4, 92.0, 96.4, 95.6, 91.5];
const SHARE = [22, 6, 18, 14, 32, 5, 3];
const DMIX = [22, 24, 22, 18, 8, 6];
const ISSUER_W = ISSUERS.map((_, i) => (i === 6 ? 9 : 8));
const tx = [];
const target = 5000;
const mW = merchants.map(m => m.median > 20000 ? 0.7 : m.median > 8000 ? 1 : m.median > 2000 ? 1.4 : 1.6);
while (tx.length < target) {
  const mi = pick(merchants, mW); const m = merchants[mi];
  const amount = Math.max(50, Math.round(m.median * Math.exp(gauss() * m.spread) / 10) * 10);
  const w = SHARE.map((s, k) => {
    if (!m.enabled[k]) return 0;
    let x = s;
    if (k === 5 && (m.category === 'Electronics' || m.category === 'Travel')) x *= 0.22;      // pattern 2: low share where it matters
    if (k === 6 && amount >= 25000) x *= 0.08;                                              // pattern 4: credit line rarely used at high tickets
    if (k >= 2 && k <= 3 && amount > 25000) x *= 0.9;
    return x;
  });
  const inst = pick(INSTRUMENTS, w);
  const issuerIdx = pick(ISSUERS, ISSUER_W);
  const acqIdx = ACQUIRERS.indexOf(m.acquirer);
  let status = 0; // 0 success, else 1+decline index
  const fail = [];
  let pFail = 1 - BASE[inst] / 100;
  if (m.acquirer === 'Acquirer C' && inst <= 1) { if (R() < 0.09) status = 1 + 0; }          // pattern 1: extra timeouts on RuPay at Acquirer C
  if (!status && issuerIdx === 6 && R() < 0.075) status = 1 + 1;                         // pattern 3: issuer spike
  if (!status && R() < pFail) status = 1 + pick(DECLINES, DMIX);
  const day = Math.floor(R() * 30);
  tx.push([day, mi, acqIdx, inst, issuerIdx, amount, status]);
}
// ---- Second pass, separate random stream, so patterns 1-4 are untouched ----
const R2 = rng(SEED + 999);
// Pattern 5: short outage at Acquirer B (days 18-20): some successes become timeouts
tx.forEach(t => { if (t[2] === 1 && t[0] >= 18 && t[0] <= 20 && t[6] === 0 && R2() < 0.095) t[6] = 1; });
// Pattern 6: one high-volume grocery/fashion merchant is misconfigured: some successes become configuration declines
const vol = {}; tx.forEach(t => { vol[t[1]] = (vol[t[1]] || 0) + 1; });
const cfgMerchant = merchants.filter(m => m.category === 'Grocery' || m.category === 'Fashion').sort((a, b) => (vol[b.id] || 0) - (vol[a.id] || 0))[0].id;
tx.forEach(t => { if (t[1] === cfgMerchant && t[6] === 0 && R2() < 0.17) t[6] = 6; });
// Pattern 7: Visa authentication failures at Acquirer A from day 8 onwards
tx.forEach(t => { if (t[2] === 0 && t[3] === 2 && t[0] >= 8 && t[6] === 0 && R2() < 0.075) t[6] = 4; });

const data = { meta: { synthetic: true, generated: 'seed ' + SEED, note: 'Synthetic data. No real merchants, issuers, cards or payments.', fields: ['day', 'merchant', 'acquirer', 'instrument', 'issuer', 'amount', 'status'] }, acquirers: ACQUIRERS, instruments: INSTRUMENTS, issuers: ISSUERS, declines: DECLINES, merchants, tx };
fs.writeFileSync('src/data/dataset.json', JSON.stringify(data));
fs.writeFileSync('src/data/dataset.js', '// Generated by scripts/generate-data.mjs. Synthetic data only.\nexport default ' + JSON.stringify(data) + ';\n');
console.log('transactions', tx.length, 'merchants', merchants.length);
