// The in-app assistant: answers about this platform, today's update and where to go. Data questions use the computed tools. Off-topic is declined.
import * as S from './stats.js';
import * as A from './analytics.js';
import { HELP, TABS } from './help.js';
import { inScope, OFF_TOPIC } from './guard.js';
import { offlineAnswer } from './agent.js';

export function state(ctx) {
  const f = S.findings(); const decided = new Set((ctx.decisions || []).filter(d => ['approved', 'rejected'].includes(d.status)).map(d => d.id));
  const undecided = f.filter(x => !decided.has(x.id));
  const pend = (ctx.tickets || []).filter(t => t.status === 'Pending approval'); const open = (ctx.tickets || []).filter(t => !['Closed', 'Verified', 'Applied'].includes(t.status) && t.status !== 'Pending approval');
  const props = ctx.proposals || []; const sent = props.filter(p => p.status === 'sent'), interested = props.filter(p => p.status === 'interested'), calls = props.filter(p => p.status === 'wants_call');
  return { f, undecided, pend, open, sent, interested, calls, top: undecided[0] || f[0] };
}
export const greeting = (d = new Date()) => { const h = d.getHours(); return h < 12 ? ['Good morning', 'सुप्रभात'] : h < 17 ? ['Good afternoon', 'नमस्कार'] : ['Good evening', 'शुभ संध्या']; };
export function welcomeLines(name, ctx, d = new Date()) {
  const st = state(ctx); const [en, hi] = greeting(d); const bits = [];
  if (st.undecided.length) bits.push(`${st.undecided.length} finding${st.undecided.length === 1 ? '' : 's'} to decide`);
  if (st.pend.length) bits.push(`${st.pend.length} routing request${st.pend.length === 1 ? '' : 's'} awaiting approval`);
  if (st.interested.length + st.calls.length) bits.push(`${st.interested.length + st.calls.length} merchant repl${st.interested.length + st.calls.length === 1 ? 'y' : 'ies'} to follow up`);
  const l1 = `Welcome ${name} to Acceptance Copilot. ${hi}! ${en}.`;
  const l2 = (bits.length ? `You have ${bits.join(', ')}. ` : 'Nothing is waiting on you right now. ') + (st.top ? `Biggest leak: ${st.top.title}. ` : '') + 'How may I help you?';
  return { l1, l2, en, hi, parts: [{ text: `Welcome ${name}, to Acceptance Copilot.`, lang: 'en-IN' }, { text: hi + '!', lang: 'hi-IN' }, { text: `${en}. ${l2}`, lang: 'en-IN' }] };
}
const L = (label, href) => ({ label, href: '#/' + href });
export function reply(q, ctx, role) {
  const s = q.toLowerCase().trim(); const st = state(ctx);
  if (!inScope(q)) return { text: OFF_TOPIC };
  if (/^(hi|hello|hey|namaste)\b/.test(s)) return { text: 'Hello! I can give you today’s update, tell you which tabs to visit, explain any screen, or answer questions about your acceptance data.', chips: true };
  if (/(today|update|pending|summary|status|what.*(need|waiting))/.test(s)) {
    const lines = [`${st.undecided.length} finding${st.undecided.length === 1 ? '' : 's'} waiting for a decision${st.top ? ', biggest: ' + st.top.title : ''}.`, `${st.pend.length} routing request${st.pend.length === 1 ? '' : 's'} awaiting approval, ${st.open.length} other ticket${st.open.length === 1 ? '' : 's'} open.`, `${st.sent.length} proposal${st.sent.length === 1 ? '' : 's'} awaiting a merchant reply, ${st.interested.length + st.calls.length} reply to follow up.`];
    return { text: lines.join('\n'), links: [L('Open the brief', 'brief'), L('Review findings', 'diagnose'), L('Tickets', 'tickets')] };
  }
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
  const a = offlineAnswer(q); return { text: a.answer, links: a.tool === 'guardrail' ? [] : [L('See it in Insights', 'insights')] };
}
export const SUGGESTIONS = ['Today’s update', 'Which tabs should I visit today?', 'What does Routing do?', 'Which acquirer is weakest?'];
