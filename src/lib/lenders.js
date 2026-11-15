// Light multi-lender routing (extended scope). Three FICTIONAL lenders with different risk appetite, price and capacity.
// Nothing here is a real lender, rate or approval statistic. It shows the waterfall logic only.
import { CUSTOMERS, decide, DEFAULT_POLICY } from './afford.js';
export const LENDERS = [
  { id: 'A', name: 'Lender A (prime)', cutoff: 60, rate: 13, capacity: 0.30 },
  { id: 'B', name: 'Lender B (near-prime)', cutoff: 48, rate: 17, capacity: 0.40 },
  { id: 'C', name: 'Lender C (wider appetite)', cutoff: 38, rate: 22, capacity: 1 }
];
// Lender-funded products: credit line on UPI, cardless EMI, pay later. Card EMI is routed by the issuer, not a lender.
export const ROUTED = [1, 5, 6];
// Route one decision down the waterfall. used = counts so far, total = customers in the run (for capacity).
export function routeOne(d, used, total, lenders = LENDERS) {
  const tried = []; if (d.decision === 'Decline' || d.score == null) return { lender: null, tried, why: 'Declined before routing' };
  for (const L of [...lenders].sort((a, b) => a.rate - b.rate)) {
    if (d.score < L.cutoff) { tried.push({ id: L.id, why: `Score ${d.score} is below the cut-off ${L.cutoff}` }); continue; }
    if ((used[L.id] || 0) >= Math.floor(L.capacity * total)) { tried.push({ id: L.id, why: 'Capacity reached, fall back to the next lender' }); continue; }
    return { lender: L, tried, why: 'Best-priced lender that accepts this score and has capacity' };
  }
  return { lender: null, tried, why: 'No lender accepted this customer' };
}
export function routePortfolio(code = 1, ticket = 30000, policy = DEFAULT_POLICY, lenders = LENDERS, fallback = true) {
  const rows = CUSTOMERS.map(c => ({ c, d: decide(c, ticket, code, policy) })).filter(x => x.d.decision !== 'Decline');
  const used = {}; const out = { routed: 0, unrouted: 0, by: Object.fromEntries(lenders.map(l => [l.id, { n: 0, rate: 0, score: 0 }])), eligible: rows.length, fallback };
  rows.forEach(({ d }) => {
    const r = fallback ? routeOne(d, used, rows.length, lenders) : routeOne(d, {}, 1e9, [[...lenders].sort((a, b) => a.rate - b.rate)[0]]);
    if (r.lender) { used[r.lender.id] = (used[r.lender.id] || 0) + 1; const b = out.by[r.lender.id]; b.n++; b.rate += r.lender.rate; b.score += d.score; out.routed++; } else out.unrouted++;
  });
  Object.values(out.by).forEach(b => { b.avgRate = b.n ? Math.round(b.rate / b.n * 10) / 10 : 0; b.avgScore = b.n ? Math.round(b.score / b.n) : 0; });
  out.routedRate = out.eligible ? Math.round(1000 * out.routed / out.eligible) / 10 : 0; return out;
}
