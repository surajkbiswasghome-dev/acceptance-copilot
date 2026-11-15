// Affordability engine and offer engine. Rules and a visible scorecard, not a black box.
// Every rate, fee, threshold and funding rule below is an ILLUSTRATIVE INPUT the user can edit. Real values come from issuer or lender policy.
import ds from '../data/dataset.js';
import { EMI_PRODUCTS } from './emi.js';

export const COHORTS = ds.customers.cohorts; export const TIERS = ['Metro', 'Tier 2', 'Tier 3'];
export const CUSTOMERS = ds.customers.rows.map((r, i) => ({ id: 'C-' + String(i + 1).padStart(4, '0'), cohort: r[0], cohortName: COHORTS[r[0]], tier: r[1], income: r[2], obligations: r[3], cardLimit: r[4], cardUtil: r[5], lineLimit: r[6], lineUtil: r[7], onTime: r[8], mandate: !!r[9], hasCard: r[4] > 0, hasLine: r[6] > 0 }));
export const DEFAULT_POLICY = {
  minTicket: 2500, maxFoir: 50, minScore: 45, stepUpBand: 15, mandateBonus: 5,
  tenures: [3, 6, 9, 12, 18],
  rates: { 'emi:upicc': 15, 'emi:upicl': 18, 'emi:card': 15 }, feePct: 1,
  noCostMax: { Electronics: 6, Travel: 3, Education: 9, Healthcare: 6, 'Home improvement': 6, Fashion: 3, Grocery: 0, Restaurants: 0, Fuel: 0 }
};
export const POLICY_LABEL = { minTicket: 'Minimum ticket for EMI (₹)', maxFoir: 'Maximum share of monthly income going to EMIs (%)', minScore: 'Minimum score to approve', stepUpBand: 'Score band that needs a step-up', mandateBonus: 'Score credit for an AutoPay mandate' };
export const REASONS = {
  R01: 'Repayment history is below the level this policy needs.', R02: 'Utilisation of the limit is high.', R03: 'Existing monthly obligations are already high against income.',
  R04: 'Available limit is below the minimum ticket for EMI.', R05: 'The ticket is below the minimum for EMI.', R06: 'The instalment would take more of monthly income than the policy allows.',
  R07: 'The customer has no eligible instrument for this product.', R08: 'Score is in the step-up band: set up a UPI AutoPay mandate or verify further.', R09: 'Available limit is smaller than the ticket, so a smaller amount is offered.', R10: 'The affordable instalment is smaller than the ticket, so a smaller amount is offered.'
};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const pmt = (principal, annualPct, months) => { if (!months) return principal; const r = annualPct / 1200; return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months)); };
const r0 = x => Math.round(x);
export const money = v => '₹' + Math.round(v).toLocaleString('en-IN');

export function productAvailable(c, code) { return code === 1 ? c.hasLine : c.hasCard; }
export function availableLimit(c, code) { return code === 1 ? Math.round(c.lineLimit * (1 - c.lineUtil / 100)) : Math.round(c.cardLimit * (1 - c.cardUtil / 100)); }
export const utilFor = (c, code) => (code === 1 ? c.lineUtil : c.cardUtil);

export function scorecard(c, ticket, code, policy = DEFAULT_POLICY, mandate = c.mandate) {
  const avail = availableLimit(c, code); const foir = c.obligations / c.income;
  const parts = [
    { id: 'hist', label: 'Repayment history (on time, last 12 months)', w: 30, pts: 30 * clamp((c.onTime - 70) / 30), value: c.onTime + '% on time' },
    { id: 'util', label: 'Limit utilisation', w: 20, pts: 20 * (1 - clamp(utilFor(c, code) / 100)), value: utilFor(c, code) + '% used' },
    { id: 'obl', label: 'Existing obligations against income', w: 25, pts: 25 * clamp(1 - foir / 0.6), value: Math.round(foir * 100) + '% of income' },
    { id: 'inc', label: 'Income band', w: 15, pts: 15 * clamp(Math.log(c.income / 15000) / Math.log(10)), value: money(c.income) + ' a month' },
    { id: 'head', label: 'Headroom for this ticket', w: 10, pts: avail > 0 ? 10 * clamp(1 - ticket / avail) : 0, value: money(ticket) + ' against ' + money(avail) + ' available' }
  ].map(p => ({ ...p, pts: Math.round(p.pts * 10) / 10 }));
  const bonus = mandate ? policy.mandateBonus : 0; const total = Math.min(100, Math.round(parts.reduce((a, p) => a + p.pts, 0) + bonus));
  return { parts, bonus, total };
}

// One decision for one customer, one ticket, one product. Returns the decision with reason codes, always.
export function decide(c, ticket, code = 0, policy = DEFAULT_POLICY, opts = {}) {
  const mandate = opts.mandate ?? c.mandate; const rate = policy.rates[EMI_PRODUCTS[code].id]; const reasons = [];
  const base = { code, ticket, mandate, product: EMI_PRODUCTS[code], repayment: mandate ? 'UPI AutoPay mandate' : code === 1 ? 'UPI AutoPay mandate (recommended)' : 'Card bill, paid by any rail, including UPI' };
  const out = (decision, extra = {}) => ({ ...base, decision, reasons, ...extra });
  if (ticket < policy.minTicket) { reasons.push('R05'); return out('Decline', { score: null, parts: [], tenures: [], amount: 0, maxEmi: 0, available: 0 }); }
  if (!productAvailable(c, code)) { reasons.push('R07'); return out('Decline', { score: null, parts: [], tenures: [], amount: 0, maxEmi: 0, available: 0 }); }
  const avail = availableLimit(c, code); const sc = scorecard(c, ticket, code, policy, mandate); const maxEmi = Math.max(0, Math.round(c.income * policy.maxFoir / 100 - c.obligations));
  const weak = [...sc.parts].filter(p => ['hist', 'util', 'obl'].includes(p.id)).sort((a, b) => a.pts / a.w - b.pts / b.w);
  const R = { hist: 'R01', util: 'R02', obl: 'R03' };
  if (sc.total < policy.minScore) { reasons.push(R[weak[0].id]); if (weak[1] && weak[1].pts / weak[1].w < 0.5) reasons.push(R[weak[1].id]); return out('Decline', { score: sc.total, parts: sc.parts, bonus: sc.bonus, tenures: [], amount: 0, maxEmi, available: avail }); }
  let amount = ticket; let smaller = false;
  if (avail < ticket) { if (avail < policy.minTicket) { reasons.push('R04'); return out('Decline', { score: sc.total, parts: sc.parts, bonus: sc.bonus, tenures: [], amount: 0, maxEmi, available: avail }); } amount = Math.floor(avail / 100) * 100; smaller = true; reasons.push('R09'); }
  const longest = Math.max(...policy.tenures); const fits = (a, t) => pmt(a, rate, t) <= maxEmi;
  if (!policy.tenures.some(t => fits(amount, t))) {
    const per = pmt(1, rate, longest); const cap = per > 0 ? Math.floor(maxEmi / per / 100) * 100 : 0;
    if (cap < policy.minTicket) { reasons.push('R06'); return out('Decline', { score: sc.total, parts: sc.parts, bonus: sc.bonus, tenures: [], amount: 0, maxEmi, available: avail }); }
    amount = Math.min(amount, cap); smaller = true; reasons.push('R10');
  }
  const tenures = policy.tenures.map(t => { const emi = r0(pmt(amount, rate, t)); return { tenure: t, emi, ok: emi <= maxEmi, share: maxEmi ? Math.round(100 * emi / maxEmi) : null, total: emi * t, interest: Math.max(0, emi * t - amount) }; }).filter(x => x.ok);
  const stepUp = sc.total < policy.minScore + policy.stepUpBand; let unlock = null;
  if (stepUp) { reasons.push('R08'); if (!mandate) { const withM = scorecard(c, ticket, code, policy, true).total; if (withM >= policy.minScore + policy.stepUpBand) unlock = 'Setting up a UPI AutoPay mandate lifts the score to ' + withM + ' and moves this to Approve.'; } }
  const decision = smaller ? 'Approve a smaller amount' : stepUp ? 'Step-up' : 'Approve';
  return out(decision, { score: sc.total, parts: sc.parts, bonus: sc.bonus, tenures, amount, maxEmi, available: avail, unlock, stepUp });
}

// ---- Offer engine: turns an eligible decision into ranked, explained offers. ----
export const OFFER_WEIGHTS = { comfort: 40, conversion: 35, merchant: 15, readiness: 10 };
export function buildOffers(c, ticket, category, merchantEmi, policy = DEFAULT_POLICY, opts = {}) {
  const list = []; const decisions = [];
  EMI_PRODUCTS.forEach(p => {
    if (!(merchantEmi[p.code] || opts.assumeEnabled)) return; const d = decide(c, ticket, p.code, policy, opts); decisions.push(d);
    if (d.decision === 'Decline') return;
    const rate = policy.rates[p.id]; const nc = policy.noCostMax[category] ?? 0;
    d.tenures.forEach(t => {
      const noCost = t.tenure <= nc; const fee = Math.round(d.amount * policy.feePct / 100); const interest = noCost ? 0 : t.interest; const merchantCost = noCost ? t.interest : 0;
      const sh = t.share / 100; const comfort = sh >= 0.3 && sh <= 0.6 ? 1 : sh < 0.3 ? clamp(0.7 + sh) : clamp(1 - (sh - 0.6) / 0.4); const conv = clamp(0.45 + (noCost ? 0.3 : 0) + (t.tenure <= 6 ? 0.15 : t.tenure <= 9 ? 0.05 : -0.05) - (d.decision === 'Step-up' ? 0.05 : 0));
      const merchant = 1 - clamp((merchantCost / d.amount) / 0.08); const ready = p.code === 2 ? 1 : p.code === 0 ? 0.8 : 0.5;
      const score = Math.round(OFFER_WEIGHTS.comfort * comfort + OFFER_WEIGHTS.conversion * conv + OFFER_WEIGHTS.merchant * merchant + OFFER_WEIGHTS.readiness * ready);
      list.push({ product: p, code: p.code, tenure: t.tenure, amount: d.amount, emi: t.emi, share: t.share, total: noCost ? d.amount : t.total, interestToCustomer: interest, merchantSubvention: merchantCost, fee, funding: noCost ? 'Merchant-funded interest (no-cost EMI)' : 'Customer pays interest', noCost, decision: d.decision, score, parts: { comfort: Math.round(comfort * 100), conversion: Math.round(conv * 100), merchant: Math.round(merchant * 100), readiness: Math.round(ready * 100) }, rate, repayment: d.repayment });
    });
  });
  list.sort((a, b) => b.score - a.score || a.tenure - b.tenure);
  return { list, best: list[0] || null, decisions, menu: pickMenu(list) };
}
function pickMenu(list) { const seen = new Set(); const menu = []; for (const o of list) { const k = o.code + ':' + (o.noCost ? 'n' : 'c'); if (seen.has(k) && menu.length >= 2) continue; seen.add(k); menu.push(o); if (menu.length === 3) break; } return menu; }
export function explainOffer(o, c) {
  if (!o) return 'No EMI offer is shown. The decision reasons explain why, and nothing is offered that the customer cannot afford.';
  const bits = [`Offering ${o.tenure} months on ${o.product.short.replace(/^(\w)/, c => c.toLowerCase()).replace(/\bupi\b/gi, 'UPI').replace(/\brupay\b/gi, 'RuPay')} because the instalment of ${money(o.emi)} uses ${o.share}% of this customer's EMI capacity`];
  bits.push(o.noCost ? 'the interest is funded by the merchant, which keeps the choice simple for the customer' : 'the customer pays interest, since this category does not fund no-cost plans at this tenure');
  if (o.code === 2) bits.push('card rails are fully live, so readiness is highest'); else if (o.code === 1) bits.push('credit line instalments depend on ecosystem readiness, so this ranks lower'); else bits.push('the offer appears inside the UPI checkout before the customer pays');
  if (c && c.cohort === 3) bits.push('shorter tenures are preferred for gig and micro-business earners with uneven income');
  return bits.join('; ') + '.';
}

// ---- Portfolio and policy what-if over the synthetic customers ----
export function portfolio(policy = DEFAULT_POLICY, ticket = 30000, code = 0, filter = () => true) {
  const rows = CUSTOMERS.filter(filter).map(c => ({ c, d: decide(c, ticket, code, policy) }));
  const tally = { Approve: 0, 'Approve a smaller amount': 0, 'Step-up': 0, Decline: 0 }; const reasons = {}; const byCohort = COHORTS.map(() => ({ n: 0, ok: 0 })); let exposure = 0, thin = 0, ok = 0;
  rows.forEach(({ c, d }) => { tally[d.decision]++; d.reasons.forEach(r => { reasons[r] = (reasons[r] || 0) + 1; }); byCohort[c.cohort].n++; if (d.decision !== 'Decline') { ok++; byCohort[c.cohort].ok++; exposure += d.amount; if (d.score < policy.minScore + policy.stepUpBand + 10) thin++; } });
  const n = rows.length || 1;
  return { n: rows.length, tally, reasons, approved: ok, approvalRate: Math.round(1000 * ok / n) / 10, exposure, avgExposure: ok ? Math.round(exposure / ok) : 0, thinShare: ok ? Math.round(1000 * thin / ok) / 10 : 0, byCohort: byCohort.map((x, i) => ({ cohort: COHORTS[i], n: x.n, rate: x.n ? Math.round(1000 * x.ok / x.n) / 10 : 0 })) };
}
export const personas = () => COHORTS.map((_, k) => CUSTOMERS.find(c => c.cohort === k && c.hasCard && c.hasLine) || CUSTOMERS.find(c => c.cohort === k && c.hasCard)).filter(Boolean);
export const cohortShare = () => COHORTS.map((n, i) => ({ cohort: n, share: Math.round(1000 * CUSTOMERS.filter(c => c.cohort === i).length / CUSTOMERS.length) / 10 }));
