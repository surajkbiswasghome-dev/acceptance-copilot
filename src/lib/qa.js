// Answers data questions from the computed dataset: it reads which acquirer, instrument, issuer, merchant, category and time window
// a question names, then computes the figures in code. The same function feeds the AI model, which only phrases the result.
import * as S from './stats.js';
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
const LAST = Math.max(...S.TX.map(t => t.day));
const DATES = d => { const x = new Date(Date.UTC(2026, 9, 3 + d)); return x.getUTCDate() + ' ' + x.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }); };
const INSTR = [[/upi\s*\+\s*(rupay )?credit line|credit line/, [6], 'UPI + credit line'], [/upi\s*\+\s*rupay credit|rupay credit (on|via) upi/, [5], 'UPI + RuPay credit'], [/rupay debit/, [0], 'RuPay debit'], [/rupay credit/, [1], 'RuPay credit'], [/rupay/, [0, 1], 'RuPay (debit and credit)'], [/visa/, [2], 'Visa'], [/master ?card/, [3], 'Mastercard'], [/upi bank/, [4], 'UPI bank'], [/\bupi\b/, [4, 5, 6], 'UPI (all types)'], [/net ?banking/, [7], 'Net banking'], [/wallet/, [8], 'Wallets'], [/\bcards?\b/, [0, 1, 2, 3], 'Cards']];
const DIMS = [['acquirer', /acquirer/, t => t.acq, S.ACQ], ['issuer', /issuer|bank/, t => t.iss, S.ISS], ['instrument', /instrument|payment (mode|method|type)|mode/, t => t.inst, S.INST], ['category', /categor|sector|industry/, t => t.cat, [...new Set(S.MERCH.map(m => m.category))]], ['merchant', /merchant/, t => t.m, S.MERCH.map(m => m.name)]];
const WIN = s => /today|last day|latest day/.test(s) ? [LAST, LAST, 'today (' + DATES(LAST) + ')'] : /yesterday/.test(s) ? [LAST - 1, LAST - 1, 'yesterday (' + DATES(LAST - 1) + ')'] : /(last|past) 7|this week|last week|seven days/.test(s) ? [LAST - 6, LAST, 'in the last 7 days'] : /(last|past) 14|two weeks/.test(s) ? [LAST - 13, LAST, 'in the last 14 days'] : [0, LAST, 'in the last 30 days'];
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const stat = rows => ({ n: rows.length, ok: S.rate(rows), lat: med(rows.map(t => t.lat)), cost: rows.length ? r1(rows.reduce((a, t) => a + t.cost, 0) / rows.length) : null, gmv: rows.filter(t => t.ok).reduce((a, t) => a + t.amt, 0) });
const reasons = rows => { const f = rows.filter(t => !t.ok); return S.DEC.map((d, i) => ({ label: S.DECLINE_LABEL[d], n: f.filter(t => t.st === i + 1).length })).filter(x => x.n).sort((a, b) => b.n - a.n).map(x => ({ ...x, share: r1(100 * x.n / f.length) })); };
const lakh = v => '₹' + r1(v / 100000) + ' lakh';
const small = n => (n < 30 ? ` Only ${n} payments, so treat this as indicative.` : '');

export function parse(q) {
  const s = q.toLowerCase(); const out = { filters: [], rows: S.TX, labels: [] };
  const [d0, d1, wl] = WIN(s); out.win = wl; out.rows = out.rows.filter(t => t.day >= d0 && t.day <= d1);
  const a = s.match(/acq(?:uirer)?\s*([a-d])\b/); if (a) { const i = 'abcd'.indexOf(a[1]); out.rows = out.rows.filter(t => t.acq === i); out.labels.push(S.ACQ[i]); out.acq = i; }
  const iss = s.match(/issuer\s*0?(\d{1,2})\b/); if (iss) { const i = S.ISS.findIndex(x => +x.replace(/\D/g, '') === +iss[1]); if (i >= 0) { out.rows = out.rows.filter(t => t.iss === i); out.labels.push(S.ISS[i]); out.iss = i; } }
  for (const [re, ids, name] of INSTR) if (re.test(s)) { out.rows = out.rows.filter(t => ids.includes(t.inst)); out.labels.push(name); out.inst = ids; break; }
  const m = S.MERCH.findIndex(x => s.includes(x.name.toLowerCase())); if (m >= 0) { out.rows = out.rows.filter(t => t.m === m); out.labels.push(S.MERCH[m].name); out.merchant = m; }
  const cat = [...new Set(S.MERCH.map(x => x.category))].find(c => s.includes(c.toLowerCase())); if (cat && m < 0) { out.rows = out.rows.filter(t => t.cat === cat); out.labels.push(cat + ' merchants'); out.cat = cat; }
  out.fault = /fault|due to|because of|caused by/.test(s); out.metric = /suffer|faced|face\b|affected|impact|hurt|\blost|loss|worst hit|hardest/.test(s) ? 'impact' : /decline|reason|why.*(fail|declin)|failure|failed|fail\b|cause/.test(s) && !/success rate|success%/.test(s) ? 'reasons' : /latenc|slow|speed|how fast|response time/.test(s) ? 'latency' : /\bcost|cheap|expens/.test(s) ? 'cost' : /volume|how many|count|number of|transactions|payments (did|were)|gmv|value|amount|sales/.test(s) ? 'volume' : /success|approve|accept|rate|perform|doing|how is|how are|status/.test(s) ? 'success' : null;
  out.dim = (DIMS.find(([k, re]) => re.test(s) && !(out[k === 'acquirer' ? 'acq' : k === 'issuer' ? 'iss' : k === 'merchant' ? 'merchant' : k === 'category' ? 'cat' : '_'] != null)) || [])[0];
  out.sup = /(weak|worst|lowest|poor|bad|least|most (declin|fail)|highest (declin|fail)|(declin|fail)\w* (the )?most|struggl|problem)/.test(s) ? 'low' : /(best|strong|highest|top|most|better)/.test(s) ? 'high' : null;
  return out;
}

export function dataAnswer(q) {
  const cmp = q.toLowerCase().match(/acq(?:uirer)?\s*([a-d])\b\s*(?:and|vs\.?|versus|&|,|or|with)\s*(?:acq(?:uirer)?\s*)?([a-d])\b/);
  if (cmp && cmp[1] !== cmp[2]) { const [w0, w1, wl] = WIN(q.toLowerCase()); const ids = [cmp[1], cmp[2]].map(x => 'abcd'.indexOf(x)); const parts = ids.map(i => { const r = S.TX.filter(t => t.acq === i && t.day >= w0 && t.day <= w1); const st = stat(r); return { name: S.ACQ[i], ...st, top: reasons(r).slice(0, 2).map(x => x.label.toLowerCase() + ' ' + x.share + '%').join(', ') }; });
    const t = `${parts.map(x => `${x.name}: ${x.ok}% success, ${x.lat} ms median latency, cost index ${x.cost}, n = ${x.n}`).join('  |  ')} ${wl}. Main decline reasons: ${parts.map(x => x.name + ' ' + x.top).join('; ')}.`; return { tool: 'data_query', answer: t, evidence: t }; }
  const p = parse(q); const who = p.labels.length ? p.labels.join(' · ') : 'the whole portfolio';
  if (!p.labels.length && !p.dim && !p.metric) return null;
  // Ranking across a dimension: "which acquirer is weakest", "which issuer declines the most".
  if (p.dim && !(p.metric === 'reasons' && p.labels.length && !p.sup)) {
    const d = DIMS.find(x => x[0] === p.dim); const rows = p.rows;
    if (p.metric === 'impact') {
      const fr = rows.filter(t => !t.ok && (!p.fault || t.st === 1)); const gs = d[3].map((name, i) => { const key = p.dim === 'category' ? name : i; const all = rows.filter(t => d[2](t) === key); const f = fr.filter(t => d[2](t) === key); return { name, n: all.length, fails: f.length, pct: all.length ? r1(100 * f.length / all.length) : 0, lost: f.reduce((a, t) => a + t.amt, 0) }; }).filter(g => g.fails > 0).sort((a, b) => b.fails - a.fails);
      if (!gs.length) return { tool: 'data_query', answer: `No ${p.fault ? 'timeout ' : ''}failures for ${who} ${p.win}.` };
      const what = p.fault ? 'timeouts (the failure reason that sits on the acquirer side)' : 'failed payments';
      const one = /which (merchant|acquirer|issuer|instrument|category)\s+(is|has|was|had|did|gets|got)\b/.test(q.toLowerCase());
      const t = one ? `${gs[0].name} is the most affected ${p.dim} by ${what} for ${who} ${p.win}: ${gs[0].fails} failed (${gs[0].pct}% of its ${gs[0].n} payments, ${lakh(gs[0].lost)} not completed). Next: ` + gs.slice(1, 4).map(g => `${g.name} ${g.fails}`).join(', ') + '.' + (() => { const v = [...gs].sort((a, b) => b.lost - a.lost)[0]; return v.name !== gs[0].name ? ` By value not completed, ${v.name} is highest at ${lakh(v.lost)}.` : ''; })() + (p.fault ? ' Only timeouts are counted as acquirer-side fault.' : '') : `${p.dim === 'merchant' ? 'Merchants' : p.dim[0].toUpperCase() + p.dim.slice(1) + 's'} most affected by ${what} for ${who} ${p.win}: ` + gs.slice(0, 5).map(g => `${g.name}: ${g.fails} failed (${g.pct}% of its ${g.n} payments, ${lakh(g.lost)} not completed)`).join('; ') + '.' + (p.fault ? ' Other decline reasons, such as issuer declines, are not counted as acquirer fault.' : '');
      return { tool: 'data_query', answer: t, evidence: t };
    } const groups = d[3].map((name, i) => { const key = p.dim === 'category' ? name : i; const r = rows.filter(t => d[2](t) === key); return { name, ...stat(r), fails: r.filter(t => !t.ok).length, declRate: r.length ? r1(100 * r.filter(t => !t.ok).length / r.length) : null }; }).filter(g => g.n >= (WIN(q.toLowerCase())[0] === WIN(q.toLowerCase())[1] ? 8 : p.dim === 'merchant' ? 10 : 20));
    if (groups.length) {
      const m = p.metric === 'latency' ? 'lat' : p.metric === 'cost' ? 'cost' : p.metric === 'volume' ? 'n' : p.metric === 'reasons' ? 'declRate' : 'ok';
      const higherBad = ['lat', 'cost', 'declRate'].includes(m); const asc = p.sup ? (p.sup === 'low') !== higherBad : false;
      const sorted = [...groups].sort((a, b) => (asc ? a[m] - b[m] : b[m] - a[m]) * (p.sup ? 1 : 1)); const fmt = g => `${g.name}: ${m === 'lat' ? g.lat + ' ms median latency' : m === 'cost' ? 'cost index ' + g.cost : m === 'n' ? g.n + ' payments' : m === 'declRate' ? g.declRate + '% declined' : g.ok + '% success'} (n = ${g.n})`;
      const head = sorted[0]; const label = m === 'ok' ? 'success rate' : m === 'declRate' ? 'decline rate' : m === 'lat' ? 'latency' : m === 'cost' ? 'cost index' : 'volume';
      const lead = p.sup ? `${head.name} is ${higherBad ? (p.sup === 'low' ? 'highest' : 'lowest') : (p.sup === 'low' ? 'weakest' : 'strongest')} on ${label} for ${who} ${p.win}: ` : `${label[0].toUpperCase() + label.slice(1)} by ${p.dim} for ${who} ${p.win}: `;
      return { tool: 'data_query', answer: lead + sorted.slice(0, 4).map(fmt).join('; ') + '.' + small(head.n), evidence: lead + sorted.map(fmt).join('; ') };
    }
  }
  const rows = p.rows; if (!rows.length) return { tool: 'data_query', answer: `There are no payments for ${who} ${p.win}.`, evidence: 'No rows.' };
  const st = stat(rows); const all = S.rate(S.TX.filter(t => t.day >= WIN(q.toLowerCase())[0] && t.day <= WIN(q.toLowerCase())[1]));
  if (p.metric === 'reasons') { const r = reasons(rows); if (!r.length) return { tool: 'decline_breakdown', answer: `${who} had no declines ${p.win} (n = ${st.n}).` }; const t = `Why payments for ${who} were not successful ${p.win} (${rows.length - rows.filter(x => x.ok).length} declines of ${st.n} payments, ${st.ok}% success): ` + r.slice(0, 4).map(x => `${x.label.toLowerCase()} ${x.share}%`).join(', ') + '.'; return { tool: 'decline_breakdown', answer: t + small(st.n), evidence: t }; }
  if (p.metric === 'latency') { const t = `${who} median latency ${p.win} is ${st.lat} ms across ${st.n} payments.`; return { tool: 'data_query', answer: t, evidence: t }; }
  if (p.metric === 'cost') { const t = `${who} average cost index ${p.win} is ${st.cost} across ${st.n} payments. The cost index is synthetic, not a real MDR.`; return { tool: 'data_query', answer: t, evidence: t }; }
  if (p.metric === 'volume') { const t = `${who} had ${st.n} payments ${p.win}, with ${lakh(st.gmv)} in successful value.`; return { tool: 'data_query', answer: t, evidence: t }; }
  const t = `${who} success rate ${p.win} is ${st.ok}% across ${st.n} payments` + (p.labels.length && all != null ? `, against ${all}% for the whole portfolio in the same period (${st.ok - all >= 0 ? '+' : ''}${r1(st.ok - all)} points).` : '.');
  return { tool: 'data_query', answer: t + small(st.n), evidence: t };
}

// A compact picture of the data, handed to the model so it can answer questions the parser did not map.
export function snapshot() {
  const k = S.kpis(); const day = S.TX.filter(t => t.day === LAST);
  const acq = S.ACQ.map((n, i) => { const r = S.TX.filter(t => t.acq === i); const s = stat(r); return `${n}: ${s.ok}% success, ${s.lat} ms median latency, cost index ${s.cost}, n=${s.n}`; });
  const inst = S.INST.map((n, i) => { const r = S.TX.filter(t => t.inst === i); return `${n}: ${S.rate(r)}% (n=${r.length})`; });
  return `Dataset: synthetic, 30 days (${DATES(0)} to ${DATES(LAST)}), ${k.n} payments, overall success ${k.success}%. Latest day (${DATES(LAST)}): ${S.rate(day)}% success, n=${day.length}.\nBy acquirer: ${acq.join(' | ')}\nBy instrument: ${inst.join(' | ')}\nDecline reasons overall: ${reasons(S.TX).map(x => x.label + ' ' + x.share + '%').join(', ')}\nFlagged findings: ${S.findings().map(f => f.title + ' (' + f.subtitle + ')').join(' | ')}`;
}
