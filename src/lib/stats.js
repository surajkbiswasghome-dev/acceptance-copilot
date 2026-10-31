// All numbers in the product are computed here, in code. The AI never invents a figure.
import ds from '../data/dataset.js';

export const { acquirers: ACQ, instruments: INST, issuers: ISS, declines: DEC, merchants: MERCH } = ds;
export const DECLINE_LABEL = { timeout: 'Timeouts', issuer_decline: 'Issuer declines', insufficient_funds: 'Insufficient funds', auth_failed: 'Authentication failed', risk: 'Risk rules', config: 'Configuration' };
export const HIGH_TICKET = 25000;
export const TX = ds.tx.map(r => ({ day: r[0], m: r[1], acq: r[2], inst: r[3], iss: r[4], amt: r[5], st: r[6], ok: r[6] === 0, cat: MERCH[r[1]].category }));

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
  items.push({ id: 'f1', gate: 'Experience', title: acq.acquirer + ' × RuPay', subtitle: acq.success + '% success · n = ' + acq.n + ' · peers ' + acq.peers + '% · gap ' + acq.gap + ' pts', gap: acq.gap, impact: lostRows + ' extra failed payments in 30 days', acq: aIdx });
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
  return items;
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
