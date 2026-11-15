// Offer budgets, sponsor-wise funding and stacking rules. All amounts are illustrative inputs. Nothing here is a real scheme.
import { CUSTOMERS, buildOffers, DEFAULT_POLICY } from './afford.js';

export const DEFAULT_CAMPAIGN = { budget: 250000, perCustomerCap: 6000, maxUses: 500, funding: { merchant: 70, brand: 20, issuer: 10 } };
// Replay the 600 synthetic customers arriving in turn. Interest subvention is drawn from the budget until it runs out, then offers continue without it.
export function simulateCampaign(m, category, merchantEmi, policy = DEFAULT_POLICY, camp = DEFAULT_CAMPAIGN, ticket = null) {
  let spend = 0, uses = 0, served = 0, subsidised = 0, capBlocked = 0, budgetBlocked = 0, pausedAt = null; const series = [];
  CUSTOMERS.forEach((c, i) => {
    const r = buildOffers(c, ticket || 30000, category, merchantEmi, policy, { assumeEnabled: true });
    if (!r.best) return; served++;
    const sub = r.best.merchantSubvention || 0;
    if (sub > 0) {
      if (sub > camp.perCustomerCap) capBlocked++;
      else if (spend + sub > camp.budget || uses >= camp.maxUses) { budgetBlocked++; if (pausedAt == null) pausedAt = i + 1; }
      else { spend += sub; uses++; subsidised++; }
    }
    if (i % 20 === 19 || i === CUSTOMERS.length - 1) series.push([i + 1, Math.round(spend)]);
  });
  const f = camp.funding; const tot = (f.merchant + f.brand + f.issuer) || 1;
  const by = { merchant: Math.round(spend * f.merchant / tot), brand: Math.round(spend * f.brand / tot), issuer: Math.round(spend * f.issuer / tot) };
  return { spend: Math.round(spend), uses, served, subsidised, capBlocked, budgetBlocked, pausedAt, series, by, remaining: Math.max(0, camp.budget - Math.round(spend)) };
}

// Stacking. Each offer has a type, a priority (lower applies first) and a funder. Rules are editable.
export const OFFER_CATALOGUE = [
  { id: 'nocost', name: 'No-cost EMI', type: 'interest', priority: 1, funder: 'Merchant, brand and issuer share' },
  { id: 'instant', name: 'Instant discount, 3% up to ₹2,000', type: 'discount', priority: 2, funder: 'Merchant', min: 10000, pct: 3, cap: 2000 },
  { id: 'cashback', name: 'Cashback, ₹500 on 9 months or longer', type: 'cashback', priority: 3, funder: 'Brand', min: 15000, flat: 500, minTenure: 9 },
  { id: 'feewaive', name: 'Processing fee waiver', type: 'fee', priority: 4, funder: 'Issuer', min: 5000 }
];
export const DEFAULT_STACK = { maxStack: 2, onePerType: true, exclusive: [['nocost', 'instant']], capPct: 10 };
export function resolveStack(ticket, offer, rules = DEFAULT_STACK, feeAmount = 0) {
  const applied = [], rejected = []; let total = 0; const capAmt = Math.round(ticket * rules.capPct / 100);
  const benefit = o => o.id === 'nocost' ? Math.round(offer?.merchantSubvention || 0) : o.id === 'instant' ? Math.min(o.cap, Math.round(ticket * o.pct / 100)) : o.id === 'cashback' ? o.flat : feeAmount;
  for (const o of [...OFFER_CATALOGUE].sort((a, b) => a.priority - b.priority)) {
    const why = (() => {
      if (o.id === 'nocost' && !(offer && offer.noCost)) return 'This plan is not a no-cost plan';
      if (o.min && ticket < o.min) return `Ticket is below ₹${o.min.toLocaleString('en-IN')}`;
      if (o.minTenure && !(offer && offer.tenure >= o.minTenure)) return `Plan is shorter than ${o.minTenure} months`;
      if (o.id === 'feewaive' && !(feeAmount > 0)) return 'No processing fee on this plan';
      if (rules.onePerType && applied.some(a => a.type === o.type)) return 'Only one offer of this type per purchase';
      const ex = rules.exclusive.find(p => p.includes(o.id) && p.some(x => x !== o.id && applied.some(a => a.id === x))); if (ex) return 'Cannot be combined with ' + OFFER_CATALOGUE.find(x => x.id === ex.find(y => y !== o.id)).name;
      if (applied.length >= rules.maxStack) return `Maximum of ${rules.maxStack} stacked offers reached`;
      if (total + benefit(o) > capAmt) return `Combined benefit would pass ${rules.capPct}% of the ticket`;
      return null; })();
    if (why) rejected.push({ ...o, why }); else { const b = benefit(o); applied.push({ ...o, benefit: b }); total += b; }
  }
  return { applied, rejected, total, capAmt, share: ticket ? Math.round(1000 * total / ticket) / 10 : 0 };
}
