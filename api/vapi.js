import { hget, hput, status, baseUrl } from '../server/lib.js';
import { sendTelegram } from '../server/mail.js';
// Vapi posts an end-of-call report here. We record the summary and, if the call clearly ended with an outcome, update the proposal.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!status().server) return res.status(503).end();
  const secret = process.env.VAPI_WEBHOOK_SECRET || '';
  if (secret && req.headers['x-vapi-secret'] !== secret) return res.status(401).end();
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const m = b.message || b; if (m.type !== 'end-of-call-report') return res.status(200).json({ ok: true });
  const id = m.call?.assistantOverrides?.metadata?.proposalId || m.call?.metadata?.proposalId; const p = id && await hget('proposals', String(id));
  if (!p) return res.status(200).json({ ok: true });
  const summary = String(m.analysis?.summary || m.summary || 'Call ended.').slice(0, 400); const text = (summary + ' ' + (m.transcript || '')).toLowerCase();
  const said = /not interested|not now|no thanks|call later|busy/.test(text) ? 'not_now' : /send.*(email|mail)|more (info|detail)/.test(text) ? 'wants_call' : /interested|yes.*(trial|explore)|sounds good|go ahead/.test(text) ? 'interested' : null;
  p.events = [...(p.events || []), { ts: new Date().toISOString(), who: 'Voice agent', text: 'Call ended. ' + summary + (said ? ' Outcome read as: ' + said.replace('_', ' ') + ' (please verify).' : ' No clear outcome.') }];
  if (said && ['sent', 'wants_call'].includes(p.status)) { p.status = said; p.intentAt = new Date().toISOString(); }
  await hput('proposals', p); await sendTelegram(`📞 ${p.id}: voice call finished\n${summary}\n${baseUrl(req)}/#/proposals?id=${p.id}`);
  return res.status(200).json({ ok: true });
}
