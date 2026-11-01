// Analytics for the Insights journey. Every number is computed here from the dataset. Nothing is predicted.
import * as S from './stats.js';
const { TX, ACQ, INST, ISS, MERCH } = S;
const r1 = x => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const r2 = x => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);
const pctile = (arr, p) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]; };
export const DAYS = 30;

export const MODE = i => (i <= 3 ? 'Cards' : i <= 6 ? 'UPI' : i === 7 ? 'Net banking' : 'Wallets');
export const NETWORK = i => (i <= 1 || i === 5 ? 'RuPay' : i === 2 ? 'Visa' : i === 3 ? 'Mastercard' : i === 4 || i === 6 ? 'UPI (bank / credit line)' : i === 7 ? 'Net banking' : 'Wallets');
const band = a => (a < 1000 ? 'Under ₹1k' : a < 5000 ? '₹1k to 5k' : a < 25000 ? '₹5k to 25k' : '₹25k and above');
export const BANDS = ['Under ₹1k', '₹1k to 5k', '₹5k to 25k', '₹25k and above'];

export const DIMS = {
  day: { label: 'Day', get: t => 'D' + String(t.day + 1).padStart(2, '0'), order: 'natural' },
  acquirer: { label: 'Acquirer', get: t => ACQ[t.acq], order: 'natural' },
  mode: { label: 'Payment mode', get: t => MODE(t.inst), order: 'volume' },
  network: { label: 'Network', get: t => NETWORK(t.inst), order: 'volume' },
  instrument: { label: 'Instrument', get: t => INST[t.inst], order: 'natural' },
  issuer: { label: 'Issuer', get: t => ISS[t.iss], order: 'natural' },
  category: { label: 'Merchant category', get: t => t.cat, order: 'volume' },
  segment: { label: 'Merchant segment', get: t => t.seg, order: 'volume' },
  ticket: { label: 'Ticket size', get: t => band(t.amt), order: 'bands' }
};
export const METRICS = {
  success: { label: 'Success rate (%)', unit: '%', fn: rows => (rows.length ? r1((100 * rows.filter(t => t.ok).length) / rows.length) : null), min: 85 },
  volume: { label: 'Payments', unit: '', fn: rows => rows.length },
  gmv: { label: 'Successful value (₹ lakh)', unit: '', fn: rows => r1(rows.filter(t => t.ok).reduce((a, t) => a + t.amt, 0) / 100000) },
  failed: { label: 'Failed payments', unit: '', fn: rows => rows.filter(t => !t.ok).length },
  timeout: { label: 'Timeout rate (%)', unit: '%', fn: rows => (rows.length ? r2((100 * rows.filter(t => t.st === 1).length) / rows.length) : null) },
  latency: { label: 'Median latency (ms)', unit: ' ms', fn: rows => pctile(rows.filter(t => t.st !== 1).map(t => t.lat), 50) },
  p95: { label: 'P95 latency (ms)', unit: ' ms', fn: rows => pctile(rows.filter(t => t.st !== 1).map(t => t.lat), 95) },
  cost: { label: 'Cost index (synthetic)', unit: '', fn: rows => (rows.length ? r1(rows.reduce((a, t) => a + t.cost, 0) / rows.length) : null) }
};
const orderKeys = (dim, rows, keys) => {
  if (dim === 'bands') return BANDS.filter(k => keys.includes(k));
  if (DIMS[dim].order === 'natural') return keys.sort();
  const c = {}; rows.forEach(t => { const k = DIMS[dim].get(t); c[k] = (c[k] || 0) + 1; }); return keys.sort((a, b) => c[b] - c[a]);
};
export const filterRows = (f = {}, rows = TX) => rows.filter(t => (f.acquirer == null || f.acquirer === '' || ACQ[t.acq] === f.acquirer) && (f.mode == null || f.mode === '' || MODE(t.inst) === f.mode) && (f.network == null || f.network === '' || NETWORK(t.inst) === f.network)
  && (f.issuer == null || f.issuer === '' || ISS[t.iss] === f.issuer) && (f.category == null || f.category === '' || t.cat === f.category) && (f.merchant == null || f.merchant === '' || t.m === Number(f.merchant)) && (f.from == null || t.day >= f.from) && (f.to == null || t.day <= f.to));

// x dimension, y metric, optional split dimension, filters. Returns chart-ready rows and a table.
export function aggregate({ x = 'day', y = 'success', split = '', filters = {}, smooth = 1 } = {}) {
  const rows = filterRows(filters); const M = METRICS[y];
  const xk = orderKeys(x === 'ticket' ? 'bands' : x, rows, [...new Set(rows.map(DIMS[x].get))]);
  const sk = split ? orderKeys(split === 'ticket' ? 'bands' : split, rows, [...new Set(rows.map(DIMS[split].get))]) : ['All'];
  const sm = x === 'day' && smooth > 1; const data = xk.map(k => { const dnum = Number(k.slice(1)) - 1; const base = sm ? rows.filter(t => t.day <= dnum && t.day > dnum - smooth) : rows.filter(t => DIMS[x].get(t) === k); const o = { x: k, n: base.length }; sk.forEach(s => { const sub = split ? base.filter(t => DIMS[split].get(t) === s) : base; o[s] = sub.length >= (y === 'success' || y === 'timeout' ? (sm ? 15 : 8) : sm ? 5 : 1) ? M.fn(sub) : null; o['n_' + s] = sub.length; }); return o; });
  return { data, series: sk, rows: rows.length, metric: M, xLabel: DIMS[x].label };
}
// Slice breakdown for drill-down tables.
export function breakdown(by, filters, metrics = ['volume', 'success', 'timeout', 'latency', 'cost']) {
  const rows = filterRows(filters); const keys = orderKeys(by, rows, [...new Set(rows.map(DIMS[by].get))]);
  return keys.map(k => { const sub = rows.filter(t => DIMS[by].get(t) === k); const o = { key: k, n: sub.length }; metrics.forEach(m => { o[m] = METRICS[m].fn(sub); }); return o; });
}
export const shareOf = (by, filters) => { const rows = filterRows(filters); const b = breakdown(by, filters, ['success']); return b.map(r => ({ name: r.key, value: r.n, share: r1((100 * r.n) / (rows.length || 1)), success: r.success })); };
export const kpiWindow = (from, to, filters = {}) => { const rows = filterRows({ ...filters, from, to }); return { n: rows.length, success: METRICS.success.fn(rows), latency: METRICS.latency.fn(rows), cost: METRICS.cost.fn(rows), gmv: METRICS.gmv.fn(rows), failed: rows.filter(t => !t.ok).length }; };

// ---- Dynamic insights: compare the 7 days ending on endDay with the 7 days before ----
export function insights(endDay = DAYS - 1, w = 7, filters = {}) {
  const cur = filterRows({ ...filters, from: endDay - w + 1, to: endDay }); const prev = filterRows({ ...filters, from: endDay - 2 * w + 1, to: endDay - w });
  const out = []; if (cur.length < 40 || prev.length < 40) return out;
  const groups = [['acquirer', 'Acquirer'], ['network', 'Network'], ['issuer', 'Issuer'], ['mode', 'Payment mode']];
  groups.forEach(([dim]) => {
    const keys = [...new Set(cur.map(DIMS[dim].get))];
    keys.forEach(k => {
      const a = cur.filter(t => DIMS[dim].get(t) === k), b = prev.filter(t => DIMS[dim].get(t) === k); if (a.length < 40 || b.length < 40) return;
      const sa = METRICS.success.fn(a), sb = METRICS.success.fn(b), d = r1(sa - sb); const se = Math.sqrt((sa * (100 - sa)) / a.length + (sb * (100 - sb)) / b.length);
      if (Math.abs(d) >= 1.5 && Math.abs(d) > 2.2 * se) out.push({ id: dim + k + 's', dir: d > 0 ? 'up' : 'down', kind: 'success', who: k, dim, delta: d, from: sb, to: sa, n: a.length, score: Math.abs(d) * Math.sqrt(a.length) });
      const la = METRICS.latency.fn(a), lb = METRICS.latency.fn(b); if (la && lb && dim !== 'issuer') { const pc = r1((100 * (la - lb)) / lb); if (Math.abs(pc) >= 12) out.push({ id: dim + k + 'l', dir: pc < 0 ? 'up' : 'down', kind: 'latency', who: k, dim, delta: pc, from: lb, to: la, n: a.length, score: Math.abs(pc) * 0.35 * Math.sqrt(a.length) / 4 }); }
    });
  });
  const seen = new Set(); const ranked = out.sort((a, b) => b.score - a.score).filter(i => { const key = i.who + i.kind; if (seen.has(key)) return false; seen.add(key); return true; });
  return ranked.slice(0, 6).map(i => ({ ...i, text: i.kind === 'success' ? `${i.who} success ${i.dir === 'up' ? 'rose' : 'fell'} ${Math.abs(i.delta)} points to ${i.to}% (from ${i.from}%)` : `${i.who} median latency ${i.dir === 'up' ? 'improved' : 'worsened'} ${Math.abs(i.delta)}% to ${i.to} ms` }));
}

// ---- Routing: parameter scorecard, composite score with adjustable weights, simulation, agent rules ----
export const ROUTE_PARAMS = [
  { id: 'success', label: 'Success rate', hint: 'Higher is better', w: 40 },
  { id: 'cost', label: 'Cost', hint: 'Lower is better (synthetic index)', w: 20 },
  { id: 'latency', label: 'Latency', hint: 'Lower P95 is better', w: 15 },
  { id: 'reliability', label: 'Reliability', hint: 'Steadier day to day is better', w: 15 },
  { id: 'coverage', label: 'Coverage', hint: 'More merchants served on this instrument', w: 10 }
];
export function scorecard(filters = {}, weights = {}) {
  const rows = filterRows(filters); const out = ACQ.map((name, ai) => {
    const r = rows.filter(t => t.acq === ai); const daily = []; for (let d = 0; d < DAYS; d++) { const x = r.filter(t => t.day === d); if (x.length >= 6) daily.push(METRICS.success.fn(x)); }
    const mean = daily.reduce((a, b) => a + b, 0) / (daily.length || 1); const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / (daily.length || 1));
    const bad = daily.filter(v => v < mean - 8).length;
    return { name, ai, n: r.length, success: METRICS.success.fn(r), timeout: METRICS.timeout.fn(r), p50: METRICS.latency.fn(r), p95: METRICS.p95.fn(r), cost: METRICS.cost.fn(r), sd: r2(sd), badDays: bad, merchants: new Set(r.map(t => t.m)).size };
  }).filter(a => a.n >= 20);
  const norm = (vals, hi) => { const mn = Math.min(...vals), mx = Math.max(...vals); return vals.map(v => (mx === mn ? 50 : 100 * (hi ? (v - mn) / (mx - mn) : (mx - v) / (mx - mn)))); };
  const sN = norm(out.map(a => a.success), true), cN = norm(out.map(a => a.cost), false), lN = norm(out.map(a => a.p95), false), rN = norm(out.map(a => a.sd), false), vN = norm(out.map(a => a.merchants), true);
  const w = { success: 40, cost: 20, latency: 15, reliability: 15, coverage: 10, ...weights }; const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  out.forEach((a, i) => { a.scores = { success: Math.round(sN[i]), cost: Math.round(cN[i]), latency: Math.round(lN[i]), reliability: Math.round(rN[i]), coverage: Math.round(vN[i]) }; a.score = Math.round(Object.keys(w).reduce((s, k) => s + a.scores[k] * w[k], 0) / tot); });
  return out.sort((a, b) => b.score - a.score);
}
// Moving a share of one acquirer's volume to another. Arithmetic on observed rates, not a forecast.
export function routeSim(inst, from, to, sharePct, filters = {}) {
  const A = filterRows({ ...filters, network: undefined }).filter(t => t.inst === inst && t.acq === from), B = filterRows(filters).filter(t => t.inst === inst && t.acq === to);
  if (A.length < 20 || B.length < 20) return null; const moved = Math.round((A.length * sharePct) / 100);
  const sa = METRICS.success.fn(A), sb = METRICS.success.fn(B), ca = METRICS.cost.fn(A), cb = METRICS.cost.fn(B), la = METRICS.p95.fn(A), lb = METRICS.p95.fn(B);
  return { moved, fromN: A.length, sa, sb, extraSuccess: r1((moved * (sb - sa)) / 100), costDelta: r1(((cb - ca) * moved) / 100), cost: [ca, cb], p95: [la, lb] };
}
const dailyMap = (rows, key) => { const m = {}; rows.forEach(t => { const k = key(t); (m[k] = m[k] || []).push(t); }); return m; };
export function agentRules() {
  const rules = [];
  // Rule 1: timeout spike on an acquirer x instrument pair in a day
  const pairs = {}; TX.forEach(t => { const k = t.acq + '|' + t.inst; (pairs[k] = pairs[k] || []).push(t); });
  const hits = []; Object.entries(pairs).forEach(([k, rows]) => {
    if (rows.length < 150) return; const norm = METRICS.timeout.fn(rows); const byDay = dailyMap(rows, t => t.day);
    Object.entries(byDay).forEach(([d, x]) => { if (x.length >= 12) { const tr = METRICS.timeout.fn(x); if (tr >= Math.max(2.2 * norm, 6) && (tr - norm) / Math.sqrt(Math.max(norm, 1) * 100 / x.length) > 2.6) hits.push({ day: Number(d), acq: Number(k.split('|')[0]), inst: Number(k.split('|')[1]), n: x.length, tr, norm }); } });
  });
  const avoid = hits.reduce((a, h) => a + 0.3 * (h.n * h.tr / 100 - h.n * h.norm / 100), 0);
  rules.push({ id: 'R1', name: 'Timeout spike failover', when: 'A pair of acquirer and instrument shows a daily timeout rate above 2.2 times its own norm (and at least 6%)', then: 'Shift 30% of that pair’s volume to the best alternative acquirer until it recovers', fires: hits.length, detail: hits.slice(0, 4).map(h => `${ACQ[h.acq]} × ${INST[h.inst]} on D${String(h.day + 1).padStart(2, '0')}: ${r1(h.tr)}% timeouts vs ${r1(h.norm)}% norm`), avoided: Math.round(Math.max(avoid, 0)) });
  // Rule 2: acquirer-wide success dip
  const dips = []; ACQ.forEach((nm, ai) => { const rows = TX.filter(t => t.acq === ai); const mean = METRICS.success.fn(rows); const byDay = dailyMap(rows, t => t.day); Object.entries(byDay).forEach(([d, x]) => { if (x.length >= 20) { const s = METRICS.success.fn(x); const z = (mean - s) / Math.sqrt((mean * (100 - mean)) / x.length); if (s <= mean - 6 && z > 2.6) dips.push({ day: Number(d), ai, n: x.length, s, mean }); } }); });
  const avoid2 = dips.reduce((a, h) => a + 0.5 * (h.n * (h.mean - h.s) / 100), 0);
  rules.push({ id: 'R2', name: 'Acquirer outage failover', when: 'An acquirer’s daily success is at least 6 points below its own average', then: 'Fail over 50% of its volume to the next-best acquirer, then ramp back after two clean days', fires: dips.length, detail: dips.slice(0, 4).map(h => `${ACQ[h.ai]} on D${String(h.day + 1).padStart(2, '0')}: ${r1(h.s)}% vs ${r1(h.mean)}% average`), avoided: Math.round(avoid2) });
  // Rule 3: cost-aware routing for small card tickets when success is within tolerance
  const small = TX.filter(t => t.amt < 1000 && t.inst >= 2 && t.inst <= 3); const sc = ACQ.map((n, ai) => { const r = small.filter(t => t.acq === ai); return { ai, n: r.length, s: METRICS.success.fn(r), c: METRICS.cost.fn(r) }; }).filter(a => a.n >= 20);
  let saving = 0, detail = []; if (sc.length > 1) { const best = [...sc].sort((a, b) => b.s - a.s)[0]; const cheap = sc.filter(a => a.s >= best.s - 0.5).sort((a, b) => a.c - b.c)[0]; sc.forEach(a => { if (a.ai !== cheap.ai && a.s <= cheap.s + 0.5) { saving += (a.c - cheap.c) * a.n; detail.push(`${ACQ[a.ai]} (cost ${a.c}) → ${ACQ[cheap.ai]} (cost ${cheap.c}), success ${a.s}% vs ${cheap.s}%`); } }); }
  rules.push({ id: 'R3', name: 'Cost-aware routing for small card tickets', when: 'Ticket is under ₹1,000 on Visa or Mastercard and another acquirer’s success is within 0.5 points', then: 'Route to the lowest-cost acquirer', fires: detail.length, detail, avoided: null, costSaved: Math.round(saving) });
  return rules;
}

// ---- Acceptance levers: what is addressable, with a stated assumption for how much could be recovered ----
export const LEVER_ASSUMPTIONS = { routing: [0.4, 0.7], retry: [0.05, 0.15], config: [0.8, 0.95], auth: [0.3, 0.6] };
export function levers(filters = {}) {
  const rows = filterRows(filters); const n = rows.length || 1; const out = [];
  // routing: timeouts above the best peer rate for the same instrument
  let excess = 0; INST.forEach((_, i) => { const by = ACQ.map((_, a) => rows.filter(t => t.inst === i && t.acq === a)).filter(x => x.length >= 40); if (by.length < 2) return; const rates = by.map(x => x.filter(t => t.st === 1).length / x.length); const best = Math.min(...rates); by.forEach((x, k) => { excess += Math.max(0, (rates[k] - best) * x.length); }); });
  out.push({ id: 'routing', name: 'Dynamic routing away from timeouts', base: Math.round(excess), basis: 'Timeouts above the best acquirer for the same instrument', a: LEVER_ASSUMPTIONS.routing, link: '#/explain?id=f1', linkText: 'See the finding' });
  const soft = rows.filter(t => t.st === 2 || t.st === 3).length; out.push({ id: 'retry', name: 'Smart retry of soft declines', base: soft, basis: 'Issuer declines and insufficient-funds declines', a: LEVER_ASSUMPTIONS.retry, link: '#/explain?id=f3', linkText: 'Related findings' });
  const cfg = rows.filter(t => t.st === 6).length; out.push({ id: 'config', name: 'Fix merchant configuration', base: cfg, basis: 'Configuration declines', a: LEVER_ASSUMPTIONS.config, link: '#/explain?id=f6', linkText: 'See the finding' });
  let ax = 0; ACQ.forEach((_, a) => INST.forEach((_, i) => { const x = rows.filter(t => t.acq === a && t.inst === i); if (x.length < 60) return; const peers = rows.filter(t => t.inst === i && t.acq !== a); const p = peers.filter(t => t.st === 4).length / (peers.length || 1); ax += Math.max(0, x.filter(t => t.st === 4).length - p * x.length); })); out.push({ id: 'auth', name: 'Improve authentication flows', base: Math.round(ax), basis: 'Authentication failures above peers on the same instrument', a: LEVER_ASSUMPTIONS.auth, link: '#/explain?id=f7', linkText: 'See the finding' });
  out.forEach(l => { l.lowPts = r2((100 * l.base * l.a[0]) / n); l.highPts = r2((100 * l.base * l.a[1]) / n); l.lowN = Math.round(l.base * l.a[0]); l.highN = Math.round(l.base * l.a[1]); });
  return { levers: out.sort((a, b) => b.highPts - a.highPts), n, totalLow: r2(out.reduce((a, l) => a + l.lowPts, 0)), totalHigh: r2(out.reduce((a, l) => a + l.highPts, 0)), baseline: METRICS.success.fn(rows) };
}
export function coverageGrid() {
  const cats = [...new Set(MERCH.map(m => m.category))]; return { cats, insts: INST, cells: cats.map(c => { const ms = MERCH.filter(m => m.category === c); return INST.map((_, i) => Math.round((100 * ms.filter(m => m.enabled[i]).length) / ms.length)); }) };
}

// ---- Routing agent: instruments where another acquirer clearly did better, with benefits AND trade-offs ----
export function recommendMoves(limit = 4) {
  const out = [];
  INST.forEach((name, inst) => {
    const per = ACQ.map((_, a) => { const r = TX.filter(t => t.inst === inst && t.acq === a); return { a, n: r.length, success: METRICS.success.fn(r), cost: METRICS.cost.fn(r), p95: METRICS.p95.fn(r), merchants: new Set(r.map(t => t.m)).size, timeout: METRICS.timeout.fn(r) }; }).filter(x => x.n >= 60);
    const total = per.reduce((a, x) => a + x.n, 0);
    per.forEach(from => per.forEach(to => {
      if (from.a === to.a || to.success - from.success < 3) return;
      const share = 30; const sim = routeSim(inst, from.a, to.a, share); if (!sim || sim.extraSuccess < 2) return;
      const load = r1((100 * sim.moved) / to.n); const trade = [];
      if (to.cost > from.cost) trade.push(`Costs more: cost index ${from.cost} to ${to.cost} per payment (about ${r1((to.cost - from.cost) * sim.moved / 100)} index points on the moved volume).`);
      if (to.p95 > from.p95) trade.push(`Slower at the tail: P95 latency ${from.p95} to ${to.p95} ms.`);
      trade.push(`${ACQ[to.a]} takes on ${load}% more ${name} volume than it carries today. Check capacity with them first.`);
      if (to.merchants <= 4) trade.push(`${ACQ[to.a]} serves only ${to.merchants} merchants on ${name}, so merchant coverage and onboarding effort matter.`);
      if (to.n < 150) trade.push(`The evidence for ${ACQ[to.a]} rests on ${to.n} payments only, so the gain is less certain.`);
      trade.push('Concentrating on one acquirer raises dependency risk. Keep a fallback and ramp gradually.');
      out.push({ id: inst + '-' + from.a + '-' + to.a, inst, instName: name, from: from.a, to: to.a, share, sim, benefits: [`Success on ${name}: ${from.success}% to ${to.success}%.`, `About ${sim.extraSuccess} more successful payments on the moved ${sim.moved} (illustration, not a forecast).`, from.timeout > to.timeout ? `Timeouts: ${from.timeout}% to ${to.timeout}%.` : null, to.cost < from.cost ? `Cheaper: cost index ${from.cost} to ${to.cost}.` : null, to.p95 < from.p95 ? `Faster at the tail: P95 ${from.p95} to ${to.p95} ms.` : null].filter(Boolean), tradeoffs: trade, score: sim.extraSuccess });
    }));
  });
  const best = {}; out.forEach(r => { const k = r.inst + '-' + r.from; if (!best[k] || r.score > best[k].score) best[k] = r; });
  return Object.values(best).sort((a, b) => b.score - a.score).slice(0, limit);
}
