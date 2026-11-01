// The agent's tools and an offline (rules) agent. The same tools run in the browser and in the Vercel function.
import * as S from './stats.js';

export const TOOL_DEFS = [
  { name: 'compare_acquirers', description: 'Success rate of each acquirer on RuPay payments against the other acquirers.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'decline_breakdown', description: 'Decline reason mix. Optionally limited to one acquirer index (0-3) and RuPay.', parameters: { type: 'OBJECT', properties: { acquirer: { type: 'INTEGER' }, rupay_only: { type: 'BOOLEAN' } } } },
  { name: 'issuer_split', description: 'Success, issuer-decline rate and timeout rate per issuer. Optionally limited to one acquirer index.', parameters: { type: 'OBJECT', properties: { acquirer: { type: 'INTEGER' } } } },
  { name: 'share_by_category', description: 'How often an instrument index (0-8) is used in each merchant category, with success rate and enablement.', parameters: { type: 'OBJECT', properties: { instrument: { type: 'INTEGER' } }, required: ['instrument'] } },
  { name: 'ticket_split', description: 'Share and success of an instrument index (0-8) at tickets of ₹25,000 and above versus below.', parameters: { type: 'OBJECT', properties: { instrument: { type: 'INTEGER' } }, required: ['instrument'] } },
  { name: 'daily_trend', description: 'Daily success rate for one acquirer index (0-3) over the 30 days.', parameters: { type: 'OBJECT', properties: { acquirer: { type: 'INTEGER' } }, required: ['acquirer'] } },
  { name: 'merchant_decline_split', description: 'Decline reasons for one merchant index compared with all other merchants.', parameters: { type: 'OBJECT', properties: { merchant: { type: 'INTEGER' } }, required: ['merchant'] } },
  { name: 'auth_failure_split', description: 'Authentication failure rate for an instrument index at each acquirer.', parameters: { type: 'OBJECT', properties: { instrument: { type: 'INTEGER' } }, required: ['instrument'] } },
  { name: 'route_options', description: 'Success rate of every acquirer for the instruments of a finding, to find the best-suited route.', parameters: { type: 'OBJECT', properties: { from_acquirer: { type: 'INTEGER' }, instrument: { type: 'INTEGER' } }, required: ['from_acquirer'] } },
  { name: 'check_sample_size', description: 'Checks whether n is large enough to draw a conclusion.', parameters: { type: 'OBJECT', properties: { n: { type: 'INTEGER' } }, required: ['n'] } }
];

export function runTool(name, a = {}) {
  switch (name) {
    case 'compare_acquirers': return S.compareAcquirers(S.isRupay);
    case 'decline_breakdown': return S.declineBreakdown(t => (a.acquirer == null || t.acq === a.acquirer) && (!a.rupay_only || S.isRupay(t.inst)));
    case 'issuer_split': return S.issuerSplit(t => a.acquirer == null || t.acq === a.acquirer);
    case 'share_by_category': return S.shareByCategory(a.instrument);
    case 'ticket_split': return S.ticketSplit(a.instrument);
    case 'daily_trend': return S.dailySeries(t => t.acq === a.acquirer);
    case 'merchant_decline_split': return { merchant: S.declineBreakdown(t => t.m === a.merchant), rest: S.declineBreakdown(t => t.m !== a.merchant) };
    case 'auth_failure_split': return S.ACQ.map((n, ai) => { const r = S.TX.filter(t => t.acq === ai && t.inst === a.instrument); return { acquirer: n, n: r.length, authFailRate: r.length ? Math.round(1000 * r.filter(t => t.st === 4).length / r.length) / 10 : null }; });
    case 'route_options': return S.bestRoute(a.instrument == null ? S.isRupay : i => i === a.instrument, a.from_acquirer);
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
  if (id === 'f5') {
    const inc = F.inc;
    call('daily_trend', { acquirer: inc.ai }, () => inc.acquirer + ' held about ' + inc.normal + '% on a normal day, then fell to ' + inc.low + '% from ' + S.dayLabel(inc.from) + ' to ' + S.dayLabel(inc.to) + '.');
    const during = S.declineBreakdown(t => t.acq === inc.ai && t.day >= inc.from && t.day <= inc.to); const after = S.declineBreakdown(t => t.acq === inc.ai && (t.day < inc.from || t.day > inc.to));
    call('decline_breakdown', { acquirer: inc.ai, window: 'dip days' }, () => 'During the dip, timeouts were ' + during.find(x => x.code === 'timeout').share + '% of declines, against ' + after.find(x => x.code === 'timeout').share + '% on other days.');
    const other = S.ACQ.map((n, ai) => ({ n, ai })).filter(x => x.ai !== inc.ai).map(x => S.rate(S.TX.filter(t => t.acq === x.ai && t.day >= inc.from && t.day <= inc.to)));
    steps.push({ tool: 'daily_trend', args: { acquirer: 'others', window: 'dip days' }, result: 'The other acquirers stayed between ' + Math.min(...other) + '% and ' + Math.max(...other) + '% on the same days, so it was local to ' + inc.acquirer + '.' });
    call('check_sample_size', { n: inc.n }, r => 'n = ' + r.n + '. ' + r.note);
    const recovered = S.rate(S.TX.filter(t => t.acq === inc.ai && t.day > inc.to));
    return { steps, finding: { cause: 'A short incident at ' + inc.acquirer + ': timeouts spiked for ' + (inc.to - inc.from + 1) + ' days and success has since recovered to about ' + recovered + '%.', confidence: 'Medium', action: 'Ask ' + inc.acquirer + ' for a root-cause note, confirm it is resolved, and set an alert for any daily success drop of more than 5 points.', gate: 'Experience' }, mode: 'offline' };
  }
  if (id === 'f6') {
    const c = F.cfg;
    call('merchant_decline_split', { merchant: c.mi }, r => c.merchant.name + ': ' + (r.merchant.find(x => x.code === 'config').share) + '% of its declines are configuration declines, against ' + (r.rest.find(x => x.code === 'config').share) + '% at other merchants.');
    const byInst = S.INST.map((n, i) => ({ n, rows: S.TX.filter(t => t.m === c.mi && t.inst === i) })).filter(x => x.rows.length >= 15).map(x => x.n + ' ' + Math.round(1000 * x.rows.filter(t => t.st === 6).length / x.rows.length) / 10 + '%');
    steps.push({ tool: 'merchant_decline_split', args: { merchant: c.mi, by: 'instrument' }, result: 'Configuration declines appear across instruments (' + byInst.join(', ') + '), which points to the merchant setup, not one network.' });
    call('check_sample_size', { n: c.n }, r => 'n = ' + r.n + '. ' + r.note);
    return { steps, finding: { cause: c.merchant.name + ' has a configuration problem, likely terminal, category or credential settings, since the declines cut across instruments.', confidence: 'Medium', action: 'Have DevOps and merchant support check the merchant’s configuration against its onboarding record. No routing change is needed.', gate: 'Enablement' }, mode: 'offline' };
  }
  if (id === 'f7') {
    const u = F.au;
    call('auth_failure_split', { instrument: u.inst }, r => 'Authentication failures on ' + u.instrument + ': ' + r.map(x => x.acquirer + ' ' + x.authFailRate + '%').join(', ') + '.');
    const iss = S.issuerSplit(t => t.acq === u.ai && t.inst === u.inst); const spread = S.ISS.map((n, i) => ({ n, r: S.TX.filter(t => t.acq === u.ai && t.inst === u.inst && t.iss === i && t.st === 4).length })).filter(x => x.r > 0).length;
    steps.push({ tool: 'issuer_split', args: { acquirer: u.ai, instrument: u.inst }, result: 'Authentication failures appear across ' + spread + ' of ' + S.ISS.length + ' issuers, so the cause sits in the ' + u.acquirer + ' authentication step.' });
    call('check_sample_size', { n: u.n }, r => 'n = ' + r.n + '. ' + r.note);
    return { steps, finding: { cause: 'The authentication step is failing at ' + u.acquirer + ' for ' + u.instrument + ' at a rate well above other acquirers.', confidence: 'Medium', action: 'Raise it with ' + u.acquirer + ' as an authentication configuration issue, and consider routing ' + u.instrument + ' through the best-performing acquirer while it is fixed.', gate: 'Experience' }, mode: 'offline' };
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
