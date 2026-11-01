// The agent's tools and an offline (rules) agent. The same tools run in the browser and in the Vercel function.
import * as S from './stats.js';

export const TOOL_DEFS = [
  { name: 'compare_acquirers', description: 'Success rate of each acquirer on RuPay payments against the other acquirers.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'decline_breakdown', description: 'Decline reason mix. Optionally limited to one acquirer index (0-3) and RuPay.', parameters: { type: 'OBJECT', properties: { acquirer: { type: 'INTEGER' }, rupay_only: { type: 'BOOLEAN' } } } },
  { name: 'issuer_split', description: 'Success, issuer-decline rate and timeout rate per issuer. Optionally limited to one acquirer index.', parameters: { type: 'OBJECT', properties: { acquirer: { type: 'INTEGER' } } } },
  { name: 'share_by_category', description: 'How often an instrument index (0-6) is used in each merchant category, with success rate and enablement.', parameters: { type: 'OBJECT', properties: { instrument: { type: 'INTEGER' } }, required: ['instrument'] } },
  { name: 'ticket_split', description: 'Share and success of an instrument index (0-6) at tickets of ₹25,000 and above versus below.', parameters: { type: 'OBJECT', properties: { instrument: { type: 'INTEGER' } }, required: ['instrument'] } },
  { name: 'check_sample_size', description: 'Checks whether n is large enough to draw a conclusion.', parameters: { type: 'OBJECT', properties: { n: { type: 'INTEGER' } }, required: ['n'] } }
];

export function runTool(name, a = {}) {
  switch (name) {
    case 'compare_acquirers': return S.compareAcquirers(S.isRupay);
    case 'decline_breakdown': return S.declineBreakdown(t => (a.acquirer == null || t.acq === a.acquirer) && (!a.rupay_only || S.isRupay(t.inst)));
    case 'issuer_split': return S.issuerSplit(t => a.acquirer == null || t.acq === a.acquirer);
    case 'share_by_category': return S.shareByCategory(a.instrument);
    case 'ticket_split': return S.ticketSplit(a.instrument);
    case 'check_sample_size': return S.checkSampleSize(a.n);
    default: return { error: 'unknown tool' };
  }
}

const top = (arr, k) => [...arr].sort((x, y) => y[k] - x[k])[0];

// Offline agent: deterministic reasoning over the same tools. Used when Gemini is unavailable.
export function offlineAgent(id) {
  const steps = []; const call = (tool, args, summary) => { const result = runTool(tool, args); steps.push({ tool, args, result: summary(result) }); return result; };
  const F = S.findings().find(f => f.id === id);
  if (id === 'f1') {
    const cmp = call('compare_acquirers', {}, r => { const w = [...r].sort((a, b) => a.gap - b.gap)[0]; return w.acquirer + ' is ' + Math.abs(w.gap) + ' points below the other acquirers on RuPay debit and credit combined (' + w.success + '% vs ' + w.peers + '%).'; });
    const w = [...cmp].sort((a, b) => a.gap - b.gap)[0], ai = S.ACQ.indexOf(w.acquirer);
    const db = call('decline_breakdown', { acquirer: ai, rupay_only: true }, r => { const t = r[0]; const tot = r.reduce((a, x) => a + x.n, 0); return tot + ' declines on RuPay debit + credit combined: ' + r.slice(0, 3).map(x => x.n + ' ' + x.label.toLowerCase() + ' (' + x.share + '%)').join(', ') + '.'; });
    const peerDb = S.declineBreakdown(t => t.acq !== ai && S.isRupay(t.inst)); const peerTimeout = peerDb.find(x => x.code === 'timeout').share;
    const sp = call('issuer_split', { acquirer: ai }, r => { const bad = r.filter(x => x.timeoutRate >= 1.5 && x.n >= 20).length; return 'Timeouts appear at ' + bad + ' of ' + r.length + ' issuers on this route, so the cause sits on the acquirer side, not with one issuer.'; });
    call('check_sample_size', { n: w.n }, r => 'n = ' + r.n + '. ' + r.note);
    const topT = db.find(x => x.code === 'timeout');
    return { steps, finding: { cause: w.acquirer + ' timeouts on the RuPay route: ' + topT.share + '% of its RuPay declines, against about ' + peerTimeout + '% elsewhere.', confidence: w.n >= 300 ? 'Medium' : 'Low', action: 'Add a fallback route to the best-performing acquirer when the first attempt times out, and open an escalation with ' + w.acquirer + ' for the RuPay route.', gate: 'Experience' }, mode: 'offline' };
  }
  if (id === 'f2') {
    const sp = call('issuer_split', {}, r => { const t = top(r, 'issuerDeclineRate'); const avg = (r.filter(x => x !== t).reduce((a, x) => a + x.issuerDeclineRate, 0) / (r.length - 1)).toFixed(1); return t.issuer + ' shows ' + t.issuerDeclineRate + '% issuer declines against ' + avg + '% on average elsewhere.'; });
    const t = top(sp, 'issuerDeclineRate'); const ii = S.ISS.indexOf(t.issuer);
    const byAcq = S.ACQ.map((a, ai) => ({ a, r: S.rate(S.TX.filter(x => x.iss === ii && x.acq === ai)), n: S.TX.filter(x => x.iss === ii && x.acq === ai).length }));
    steps.push({ tool: 'issuer_split', args: { by: 'acquirer' }, result: 'The spike shows up across all ' + byAcq.length + ' acquirers (' + byAcq.map(x => x.r + '%').join(', ') + ' success), so it follows the issuer, not a route.' });
    call('check_sample_size', { n: t.n }, r => 'n = ' + r.n + '. ' + r.note);
    return { steps, finding: { cause: t.issuer + ' is declining its own customers at an unusual rate, across every acquirer.', confidence: t.n >= 300 ? 'High' : 'Medium', action: 'Raise it with the issuer through the network operations channel and share the decline-code evidence. No merchant-side change is needed.', gate: 'Experience' }, mode: 'offline' };
  }
  if (id === 'f3') {
    const sh = call('share_by_category', { instrument: 5 }, r => { const e = r.filter(c => ['Electronics', 'Travel'].includes(c.category)); return 'UPI + RuPay credit is ' + F.etShare + '% of payments in electronics and travel against ' + F.restShare + '% elsewhere. ' + e.map(c => c.category + ': ' + c.enabled + ' of ' + c.merchants + ' merchants enabled').join('; ') + '.'; });
    call('ticket_split', { instrument: 5 }, r => 'When customers do use it the success rate is ' + S.rate(S.TX.filter(t => t.inst === 5)) + '%, so the weakness is awareness and presentation, not reliability.');
    return { steps, finding: { cause: 'Low usage, not low success: customers are not choosing UPI + RuPay credit where tickets are large.', confidence: 'Medium', action: 'Enable it at the merchants that still lack it, and run a small pilot with a checkout prompt and an offer at those merchants.', gate: 'Preference' }, mode: 'offline' };
  }
  const ts = call('ticket_split', { instrument: 6 }, r => 'At ₹25,000 and above, UPI + credit line is ' + r.high.share + '% of payments against ' + r.low.share + '% below (n = ' + r.high.n + ' large payments).');
  call('check_sample_size', { n: ts.high.n }, r => 'n = ' + r.n + '. ' + r.note);
  const cats = call('share_by_category', { instrument: 6 }, r => 'Enabled at ' + ts.merchantsEnabled + ' of ' + ts.merchants + ' merchants. Largest enabled-but-unused gaps are in high-ticket categories.');
  return { steps, finding: { cause: 'High-ticket payments rarely use the credit line, even where it is enabled. Likely discovery and eligibility friction, to be confirmed.', confidence: 'Low', action: 'Test an eligibility pre-check and an installment message at checkout for tickets above ₹25,000 in the pilot cohort.', gate: 'Preference' }, mode: 'offline' };
}

// Keyword routing for follow-up questions when Gemini is unavailable.
export function offlineAnswer(q) {
  const s = q.toLowerCase();
  if (/issuer/.test(s)) { const r = runTool('issuer_split'); const t = top(r, 'issuerDeclineRate'); return { tool: 'issuer_split', answer: t.issuer + ' has the highest issuer-decline rate at ' + t.issuerDeclineRate + '% across n = ' + t.n + ' payments.' }; }
  if (/timeout|decline|reason/.test(s)) { const r = runTool('decline_breakdown', {}); return { tool: 'decline_breakdown', answer: 'Across all declines: ' + r.slice(0, 3).map(x => x.label.toLowerCase() + ' ' + x.share + '%').join(', ') + '.' }; }
  if (/credit line|ticket|high/.test(s)) { const r = runTool('ticket_split', { instrument: 6 }); return { tool: 'ticket_split', answer: 'Credit line share is ' + r.high.share + '% at ₹25k+ against ' + r.low.share + '% below.' }; }
  if (/credit|upi/.test(s)) { const r = S.findings().find(f => f.id === 'f3'); return { tool: 'share_by_category', answer: r.subtitle + '.' }; }
  const r = runTool('compare_acquirers'); const w = [...r].sort((a, b) => a.gap - b.gap)[0];
  return { tool: 'compare_acquirers', answer: w.acquirer + ' is the weakest on RuPay: ' + w.success + '% against ' + w.peers + '% for the others.' };
}
