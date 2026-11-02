// The in-app assistant: answers about this platform, today's update and where to go. Data questions use the computed tools. Off-topic is declined.
import * as S from './stats.js';
import * as A from './analytics.js';
import { HELP, TABS } from './help.js';
import { inScope, OFF_TOPIC } from './guard.js';
import { dataAnswer, snapshot } from './qa.js';
import { slot, welcome } from './lang.js';

export function state(ctx) {
  const f = S.findings(); const decided = new Set((ctx.decisions || []).filter(d => ['approved', 'rejected'].includes(d.status)).map(d => d.id));
  const undecided = f.filter(x => !decided.has(x.id));
  const pend = (ctx.tickets || []).filter(t => t.status === 'Pending approval'); const open = (ctx.tickets || []).filter(t => !['Closed', 'Verified', 'Applied'].includes(t.status) && t.status !== 'Pending approval');
  const props = ctx.proposals || []; const sent = props.filter(p => p.status === 'sent'), interested = props.filter(p => p.status === 'interested'), calls = props.filter(p => p.status === 'wants_call');
  return { f, undecided, pend, open, sent, interested, calls, top: undecided[0] || f[0] };
}
export const greeting = (d = new Date()) => { const i = slot(d); return [['Good morning', 'सुप्रभात'], ['Good afternoon', 'नमस्कार'], ['Good evening', 'शुभ संध्या']][i]; };
export function welcomeLines(name, ctx, d = new Date(), lang = 'en') {
  const st = state(ctx); const w = welcome(lang, name, st, S.kpis().success, d); return { ...w, en: greeting(d)[0], hi: greeting(d)[1] };
}
export const screenOf = () => { const h = (typeof location !== 'undefined' ? location.hash : '') || ''; const [path, qs] = h.replace(/^#\/?/, '').split('?'); return { screen: path || 'insights', findingId: (qs || '').match(/id=([^&]+)/)?.[1] }; };
const L = (label, href) => ({ label, href: '#/' + href });
const NEXT = /(what (should|next|now)|what (do|can) i (do|need)|what to do|next step|now what|what('s| is) next|should i|how do i (proceed|move)|what.*(left|remaining)|am i (ready|done))/;
export function nextStep(ctx, role, scr) {
  const st = state(ctx); const sc = scr?.screen || 'insights';
  if (sc === 'explain') {
    const f = st.f.find(x => x.id === (scr.findingId || 'f1')) || st.f[0]; const d = (ctx.decisions || []).find(x => x.id === f.id)?.status; const tk = (ctx.tickets || []).filter(t => t.findingId === f.id);
    if (!d) return { text: role?.canApprove ? `For “${f.title}”: read the cause and the evidence, then decide. If you agree, press Approve (nothing changes until you do). If the sample looks small or the cause unclear, ask me a follow-up first, or Reject. After approving, the Actions panel lets you ${f.route ? 'request a routing change' : f.id === 'f3' || f.id === 'f4' ? 'create draft proposals for merchants' : 'raise an investigation ticket'}.` : `For “${f.title}”: review the evidence. Your role cannot approve, so ask the Acceptance PM to approve it; you can raise tickets once it is approved.` };
    if (d === 'rejected') return { text: `“${f.title}” is rejected and recorded. Press Reopen if new evidence arrives, or move to the next finding in the queue.` };
    const nxt = f.route ? `Request a routing change (${f.route.from} to ${f.route.to}). It goes to the Head for approval, since the requester cannot approve their own request.` : f.id === 'f3' || f.id === 'f4' ? 'Create draft proposals for the matching merchants in Actions, then open Proposals to preview and send them.' : 'Raise an investigation ticket for DevOps, or escalate to the partner if the cause sits with them.';
    return { text: `“${f.title}” is approved. Next: ${nxt}${tk.length ? ` ${tk.length} ticket${tk.length === 1 ? ' is' : 's are'} already raised for it.` : ''}`, links: [L('Open Tickets', 'tickets'), L('Open Proposals', 'proposals')] };
  }
  const by = { insights: ['Open the biggest signal under “What changed”, break it down in Explore, then check the Routing recommendation. Take the top leak to Diagnose.', [L('Diagnose', 'diagnose')]], diagnose: [`Pick the top leak${st.top ? ' (' + st.top.title + ')' : ''} and press “Investigate with the agent”. That opens Explain, where you can approve it.`, [L('Explain', 'explain')]], recommend: ['Choose a merchant with a coverage gap and create a proposal. Then open Proposals to preview and send it.', [L('Proposals', 'proposals')]], proposals: ['Open a draft, check the email preview, add the merchant’s email or Telegram, and send. A merchant’s one-click reply moves them to Enablement.', [L('Enablement', 'enable')]], enable: ['Open the merchant’s checklist and tick each step as it completes. When the coverage gate is met, start the pilot.', [L('Pilot', 'pilot')]], tickets: [st.pend.length ? `${st.pend.length} routing request${st.pend.length === 1 ? '' : 's'} await${st.pend.length === 1 ? 's' : ''} approval. ${role?.canApproveRouting ? 'Open one and approve it.' : 'Only the Head can approve; ask Meera.'}` : 'Open tickets that need action, and verify fixed ones to close them.', []], pilot: ['Check the coverage gate, run the pilot, then compare the result with the plan.', [L('Brief', 'brief')]], brief: ['Read or listen to the brief, then send it to your email or Telegram.', []] };
  const x = by[sc]; if (!x) return null; return { text: x[0], links: x[1] };
}
export function reply(q, ctx, role, scr) {
  const s = q.toLowerCase().trim(); const st = state(ctx);
  if (!inScope(q, scr)) return { text: OFF_TOPIC };
  if (/^(hi|hello|hey|namaste)\b/.test(s)) return { text: 'Hello! I can give you today’s update, tell you which tabs to visit, explain any screen, or answer questions about your acceptance data.', chips: true };
  if (/(credit (line )?on upi|upi (on|and|with) (rupay )?credit|credit line|rupay credit)/.test(s) && /(which|best|who|candidate|merchant|show|target|where|start|first|pilot)/.test(s)) { const c = S.topCreditCandidates(4); if (c.length) return { text: 'Best candidates for credit on UPI, by payments a credit line could complete: ' + c.map((x, i) => `${i + 1}. ${x.name} (${x.category}): ${x.insPct}% declined for insufficient balance on ${x.n} payments, ${x.verdict.toLowerCase()}`).join('; ') + '. Open Proposals: the fit check shows every parameter, then the draft email shows the impact range. It is an illustration with a stated assumption, not a forecast.', links: [L('Open Proposals', 'proposals'), L('Open Recommend', 'recommend')] }; }
  if (NEXT.test(s) && !/(today|plan my day|which tab)/.test(s)) { const n = nextStep(ctx, role, scr); if (n) return n; }
  if (/(today|update|pending|summary|status|what.*(need|waiting))/.test(s) && !/(rate|success|decline|latency|acquirer|issuer|rupay|upi|visa|wallet|reason|fail)/.test(s)) {
    const lines = [`${st.undecided.length} finding${st.undecided.length === 1 ? '' : 's'} waiting for a decision${st.top ? ', biggest: ' + st.top.title : ''}.`, `${st.pend.length} routing request${st.pend.length === 1 ? '' : 's'} awaiting approval, ${st.open.length} other ticket${st.open.length === 1 ? '' : 's'} open.`, `${st.sent.length} proposal${st.sent.length === 1 ? '' : 's'} awaiting a merchant reply, ${st.interested.length + st.calls.length} reply to follow up.`];
    return { text: lines.join('\n'), links: [L('Open the brief', 'brief'), L('Review findings', 'diagnose'), L('Tickets', 'tickets')] };
  }
  if (/ticket/.test(s) && /(how many|number|open|pending|list|which|show|status)/.test(s)) { const t = ctx.tickets || []; if (!t.length) return { text: 'There are no tickets yet. Raise one from an approved finding on Explain.', links: [L('Open Explain', 'explain')] }; const by = {}; t.forEach(x => { by[x.status] = (by[x.status] || 0) + 1; }); return { text: `${t.length} ticket${t.length === 1 ? '' : 's'}: ` + Object.entries(by).map(([k, v]) => v + ' ' + k.toLowerCase()).join(', ') + '.\n' + t.slice(0, 3).map(x => `${x.id} · ${x.kind} · ${x.title}`).join('\n'), links: [L('Open Tickets', 'tickets')] }; }
  if (/proposal/.test(s) && /(how many|number|open|pending|list|which|show|status)/.test(s)) { const p = ctx.proposals || []; if (!p.length) return { text: 'There are no proposals yet. Create one from Recommend or Proposals.', links: [L('Open Proposals', 'proposals')] }; const by = {}; p.forEach(x => { by[x.status] = (by[x.status] || 0) + 1; }); return { text: `${p.length} proposal${p.length === 1 ? '' : 's'}: ` + Object.entries(by).map(([k, v]) => v + ' ' + k.replace('_', ' ')).join(', ') + '.', links: [L('Open Proposals', 'proposals')] }; }
  if (/(which|what).*(tab|screen|page|visit|start|first)|where.*(start|go)|plan my day/.test(s)) {
    const plan = [['insights', 'Insights', `See what changed this week and where acceptance can grow.`]];
    if (st.undecided.length) plan.push(['diagnose', 'Diagnose', `${st.undecided.length} finding${st.undecided.length === 1 ? '' : 's'} to review. Start with: ${st.top.title}.`]);
    if (st.pend.length) plan.push(['tickets', 'Tickets', role?.canApproveRouting ? `Approve ${st.pend.length} routing request${st.pend.length === 1 ? '' : 's'}.` : `${st.pend.length} routing request${st.pend.length === 1 ? ' is' : 's are'} waiting for the Head to approve.`]);
    if (st.interested.length + st.calls.length) plan.push(['enable', 'Enablement', `${st.interested.length + st.calls.length} merchant${st.interested.length + st.calls.length === 1 ? '' : 's'} replied. Work their checklist or call them.`]);
    plan.push(['proposals', 'Proposals', 'Send offers for instruments merchants do not yet accept.'], ['brief', 'Brief', 'Hear today’s summary.']);
    return { text: 'Here is a good order for today:\n' + plan.map((p, i) => `${i + 1}. ${p[1]}: ${p[2]}`).join('\n'), links: plan.map(p => L(p[1], p[0])) };
  }
  const mod = [['routing', /routing|route|acquirer.*(move|switch)/], ['overview', /overview/], ['explore', /explore/], ['grow', /\bgrow|uplift|lever/], ['insights', /insight/], ['diagnose', /diagnos|heat ?map/], ['explain', /explain/], ['recommend', /recommend/], ['proposals', /proposal/], ['enable', /enabl/], ['tickets', /ticket/], ['pilot', /pilot/], ['brief', /brief/], ['account', /account|audit/]].find(([k, re]) => re.test(s) && /(what|why|how|explain|does|is|for)/.test(s) && /(what is|what does|what\'s|why|purpose|what.*for|how does|how do)/.test(s));
  if (mod) { const t = TABS.find(x => x[0] === (mod[0] === 'overview' || mod[0] === 'explore' || mod[0] === 'routing' || mod[0] === 'grow' ? 'insights' : mod[0])); return { text: HELP[mod[0]], links: t ? [L('Open ' + t[1], t[0])] : [] }; }
  if (/(what can you|help)/.test(s)) return { text: 'I can give today’s update, suggest which tabs to visit, explain any screen, and answer data questions such as “which issuer declines the most?” or “which acquirer is weakest on RuPay?”.', chips: true };
  const d = dataAnswer(q);
  if (d) return { text: d.answer, data: true, evidence: d.evidence || d.answer, links: [L('See it in Insights', 'insights')] };
  return { text: 'I could not map that to a figure. Try naming an acquirer, instrument, issuer or merchant, and a period, for example “decline reasons for Acquirer B today” or “which issuer declines the most?”.', fallback: true, chips: true };
}
// The full path: rules first for navigation and next steps, computed data next, and the AI model (when connected) to phrase it or to answer what the rules could not map.
const logMiss = (q, reason, screen) => { try { const k = 'ac_unanswered'; const a = JSON.parse(localStorage.getItem(k) || '[]'); a.unshift({ q, reason, screen, ts: new Date().toISOString() }); localStorage.setItem(k, JSON.stringify(a.slice(0, 30))); } catch (e) {} };
export async function askCopilot(q, ctx, role) {
  const scr = screenOf(); const r = reply(q, ctx, role, scr);
  if (r.text === OFF_TOPIC) logMiss(q, 'Declined by the scope guardrail (not about payment acceptance or this platform)', scr.screen);
  if (!r.data && !r.fallback) return r;
  try {
    const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, screen: scr.screen, findingId: scr.findingId, role: role?.name }), signal: AbortSignal.timeout(28000) });
    const j = res.ok ? await res.json() : null; if (j && j.mode === 'live' && j.answer) return { ...r, text: j.answer, live: true, chips: false };
  } catch (e) { /* offline: show the computed answer */ }
  if (r.fallback) logMiss(q, 'Could not be mapped to a figure, and the AI model was not available to answer it', scr.screen);
  return r;
}
export const SUGGESTIONS = ['Today’s update', 'Which tabs should I visit today?', 'What does Routing do?', 'Which acquirer is weakest?'];
