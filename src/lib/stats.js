// All numbers in the product are computed here, in code. The AI never invents a figure.
import ds from '../data/dataset.js';

export const { acquirers: ACQ, instruments: INST, issuers: ISS, declines: DEC, merchants: MERCH } = ds;
export const DECLINE_LABEL = { timeout: 'Timeouts', issuer_decline: 'Issuer declines', insufficient_funds: 'Insufficient funds', auth_failed: 'Authentication failed', risk: 'Risk rules', config: 'Configuration' };
export const HIGH_TICKET = 25000;
export const TX = ds.tx.map(r => ({ day: r[0], m: r[1], acq: r[2], inst: r[3], iss: r[4], amt: r[5], st: r[6], ok: r[6] === 0, lat: r[7], cost: r[8], cat: MERCH[r[1]].category, seg: MERCH[r[1]].segment }));

const pct = (a, b) => (b ? (100 * a) / b : null);
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
export const rate = rows => r1(pct(rows.filter(t => t.ok).length, rows.length));
export const isRupay = i => i <= 1;

export function kpis(rows = TX) {
  const n = rows.length, ok = rows.filter(t => t.ok).length;
  const fails = rows.filter(t => !t.ok);
  const upi = rows.filter(t => t.inst >= 4);
  const gmv = rows.reduce((a, t) => a + t.amt, 0);
  const lostGmv = fails.reduce((a, t) => a + t.amt, 0);
  return { n, success: r1(pct(ok, n)), declines: fails.length, upiSuccess: rate(upi), rupaySuccess: rate(rows.filter(t => isRupay(t.inst))), gmv, lostGmv };
}

export function matrix(rows = TX) {
  return ACQ.map((a, ai) => INST.map((x, ii) => { const c = rows.filter(t => t.acq === ai && t.inst === ii); return { rate: rate(c), n: c.length }; }));
}
export const statusOf = v => (v == null ? 'na' : v >= 90 ? 'ok' : v >= 87 ? 'warn' : 'bad');

export function declineBreakdown(filter = () => true) {
  const f = TX.filter(t => !t.ok && filter(t));
  const out = DEC.map((d, i) => ({ code: d, label: DECLINE_LABEL[d], n: f.filter(t => t.st === i + 1).length }));
  return out.map(o => ({ ...o, share: r1(pct(o.n, f.length)) })).sort((a, b) => b.n - a.n).concat([]);
}
export function issuerSplit(filter = () => true) {
  return ISS.map((name, i) => {
    const rows = TX.filter(t => t.iss === i && filter(t));
    const fails = rows.filter(t => !t.ok);
    return { issuer: name, n: rows.length, success: rate(rows), declines: fails.length, issuerDeclineRate: r1(pct(rows.filter(t => t.st === 2).length, rows.length)), timeoutRate: r1(pct(rows.filter(t => t.st === 1).length, rows.length)) };
  });
}
export function compareAcquirers(instFilter = isRupay) {
  return ACQ.map((name, ai) => {
    const mine = TX.filter(t => t.acq === ai && instFilter(t.inst));
    const peers = TX.filter(t => t.acq !== ai && instFilter(t.inst));
    const s = rate(mine), p = rate(peers);
    return { acquirer: name, n: mine.length, success: s, peers: p, gap: r1(s - p) };
  });
}
export function shareByCategory(inst) {
  const cats = [...new Set(MERCH.map(m => m.category))];
  return cats.map(cat => { const rows = TX.filter(t => t.cat === cat); const x = rows.filter(t => t.inst === inst); return { category: cat, n: rows.length, share: r1(pct(x.length, rows.length)), success: rate(x), merchants: MERCH.filter(m => m.category === cat).length, enabled: MERCH.filter(m => m.category === cat && m.enabled[inst]).length }; });
}
export function instrumentShare(rows = TX) { return INST.map((name, i) => ({ instrument: name, share: r1(pct(rows.filter(t => t.inst === i).length, rows.length)), n: rows.filter(t => t.inst === i).length })); }
export function ticketSplit(inst) {
  const hi = TX.filter(t => t.amt >= HIGH_TICKET), lo = TX.filter(t => t.amt < HIGH_TICKET);
  const enabledMerch = m => m.enabled[inst];
  return { high: { n: hi.length, share: r1(pct(hi.filter(t => t.inst === inst).length, hi.length)), success: rate(hi.filter(t => t.inst === inst)) }, low: { n: lo.length, share: r1(pct(lo.filter(t => t.inst === inst).length, lo.length)), success: rate(lo.filter(t => t.inst === inst)) }, merchantsEnabled: MERCH.filter(enabledMerch).length, merchants: MERCH.length };
}
export function coverage() {
  return INST.map((name, i) => ({ instrument: name, enabled: MERCH.filter(m => m.enabled[i]).length, total: MERCH.length, pct: r1(pct(MERCH.filter(m => m.enabled[i]).length, MERCH.length)) }));
}
export const MIN_N = 100;
export function checkSampleSize(n) { return { n, ok: n >= MIN_N, note: n >= MIN_N ? 'Sample is large enough to read.' : 'Sample under ' + MIN_N + ': treat as a signal, not a conclusion.' }; }
export const money = v => '₹' + (v >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' : v >= 1e5 ? (v / 1e5).toFixed(1) + ' L' : Math.round(v).toLocaleString('en-IN'));

// Ranked leaks: gap vs peers weighted by volume. Computed, not generated.
export function findings() {
  const items = [];
  const acq = compareAcquirers(isRupay).sort((a, b) => a.gap - b.gap)[0];
  const aIdx = ACQ.indexOf(acq.acquirer);
  const rows = TX.filter(t => t.acq === aIdx && isRupay(t.inst));
  const lostRows = Math.round(rows.length * Math.abs(acq.gap) / 100);
  items.push({ id: 'f1', gate: 'Experience', title: acq.acquirer + ' × RuPay', subtitle: 'RuPay debit + credit combined · ' + acq.success + '% success · n = ' + acq.n + ' · peers ' + acq.peers + '% · gap ' + acq.gap + ' pts', gap: acq.gap, impact: lostRows + ' extra failed payments in 30 days', acq: aIdx });
  const iss = issuerSplit().sort((a, b) => b.issuerDeclineRate - a.issuerDeclineRate)[0];
  items.push({ id: 'f2', gate: 'Experience', title: iss.issuer + ' issuer declines', subtitle: iss.issuerDeclineRate + '% of its payments declined by the issuer · n = ' + iss.n, gap: null, impact: iss.declines + ' declines in 30 days', iss: ISS.indexOf(iss.issuer) });
  const cu = shareByCategory(5);
  const et = cu.filter(c => c.category === 'Electronics' || c.category === 'Travel');
  const etShare = r1(pct(et.reduce((a, c) => a + (c.share * c.n) / 100, 0), et.reduce((a, c) => a + c.n, 0)));
  const rest = cu.filter(c => c.category !== 'Electronics' && c.category !== 'Travel');
  const restShare = r1(pct(rest.reduce((a, c) => a + (c.share * c.n) / 100, 0), rest.reduce((a, c) => a + c.n, 0)));
  items.push({ id: 'f3', gate: 'Preference', title: 'UPI + RuPay credit in electronics and travel', subtitle: 'Share ' + etShare + '% vs ' + restShare + '% elsewhere · success ' + rate(TX.filter(t => t.inst === 5)) + '%', gap: null, impact: 'Works well when used; rarely chosen', etShare, restShare });
  const ts = ticketSplit(6);
  items.push({ id: 'f4', gate: 'Preference', title: 'UPI + credit line at high tickets', subtitle: 'Share ' + ts.high.share + '% at ₹25k+ vs ' + ts.low.share + '% below · n(₹25k+) = ' + ts.high.n, gap: null, impact: 'High-ticket payments rarely use the credit line', ts });
  const inc = detectIncident();
  if (inc) items.push({ id: 'f5', gate: 'Experience', title: inc.acquirer + ' success dip, ' + dayLabel(inc.from) + ' to ' + dayLabel(inc.to), subtitle: 'Success ' + inc.low + '% on those days vs ' + inc.normal + '% normally · n = ' + inc.n, gap: r1(inc.low - inc.normal), impact: inc.lost + ' extra failed payments during the dip', inc });
  const cfg = detectConfigMerchant();
  if (cfg) items.push({ id: 'f6', gate: 'Enablement', title: cfg.merchant.name + ' configuration declines', subtitle: cfg.rate + '% of its payments hit configuration declines vs ' + cfg.restRate + '% elsewhere · n = ' + cfg.n, gap: null, impact: cfg.count + ' declines in 30 days', cfg });
  const au = detectAuth();
  if (au) items.push({ id: 'f7', gate: 'Experience', title: au.acquirer + ' × ' + au.instrument + ' authentication failures', subtitle: au.rate + '% authentication failures vs ' + au.others + '% at other acquirers · n = ' + au.n, gap: null, impact: au.count + ' authentication declines in 30 days', au });
  const routes = { f1: bestRoute(isRupay, aIdx), f7: au ? bestRoute(i => i === au.inst, au.ai) : null };
  const acts = { f1: ['ticket', 'routing', 'escalate'], f2: ['ticket', 'escalate'], f3: ['proposal', 'ticket'], f4: ['proposal', 'ticket'], f5: ['ticket', 'escalate'], f6: ['ticket'], f7: ['ticket', 'routing', 'escalate'] };
  items.forEach(f => { f.actions = acts[f.id]; f.route = routes[f.id] || null; });
  return items;
}

export const dayLabel = d => { const x = new Date(); x.setDate(x.getDate() - (29 - d)); return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
export function dailySeries(filter = () => true) {
  return Array.from({ length: 30 }, (_, day) => { const rows = TX.filter(t => t.day === day && filter(t)); return { day, n: rows.length, rate: rate(rows) }; });
}
export function detectIncident() {
  let best = null;
  ACQ.forEach((name, ai) => {
    const series = dailySeries(t => t.acq === ai); const sorted = series.map(d => d.rate).filter(x => x != null).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)]; const low = series.filter(d => d.n >= 15 && d.rate < med - 7);
    if (low.length < 2) return;
    const n = low.reduce((a, d) => a + d.n, 0); const lowRate = r1(low.reduce((a, d) => a + d.rate * d.n, 0) / n);
    const lost = Math.round(n * (med - lowRate) / 100); if (!best || lost > best.lost) best = { acquirer: name, ai, from: low[0].day, to: low[low.length - 1].day, low: lowRate, normal: med, n, lost, series };
  });
  return best;
}
export function detectConfigMerchant() {
  const overall = TX.filter(t => t.st === 6).length / TX.length;
  let best = null;
  MERCH.forEach((m, i) => { const rows = TX.filter(t => t.m === i); if (rows.length < 30) return; const c = rows.filter(t => t.st === 6).length; const r = c / rows.length; if (r > 3 * overall && (!best || r > best.r)) best = { merchant: m, mi: i, r, n: rows.length, count: c }; });
  if (!best) return null;
  const rest = TX.filter(t => t.m !== best.mi); return { merchant: best.merchant, mi: best.mi, n: best.n, count: best.count, rate: r1(best.r * 100), restRate: r1(100 * rest.filter(t => t.st === 6).length / rest.length) };
}
export function detectAuth() {
  let best = null;
  ACQ.forEach((name, ai) => INST.forEach((iname, ii) => {
    const mine = TX.filter(t => t.acq === ai && t.inst === ii); if (mine.length < 100) return;
    const others = TX.filter(t => t.acq !== ai && t.inst === ii); const r = mine.filter(t => t.st === 4).length / mine.length; const o = others.filter(t => t.st === 4).length / others.length;
    if (r > 2 * o && r > 0.03 && (!best || r / (o || 0.001) > best.score)) best = { acquirer: name, ai, instrument: iname, inst: ii, n: mine.length, count: mine.filter(t => t.st === 4).length, rate: r1(r * 100), others: r1(o * 100), score: r / (o || 0.001) };
  }));
  return best;
}
// Best-suited acquirer for a set of instruments, excluding one. Implied effect is arithmetic, not a forecast.
export function bestRoute(instFilter, fromAi) {
  const stat = ACQ.map((name, ai) => { const rows = TX.filter(t => t.acq === ai && instFilter(t.inst)); return { name, ai, n: rows.length, rate: rate(rows) }; });
  const from = stat[fromAi]; const cand = stat.filter(x => x.ai !== fromAi && x.n >= 80).sort((a, b) => b.rate - a.rate)[0];
  if (!cand) return null;
  return { from: from.name, fromAi, fromRate: from.rate, fromN: from.n, to: cand.name, toAi: cand.ai, toRate: cand.rate, toN: cand.n, diff: r1(cand.rate - from.rate), implied: Math.round(from.n * (cand.rate - from.rate) / 100) };
}

// Affordability: standard EMI formula, rate and tenure are inputs, nothing hardcoded about MDR.
export function emi(principal, annualPct, months) {
  const r = annualPct / 1200;
  if (!months) return principal;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}
export function merchantProfile(mi) {
  const m = MERCH[mi];
  const rows = TX.filter(t => t.m === mi);
  const avg = rows.length ? Math.round(rows.reduce((a, t) => a + t.amt, 0) / rows.length) : m.median;
  const hiShare = r1(pct(rows.filter(t => t.amt >= HIGH_TICKET).length, rows.length));
  const mix = INST.map((name, i) => ({ instrument: name, enabled: !!m.enabled[i], share: r1(pct(rows.filter(t => t.inst === i).length, rows.length)), success: rate(rows.filter(t => t.inst === i)) }));
  return { merchant: m, n: rows.length, avgTicket: avg, hiShare, mix, success: rate(rows) };
}
export function recommend(mi) {
  const p = merchantProfile(mi); const m = p.merchant; const recs = [];
  const hiCat = ['Electronics', 'Travel', 'Education', 'Healthcare', 'Home improvement'].includes(m.category);
  if (!m.enabled[5]) recs.push({ instrument: 'UPI + RuPay credit', why: 'Not enabled yet. Network-wide success is ' + rate(TX.filter(t => t.inst === 5)) + '%.', gate: 'Coverage', priority: hiCat ? 1 : 2 });
  if (!m.enabled[6] && (hiCat || p.avgTicket >= 8000)) recs.push({ instrument: 'UPI + credit line', why: 'Average ticket ₹' + p.avgTicket.toLocaleString('en-IN') + ' suits an installment-style option.', gate: 'Coverage', priority: 2 });
  if (m.enabled[5] && hiCat && (p.mix[5].share || 0) < 2) recs.push({ instrument: 'Offer on UPI + RuPay credit', why: 'Enabled, but only ' + (p.mix[5].share || 0) + '% of payments use it. Customers may not know it is there.', gate: 'Preference', priority: 1 });
  if (p.avgTicket >= 10000) recs.push({ instrument: 'No-cost EMI offer', why: 'Average ticket ₹' + p.avgTicket.toLocaleString('en-IN') + '. Funding split to be agreed with issuer and merchant.', gate: 'Preference', priority: 3 });
  return { profile: p, recs: recs.sort((a, b) => a.priority - b.priority) };
}
export function pilotCohort(limit = 8) {
  return MERCH.filter(m => !m.enabled[5] && ['Electronics', 'Travel', 'Education', 'Healthcare', 'Home improvement'].includes(m.category)).slice(0, limit)
    .concat(MERCH.filter(m => m.enabled[5] && ['Electronics', 'Travel'].includes(m.category))).slice(0, limit);
}

// Simulation: customers who move to this instrument would otherwise have paid another way and often succeeded.
// So the implied gain is only the DIFFERENCE in success rates times the payments moved. It can be near zero or negative.
export function simulateShift(mi, shiftPct, inst = 5) {
  const p = merchantProfile(mi);
  const instRate = rate(TX.filter(t => t.inst === inst)) ?? 0;
  const base = p.success ?? 0;
  const moved = Math.round((p.n * shiftPct) / 100);
  const delta = Math.round(moved * (instRate - base)) / 100 || 0;
  return { moved, instRate, base, delta, value: Math.round(delta * p.avgTicket), n: p.n, avgTicket: p.avgTicket };
}

// Peer benchmark for a merchant and instrument. Synthetic data; benchmark arithmetic, not a forecast.
export function peerBenchmark(mi, inst) {
  const m = MERCH[mi];
  const peers = MERCH.map((x, i) => i).filter(i => i !== mi && MERCH[i].category === m.category && MERCH[i].enabled[inst]);
  const rows = TX.filter(t => peers.includes(t.m)); const x = rows.filter(t => t.inst === inst); const all = TX.filter(t => t.inst === inst);
  const same = MERCH.map((y, i) => i).filter(i => i !== mi && MERCH[i].category === m.category);
  const avg = a => (a.length ? Math.round(a.reduce((q, t) => q + t.amt, 0) / a.length) : null);
  const cards = TX.filter(t => t.inst <= 3);
  return { peers: peers.length, sameCategory: same.length, share: rows.length ? r1(pct(x.length, rows.length)) : null, success: rate(x), peerN: x.length,
    avgOn: avg(all), avgAll: avg(TX), networkShare: r1(pct(all.length, TX.length)), networkSuccess: rate(all), cardSuccess: rate(cards), merchantAvg: merchantProfile(mi).avgTicket };
}
export function categoryInstrumentMatrix() {
  const cats = [...new Set(MERCH.map(m => m.category))];
  return cats.map(c => { const rows = TX.filter(t => t.cat === c); return { category: c, n: rows.length, shares: INST.map((_, i) => r1(pct(rows.filter(t => t.inst === i).length, rows.length))) }; });
}
export function proposalCandidates(findingId) {
  const out = [];
  MERCH.forEach((m, i) => {
    const p = merchantProfile(i);
    if (findingId === 'f3' && ['Electronics', 'Travel'].includes(m.category) && (!m.enabled[5] || (p.mix[5].share || 0) < 2)) out.push({ mi: i, inst: 5 });
    if (findingId === 'f4' && p.avgTicket >= 12000 && !m.enabled[6]) out.push({ mi: i, inst: 6 });
  });
  return out;
}

// Per-merchant outcome split and an assumption-driven potential range for a credit-line style option.
// Assumption (stated in the email): a share of "insufficient funds" failures could complete through a credit line.
export const POTENTIAL_ASSUMPTION = { low: 0.10, high: 0.25 };
export function merchantPotential(mi) {
  const rows = TX.filter(t => t.m === mi); const n = rows.length || 1;
  const ok = rows.filter(t => t.st === 0).length, ins = rows.filter(t => t.st === 3).length, other = rows.length - ok - ins;
  // With few events the merchant's own share is too noisy, so fall back to merchants in the same category.
  const catRows = TX.filter(t => t.cat === MERCH[mi].category); const catIns = 100 * catRows.filter(t => t.st === 3).length / (catRows.length || 1);
  const own = ins >= 5; const insPct = own ? 100 * ins / n : catIns; const p = merchantProfile(mi);
  const lowPts = Math.round(insPct * POTENTIAL_ASSUMPTION.low * 100) / 100, highPts = Math.round(insPct * POTENTIAL_ASSUMPTION.high * 100) / 100;
  const per1000 = [Math.round(insPct * POTENTIAL_ASSUMPTION.low * 10), Math.round(insPct * POTENTIAL_ASSUMPTION.high * 10)];
  return { n: rows.length, basis: own ? 'your payments' : 'merchants like you', successPct: r1(100 * ok / n), insPct: r1(insPct), otherPct: r1(100 * other / n), okPct: r1(100 * ok / n), lowPts, highPts, per1000, avgTicket: p.avgTicket,
    valuePer1000: [per1000[0] * p.avgTicket, per1000[1] * p.avgTicket] };
}

// Instruments that can be proposed beyond the nine in the dataset. No demo merchant has them enabled and the dataset carries no figures for them, so proposals for these state no numbers.
export const EXTRA_INST = [
  { id: 'x:dcc', name: 'Dynamic currency conversion (DCC)', what: 'lets a customer paying with a foreign-issued card choose to pay in their home currency at checkout', fit: 'tourism, hotels, airlines, duty-free and other merchants with international visitors' },
  { id: 'x:intl', name: 'International cards', what: 'accepts cards issued outside India so overseas customers can pay in the usual way', fit: 'travel, education, online services and gifting merchants with overseas customers' },
  { id: 'x:emi', name: 'Card and cardless EMI', what: 'lets a customer split a larger purchase into instalments at checkout, with the instalment provider carrying the credit decision', fit: 'electronics, furniture, education and healthcare merchants with higher-value baskets' },
  { id: 'x:link', name: 'Pay by link', what: 'sends the customer a secure payment link by message or email, so no checkout page is needed', fit: 'small merchants, field services, invoices and orders taken by phone' },
  { id: 'x:qr', name: 'Dynamic QR at counter', what: 'shows a QR with the exact amount at the counter or on delivery, so the customer scans and pays', fit: 'stores, restaurants and delivery merchants collecting payment in person' },
  { id: 'x:rec', name: 'Recurring payments (e-mandate)', what: 'lets a customer authorise repeat payments within limits they set, for subscriptions and bills', fit: 'subscriptions, utilities, insurance, education fees and memberships' },
  { id: 'x:pl', name: 'Pay later at checkout', what: 'lets a customer pay after delivery or at month end, with a provider carrying the credit decision', fit: 'fashion, groceries and everyday online retail' },
];
const EMI_NAMES = { 'emi:upicc': 'EMI on RuPay credit card on UPI', 'emi:upicl': 'Credit line on UPI with instalments', 'emi:card': 'RuPay card EMI (card rails)' };
export const instName = i => (typeof i === 'number' ? INST[i] : EMI_NAMES[i] || (EXTRA_INST.find(x => x.id === i) || { name: String(i) }).name);
export const extraInst = i => EXTRA_INST.find(x => x.id === i);

// ---- Credit on UPI: merchant fit check, from a payment-gateway product manager's point of view ----
export const SHOWCASE = MERCH.map((m, i) => i).filter(i => MERCH[i].showcase);
export const MERCH_ORDER = [...SHOWCASE, ...MERCH.map((m, i) => i).filter(i => !MERCH[i].showcase)];
const HIGH_VALUE_CATS = ['Electronics', 'Travel', 'Education', 'Healthcare', 'Home improvement'];
export function creditFit(mi, inst) {
  const m = MERCH[mi]; const rows = TX.filter(t => t.m === mi); const n = rows.length; const p = merchantProfile(mi); const pot = merchantPotential(mi);
  const b = peerBenchmark(mi, inst); const port = rate(TX); const ai = ACQ.indexOf(m.acquirer); const acqUpi = rate(TX.filter(t => t.acq === ai && t.inst >= 4));
  const st = (v, good, ok) => (v >= good ? 'ok' : v >= ok ? 'warn' : 'bad');
  const R = [
    { key: 'volume', label: 'Evidence base', value: n + ' payments in 30 days', rule: 'At least 150 payments, so the pattern is not noise', status: st(n, 150, 60) },
    { key: 'pool', label: 'Addressable pool: declined for insufficient balance', value: pot.insPct + '% of payments (' + pot.basis + ')', rule: 'At least 3%. This is the part a credit line can complete', status: st(pot.insPct, 3, 1.5) },
    { key: 'ticket', label: 'Average ticket', value: '₹' + p.avgTicket.toLocaleString('en-IN'), rule: 'At least ₹12,000. Affordability matters at higher tickets', status: st(p.avgTicket, 12000, 5000) },
    { key: 'hi', label: 'High-ticket share (₹25,000 and above)', value: p.hiShare + '% of payments', rule: 'At least 10%. Where customers stretch to pay', status: st(p.hiShare, 10, 3) },
    { key: 'cat', label: 'Category fit', value: m.category, rule: 'High-value, aspirational: electronics, travel, education, healthcare, home improvement', status: HIGH_VALUE_CATS.includes(m.category) ? 'ok' : 'warn' },
    { key: 'succ', label: 'Current success rate', value: p.success + '% against ' + port + '% for the portfolio', rule: 'Below the portfolio means more headroom', status: p.success < port - 2 ? 'ok' : p.success <= port + 2 ? 'warn' : 'bad' },
    { key: 'peer', label: 'Peer adoption', value: b.peers + ' of ' + b.sameCategory + ' ' + m.category.toLowerCase() + ' peers accept it', rule: 'At least 40% of peers, so demand is proven', status: b.sameCategory && b.peers / b.sameCategory >= 0.4 ? 'ok' : 'warn' },
    { key: 'net', label: INST[inst] + ' success on the network', value: b.networkSuccess + '%', rule: 'At least 90%', status: st(b.networkSuccess, 90, 85) },
    { key: 'acq', label: 'Acquirer readiness', value: m.acquirer + ' · UPI success ' + acqUpi + '%', rule: 'Acquirer handles UPI at 90% or better', status: st(acqUpi, 90, 85) },
    { key: 'gap', label: 'Enablement gap', value: m.enabled[inst] ? 'Already enabled' : 'Not enabled today', rule: 'Not enabled yet', status: m.enabled[inst] ? 'bad' : 'ok' },
    { key: 'risk', label: 'Dispute and risk exposure', value: 'Not in this dataset', rule: 'Check issuer risk and dispute SLA with the acquirer before a pilot', status: 'check' },
    { key: 'bin', label: 'BIN enablement and certification', value: 'To confirm with ' + m.acquirer, rule: 'Acquirer and issuer BINs live for credit on UPI', status: 'check' }
  ];
  const scored = R.filter(x => x.status !== 'check'); const score = scored.reduce((a, x) => a + (x.status === 'ok' ? 1 : x.status === 'warn' ? 0.5 : 0), 0);
  const verdict = score >= 8 ? 'Strong fit' : score >= 6 ? 'Moderate fit' : 'Weak fit';
  return { rows: R, score, outOf: scored.length, verdict, pot, merchant: m, instrument: INST[inst] };
}
// Merchants ranked by how many extra payments the insufficient-balance pool could complete, among those without credit on UPI.
export function topCreditCandidates(limit = 5) {
  return MERCH.map((m, i) => i).filter(i => (!MERCH[i].enabled[5] || !MERCH[i].enabled[6]) && TX.filter(t => t.m === i).length >= 150).map(i => { const pot = merchantPotential(i); const inst = !MERCH[i].enabled[6] ? 6 : 5; const f = creditFit(i, inst); return { mi: i, inst, name: MERCH[i].name, category: MERCH[i].category, n: pot.n, insPct: pot.insPct, pot, verdict: f.verdict, score: f.score, outOf: f.outOf, pool: Math.round(pot.n * pot.insPct / 100) }; }).sort((a, b) => b.pool - a.pool).slice(0, limit);
}

// ---- Merchant targeting: which merchants are most likely to add credit-on-UPI sales ----
// A weighted scoring model with fixed, visible weights. It is not a trained model: training needs real pilot outcomes as labels.
// Factors from the planning list that this dataset cannot support are named in TARGET_NOT_USED, never guessed.
export const TARGET_FACTORS = [
  { id: 'ins', label: 'Declined for insufficient balance', w: 30, why: 'The pool a credit line can complete. The most direct signal.' },
  { id: 'tpv', label: 'Merchant TPV (30 days)', w: 15, why: 'More sales means more absolute upside.' },
  { id: 'tkt', label: 'Average ticket', w: 15, why: 'Affordability matters more at higher tickets.' },
  { id: 'cat', label: 'Category (MCC group)', w: 10, why: 'Electronics, travel, education, healthcare and home improvement are the target clusters.' },
  { id: 'upi', label: 'UPI share of payments', w: 10, why: 'Customers already comfortable paying on UPI.' },
  { id: 'crd', label: 'Card share of payments', w: 10, why: 'Stand-in for credit-card penetration: customers who hold cards.' },
  { id: 'gro', label: 'Growth (second half vs first half)', w: 10, why: 'Merchants that are growing absorb new options faster.' }
];
export const TARGET_NOT_USED = [
  { label: 'Customer demographics', why: 'Not in the dataset, and would need consent and PII controls with real data.' },
  { label: 'Location', why: 'The synthetic merchants carry no city or region.' },
  { label: 'Repeat customer %', why: 'Payments carry no customer identifier.' }
];
let _tc = null;
function targetTable() {
  if (_tc) return _tc;
  const raw = MERCH.map((m, mi) => {
    const r = TX.filter(t => t.m === mi); const n = r.length || 1; const first = r.filter(t => t.day < 15).length, second = r.length - first;
    return { mi, n: r.length, ins: 100 * r.filter(t => t.st === 3).length / n, tpv: r.reduce((a, t) => a + t.amt, 0), tkt: r.reduce((a, t) => a + t.amt, 0) / n, cat: HIGH_VALUE_CATS.includes(m.category) ? 1 : 0, upi: 100 * r.filter(t => t.inst >= 4 && t.inst <= 6).length / n, crd: 100 * r.filter(t => t.inst >= 1 && t.inst <= 3).length / n, gro: first ? 100 * (second - first) / first : 0 };
  });
  const rank = id => { const v = raw.map(x => x[id]); const mn = Math.min(...v), mx = Math.max(...v); return raw.map(x => (mx === mn ? 0.5 : (x[id] - mn) / (mx - mn))); };
  const nr = Object.fromEntries(TARGET_FACTORS.map(f => [f.id, rank(f.id)]));
  _tc = raw.map((x, i) => { const parts = TARGET_FACTORS.map(f => ({ ...f, value: x[f.id], pts: Math.round(f.w * nr[f.id][i] * 10) / 10 })); return { ...x, parts, score: Math.round(parts.reduce((a, p) => a + p.pts, 0)) }; });
  return _tc;
}
export function targetScore(mi) { const t = targetTable()[mi]; const band = t.score >= 60 ? 'High' : t.score >= 40 ? 'Medium' : 'Low'; return { ...t, band, eligible: !MERCH[mi].enabled[5] || !MERCH[mi].enabled[6], enoughData: t.n >= 150 }; }
export function targetRanking(limit = 8) { return MERCH.map((m, mi) => targetScore(mi)).filter(t => t.eligible && t.enoughData).sort((a, b) => b.score - a.score).slice(0, limit); }

// ---- Pre-route decision: choose the better path per issuer where more than one acquirer already carries that issuer ----
export function preRouteDecisions(instFilter = () => true, minN = 25) {
  const out = [];
  ISS.forEach((issuer, ii) => {
    const per = ACQ.map((acq, ai) => { const r = TX.filter(t => t.iss === ii && t.acq === ai && instFilter(t.inst)); const lat = r.map(t => t.lat).sort((a, b) => a - b); return { acq, ai, n: r.length, approval: rate(r), p50: lat.length ? lat[Math.floor(lat.length / 2)] : null }; }).filter(x => x.n >= minN);
    if (per.length < 2) return;
    const total = per.reduce((a, x) => a + x.n, 0); const cur = [...per].sort((a, b) => b.n - a.n)[0];
    const best = [...per].sort((a, b) => b.approval - a.approval || a.p50 - b.p50)[0];
    const slow = per.filter(x => x.p50 > 1.4 * Math.min(...per.map(y => y.p50)));
    out.push({ issuer, n: total, current: cur, best, gain: r1(best.approval - cur.approval), switch: best.ai !== cur.ai && best.approval - cur.approval >= 2, slow: slow.map(x => x.acq), paths: per });
  });
  return out.sort((a, b) => b.gain - a.gain);
}

// ---- Risk triage preview: Allow / Monitor / Step-up / Decline, using only the signals this dataset carries ----
export const RISK_USED = ['Unusual ticket (against the merchant’s own average)', 'Merchant risk (share of its payments stopped for risk)', 'Issuer authentication failure rate'];
export const RISK_NOT_USED = ['New device', 'Velocity', 'Geo anomaly', 'Account age', 'Credit-line utilisation', 'Historical disputes'];
export function riskTriage(rows = TX) {
  const mrisk = MERCH.map((m, mi) => { const r = TX.filter(t => t.m === mi); return r.length ? r.filter(t => t.st === 5).length / r.length : 0; });
  const iauth = ISS.map((x, ii) => { const r = TX.filter(t => t.iss === ii); return r.length ? r.filter(t => t.st === 4).length / r.length : 0; });
  const mavg = MERCH.map((m, mi) => { const r = TX.filter(t => t.m === mi); return r.length ? r.reduce((a, t) => a + t.amt, 0) / r.length : 1; });
  const mr = [...mrisk].sort((a, b) => b - a)[Math.floor(MERCH.length * 0.15)], ir = [...iauth].sort((a, b) => b - a)[Math.floor(ISS.length * 0.2)];
  const act = { Allow: 0, Monitor: 0, 'Step-up': 0, Decline: 0 };
  rows.forEach(t => { const f = (t.amt > 3 * mavg[t.m] ? 1 : 0) + (mrisk[t.m] >= mr && mrisk[t.m] > 0 ? 1 : 0) + (iauth[t.iss] >= ir && iauth[t.iss] > 0 ? 1 : 0); act[f === 0 ? 'Allow' : f === 1 ? 'Monitor' : f === 2 ? 'Step-up' : 'Decline']++; });
  return { n: rows.length, act };
}
