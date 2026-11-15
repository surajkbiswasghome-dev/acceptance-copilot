// EMI at checkout: everything here is computed from the synthetic EMI events. The AI never invents a figure.
// Products: 0 EMI on RuPay credit card on UPI, 1 credit line on UPI with instalments, 2 RuPay card EMI on card rails (the baseline).
import ds from '../data/dataset.js';
import { MERCH, TX, ISS, ACQ, rate } from './stats.js';

export const EMI_MIN_TICKET = 2500;
export const EMI_PRODUCTS = [
  { id: 'emi:upicc', code: 0, name: 'EMI on RuPay credit card on UPI', short: 'RuPay card on UPI, as EMI', stage: 'EMI conversion', status: 'Introduced with NPCI as Contextual EMI on UPI (Global Fintech Fest 2026). Depends on the issuer and the UPI app.', what: 'lets a customer who pays on UPI with an eligible RuPay credit card choose instalments inside the same checkout, before paying', fit: 'electronics, travel, education, healthcare and home improvement merchants with higher-value baskets' },
  { id: 'emi:upicl', code: 1, name: 'Credit line on UPI with instalments', short: 'Credit line on UPI, in instalments', stage: 'EMI conversion', status: 'Subject to ecosystem readiness. NPCI guidelines were reported in 2025; broad availability is not confirmed in public sources.', what: 'lets a customer who pays on UPI from a bank credit line split the purchase into instalments at checkout', fit: 'the same high-value categories, once lenders and UPI apps support it' },
  { id: 'emi:card', code: 2, name: 'RuPay card EMI (card rails)', short: 'RuPay card EMI, on card rails', stage: 'EMI conversion', status: 'Live on card rails today. Used here as the baseline that UPI EMI is compared with.', what: 'EMI on a RuPay card at POS or e-commerce checkout, outside UPI', fit: 'merchants that already offer card EMI' }
];
export const emiProduct = k => EMI_PRODUCTS.find(x => x.id === k || x.code === k);
export const isEmi = k => typeof k === 'string' && k.startsWith('emi:');
export const OUTCOMES = ds.emi.outcomes;
export const OUT_LABEL = ['Converted to EMI', 'Left at plan selection', 'Not eligible', 'Issuer declined the conversion', 'Technical failure'];
export const EV = ds.emi.events.map(r => ({ day: r[0], m: r[1], p: r[2], iss: r[3], amt: r[4], ten: r[5], out: r[6], acq: ACQ.indexOf(MERCH[r[1]].acquirer), ok: r[6] === 0 }));

const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
const pct = (a, b) => (b ? (100 * a) / b : null);
export function funnel(rows) {
  const n = rows.length; const c = k => rows.filter(e => e.out === k).length; const left = c(1), notE = c(2), decl = c(3), tech = c(4), ok = c(0);
  return { shown: n, selected: n - left, eligible: n - left - notE, converted: ok, left, notEligible: notE, declined: decl, technical: tech, conversion: r1(pct(ok, n)), approval: r1(pct(ok, ok + decl + tech)), tpv: rows.filter(e => e.ok).reduce((a, e) => a + e.amt, 0) };
}
export function emiKpis() {
  const byProduct = EMI_PRODUCTS.map(p => ({ ...p, ...funnel(EV.filter(e => e.p === p.code)), merchants: MERCH.filter(m => m.emi[p.code]).length }));
  const upi = funnel(EV.filter(e => e.p < 2)); const all = funnel(EV);
  return { byProduct, upi, all, merchantsUpi: MERCH.filter(m => m.emi[0] || m.emi[1]).length, merchantsCard: MERCH.filter(m => m.emi[2]).length, merchantsNone: MERCH.filter(m => !m.emi[0] && !m.emi[1]).length };
}
export function tenureMix(rows) { const t = {}; rows.forEach(e => { t[e.ten] = (t[e.ten] || 0) + 1; }); return Object.entries(t).map(([k, v]) => ({ tenure: +k, n: v, share: r1(pct(v, rows.length)) })).sort((a, b) => a.tenure - b.tenure); }

// ---- Findings, found from the data. Each one cites its evidence and proposes one action. ----
export function emiFindings() {
  const out = []; const U = EV.filter(e => e.p < 2);
  const byIss = ISS.map((name, i) => { const r = U.filter(e => e.iss === i); return { name, n: r.length, declined: r.filter(e => e.out === 3).length }; }).filter(x => x.n >= 40);
  const worstI = [...byIss].sort((a, b) => b.declined / b.n - a.declined / a.n)[0];
  if (worstI) { const rest = byIss.filter(x => x !== worstI); const rr = pct(rest.reduce((a, x) => a + x.declined, 0), rest.reduce((a, x) => a + x.n, 0)); const rw = pct(worstI.declined, worstI.n);
    if (rw >= 2.5 * rr) out.push({ id: 'EF1', kind: 'Issuer', title: `${worstI.name} declines EMI conversions`, metric: r1(rw), evidence: [`${r1(rw)}% of ${worstI.n} UPI EMI attempts on ${worstI.name} were declined at conversion, against ${r1(rr)}% for the other issuers.`, `That is about ${Math.round(worstI.declined)} converted-then-declined checkouts in 30 days.`], cause: 'The issuer is rejecting the instalment conversion step, not the payment itself. Common reasons are a BIN or product not enabled for EMI, or a limit rule applied to the converted amount. The data cannot say which.', action: `Ask ${worstI.name} to confirm EMI conversion enablement for its RuPay credit BINs and share its decline reason codes, then re-measure.`, owner: 'Issuer relations', events: worstI.n }); }
  const byAcq = ACQ.map((name, i) => { const r = U.filter(e => e.acq === i); return { name, n: r.length, tech: r.filter(e => e.out === 4).length }; }).filter(x => x.n >= 80);
  const worstA = [...byAcq].sort((a, b) => b.tech / b.n - a.tech / a.n)[0];
  if (worstA) { const rest = byAcq.filter(x => x !== worstA); const rr = pct(rest.reduce((a, x) => a + x.tech, 0), rest.reduce((a, x) => a + x.n, 0)); const rw = pct(worstA.tech, worstA.n);
    if (rw >= 2.5 * rr) out.push({ id: 'EF2', kind: 'Acquirer', title: `${worstA.name} fails EMI plan requests`, metric: r1(rw), evidence: [`${r1(rw)}% of ${worstA.n} UPI EMI checkouts on ${worstA.name} ended in a technical failure, against ${r1(rr)}% elsewhere.`, 'The same acquirer already shows timeouts on RuPay in Insights, so this looks like one cause.'], cause: 'The plan lookup is timing out before the customer sees the options. Customers who never see plans cannot choose EMI.', action: `Raise a ticket with ${worstA.name} on plan-lookup timeouts. Until fixed, route UPI EMI merchants away from it where flexibility exists.`, owner: 'DevOps and acquirer', events: worstA.n }); }
  const small = EV.filter(e => e.ten >= 12 && e.amt < 10000), rest = EV.filter(e => !(e.ten >= 12 && e.amt < 10000));
  if (small.length >= 60) { const a = pct(small.filter(e => e.out === 1).length, small.length), b = pct(rest.filter(e => e.out === 1).length, rest.length);
    if (a - b >= 15) out.push({ id: 'EF3', kind: 'Offer design', title: 'Long tenures put off customers on small tickets', metric: r1(a), evidence: [`${r1(a)}% of ${small.length} checkouts offering 12 months or more on tickets under ₹10,000 ended at plan selection, against ${r1(b)}% for all other plans.`], cause: 'A long tenure on a small ticket looks like a lot of months for little money. Customers leave rather than compare.', action: 'Show 3 and 6 months first on tickets under ₹10,000, and keep 12 months or more for larger baskets.', owner: 'Offer design', events: small.length }); }
  const cl = EV.filter(e => e.p === 1), cc = EV.filter(e => e.p === 0);
  if (cl.length >= 100) { const a = pct(cl.filter(e => e.out === 2).length, cl.length), b = pct(cc.filter(e => e.out === 2).length, cc.length); if (a >= 2 * b) out.push({ id: 'EF4', kind: 'Eligibility', title: 'Credit-line customers are often not eligible for instalments', metric: r1(a), evidence: [`${r1(a)}% of ${cl.length} credit-line checkouts were not eligible, against ${r1(b)}% for RuPay credit card on UPI.`], cause: 'Credit lines are usually small. A larger ticket exceeds the available line, so the plan cannot be offered.', action: 'Use the Affordability Engine to show the maximum eligible amount, and offer a smaller amount with the rest paid now.', owner: 'Affordability', events: cl.length }); }
  return out;
}

// ---- Merchant view ----
const HV = ['Electronics', 'Travel', 'Education', 'Healthcare', 'Home improvement'];
const isUpiLike = i => i === 1 || (i >= 4 && i <= 6);
export const EMI_ASSUMPTION = { low: 0.03, high: 0.10 };
export function emiProfile(mi) {
  const r = TX.filter(t => t.m === mi); const n = r.length || 1; const addr = r.filter(t => t.amt >= EMI_MIN_TICKET && isUpiLike(t.inst));
  const gap = r.filter(t => t.st === 3 && t.amt >= EMI_MIN_TICKET);
  return { n: r.length, avgTicket: Math.round(r.reduce((a, t) => a + t.amt, 0) / n), addressable: addr.length, addressableShare: r1(pct(addr.length, n)), addressableAvg: addr.length ? Math.round(addr.reduce((a, t) => a + t.amt, 0) / addr.length) : 0, gap: gap.length, gapShare: r1(pct(gap.length, n)), upiShare: r1(pct(r.filter(t => t.inst >= 4 && t.inst <= 6).length, n)), tpv: r.reduce((a, t) => a + t.amt, 0), growth: (() => { const a = r.filter(t => t.day < 15).length, b = r.length - a; return a ? r1(100 * (b - a) / a) : 0; })() };
}
export function emiPotential(mi, a = EMI_ASSUMPTION) {
  const p = emiProfile(mi); const per1000 = p.n ? 1000 * p.addressable / p.n : 0;
  return { ...p, lowPer1000: Math.round(per1000 * a.low), highPer1000: Math.round(per1000 * a.high), lowValuePer1000: Math.round(per1000 * a.low * p.addressableAvg), highValuePer1000: Math.round(per1000 * a.high * p.addressableAvg), lowPts: r1(100 * p.addressable / (p.n || 1) * a.low), highPts: r1(100 * p.addressable / (p.n || 1) * a.high), assumption: a };
}
export const EMI_FACTORS = [
  { id: 'elig', label: 'EMI-eligible share (UPI payments of ₹2,500 and above)', w: 25, why: 'The checkouts where EMI can be shown at all.' },
  { id: 'tkt', label: 'Average ticket', w: 15, why: 'Larger baskets benefit most from instalments.' },
  { id: 'gap', label: 'Affordability gap (declined for balance at ₹2,500 and above)', w: 20, why: 'Customers who wanted to buy and could not fund it.' },
  { id: 'cat', label: 'Category (job-description clusters)', w: 15, why: 'Electronics, travel, education, healthcare and home improvement.' },
  { id: 'upi', label: 'UPI share of payments', w: 10, why: 'Customers already paying on UPI.' },
  { id: 'exp', label: 'Card EMI experience', w: 10, why: 'A merchant already offering card EMI has the checkout and offer discipline.' },
  { id: 'gro', label: 'Growth (second half against first half)', w: 5, why: 'Growing merchants adopt faster.' }
];
export const EMI_NOT_USED = ['Customer demographics', 'Location', 'Repeat customer %'];
let _et = null;
function emiTable() {
  if (_et) return _et;
  const raw = MERCH.map((m, mi) => { const p = emiProfile(mi); return { mi, n: p.n, elig: p.addressableShare, tkt: p.avgTicket, gap: p.gapShare, cat: HV.includes(m.category) ? 1 : 0, upi: p.upiShare, exp: m.emi[2] ? 1 : 0, gro: p.growth }; });
  const rank = id => { const v = raw.map(x => x[id]); const mn = Math.min(...v), mx = Math.max(...v); return raw.map(x => (mx === mn ? 0.5 : (x[id] - mn) / (mx - mn))); };
  const nr = Object.fromEntries(EMI_FACTORS.map(f => [f.id, rank(f.id)]));
  _et = raw.map((x, i) => { const parts = EMI_FACTORS.map(f => ({ ...f, value: x[f.id], pts: Math.round(f.w * nr[f.id][i] * 10) / 10 })); return { ...x, parts, score: Math.round(parts.reduce((a, p) => a + p.pts, 0)) }; });
  return _et;
}
export function emiScore(mi) { const t = emiTable()[mi]; return { ...t, band: t.score >= 60 ? 'High' : t.score >= 40 ? 'Medium' : 'Low', eligible: !MERCH[mi].emi[0], enoughData: t.n >= 150 }; }
export function emiRanking(limit = 6) { return MERCH.map((m, mi) => emiScore(mi)).filter(t => t.eligible && t.enoughData).sort((a, b) => b.score - a.score).slice(0, limit); }
export function acquirerEmiHealth() { return ACQ.map((name, i) => { const r = EV.filter(e => e.p < 2 && e.acq === i); const f = funnel(r); return { name, n: r.length, technical: r.length ? r1(pct(f.technical, r.length)) : null }; }); }
export function emiFit(mi, product = 0) {
  const m = MERCH[mi]; const p = emiProfile(mi); const pot = emiPotential(mi); const U = EV.filter(e => e.p === product || (product < 2 && e.p < 2)); const fn = funnel(U); const port = rate(TX);
  const ac = acquirerEmiHealth()[ACQ.indexOf(m.acquirer)]; const peers = MERCH.filter(x => x.category === m.category && x !== m); const peerOn = peers.filter(x => x.emi[0]).length;
  const st = (v, good, ok) => (v >= good ? 'ok' : v >= ok ? 'warn' : 'bad'); const lt = (v, good, ok) => (v <= good ? 'ok' : v <= ok ? 'warn' : 'bad');
  const rows = [
    { key: 'vol', label: 'Evidence base', value: p.n + ' payments in 30 days', rule: 'At least 150 payments', status: st(p.n, 150, 60) },
    { key: 'elig', label: 'EMI-eligible checkouts', value: p.addressable + ' UPI payments of ₹2,500 and above (' + p.addressableShare + '%)', rule: 'At least 30% of payments', status: st(p.addressableShare, 30, 15) },
    { key: 'tkt', label: 'Average ticket', value: '₹' + p.avgTicket.toLocaleString('en-IN'), rule: 'At least ₹12,000', status: st(p.avgTicket, 12000, 5000) },
    { key: 'gap', label: 'Affordability gap', value: p.gap + ' declined for balance at ₹2,500 and above (' + p.gapShare + '%)', rule: 'At least 3% of payments', status: st(p.gapShare, 3, 1.5) },
    { key: 'cat', label: 'Category fit', value: m.category, rule: 'Electronics, travel, education, healthcare or home improvement', status: HV.includes(m.category) ? 'ok' : 'warn' },
    { key: 'exp', label: 'Card EMI experience', value: m.emi[2] ? 'Already offers card EMI' : 'No card EMI today', rule: 'Already offers EMI on cards', status: m.emi[2] ? 'ok' : 'warn' },
    { key: 'peer', label: 'Peer adoption of EMI on UPI', value: peerOn + ' of ' + peers.length + ' ' + m.category.toLowerCase() + ' peers', rule: 'Shows demand. Zero means early mover.', status: peers.length && peerOn / peers.length >= 0.3 ? 'ok' : 'warn' },
    { key: 'net', label: 'EMI on UPI approval once eligible', value: fn.approval + '% network-wide', rule: 'At least 85%', status: st(fn.approval, 85, 75) },
    { key: 'acq', label: 'Acquirer readiness', value: ac.technical == null ? m.acquirer + ' · no UPI EMI traffic yet' : m.acquirer + ' · plan failures ' + ac.technical + '%', rule: 'Plan-request failures under 5%', status: ac.technical == null ? 'check' : lt(ac.technical, 5, 10) },
    { key: 'sr', label: 'Current success rate', value: rate(TX.filter(t => t.m === mi)) + '% against ' + port + '% portfolio', rule: 'Below the portfolio means more headroom', status: rate(TX.filter(t => t.m === mi)) < port - 2 ? 'ok' : 'warn' },
    { key: 'gate', label: 'Enablement gap', value: m.emi[product] ? 'Already enabled' : 'Not enabled today', rule: 'Not enabled yet', status: m.emi[product] ? 'bad' : 'ok' },
    { key: 'iss', label: 'Issuer EMI enablement (BIN)', value: 'To confirm with issuers', rule: 'Issuer BINs enabled for EMI on UPI', status: 'check' },
    { key: 'fund', label: 'Funding model for offers', value: 'To agree with the merchant', rule: 'Merchant, issuer or brand supported, or customer paid', status: 'check' }
  ];
  const scored = rows.filter(x => x.status !== 'check'); const score = scored.reduce((a, x) => a + (x.status === 'ok' ? 1 : x.status === 'warn' ? 0.5 : 0), 0);
  return { rows, score, outOf: scored.length, verdict: score >= 8 ? 'Strong fit' : score >= 6 ? 'Moderate fit' : 'Weak fit', pot, merchant: m, product: emiProduct(product), target: emiScore(mi) };
}
// Even-split example amounts for a no-cost plan: pure division, no rate involved.
export const noCostExample = (amount, tenures = [3, 6, 9]) => tenures.map(t => ({ tenure: t, monthly: Math.round(amount / t) }));
