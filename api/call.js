import { authed, hget, hput, rateLimit, status, baseUrl } from '../server/lib.js';
import { callScript } from '../src/lib/voice.js';
const env = () => ({ key: process.env.VAPI_API_KEY || '', phoneId: process.env.VAPI_PHONE_NUMBER_ID || '', assistant: process.env.VAPI_ASSISTANT_ID || '', allow: (process.env.ALLOWED_CALL_NUMBERS || '').split(',').map(x => x.trim().replace(/\s/g, '')).filter(Boolean) });
const E164 = /^\+[1-9]\d{7,14}$/;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const st = status(); if (!st.server) return res.status(503).json({ error: 'server features are not configured' });
  const role = authed(req); if (!role) return res.status(401).json({ error: 'sign in again' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const number = String(b.number || '').replace(/[\s-]/g, ''); const e = env();
  const p = await hget('proposals', String(b.id || '')); if (!p) return res.status(404).json({ error: 'proposal not found' });
  const script = callScript(p);
  if (!E164.test(number)) return res.json({ result: { channel: 'call', to: number, status: 'failed', note: 'Use the international format, for example +919876543210.' } });
  if (!e.key || !e.phoneId || !e.assistant) return res.json({ result: { channel: 'call', to: number, status: 'preview', note: 'Voice calling is not connected (add the VAPI variables in Vercel). This is the script it would use.', script: script.first } });
  if (!e.allow.includes(number)) return res.json({ result: { channel: 'call', to: number, status: 'blocked', note: 'This number is not on the allowed list. Add it to ALLOWED_CALL_NUMBERS in Vercel.' } });
  if (!(await rateLimit('call', 6, 3600))) return res.status(429).json({ error: 'Too many calls in the last hour' });
  try {
    const r = await fetch('https://api.vapi.ai/call', { method: 'POST', headers: { Authorization: 'Bearer ' + e.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantId: e.assistant, phoneNumberId: e.phoneId, customer: { number },
      assistantOverrides: { firstMessage: script.first, model: { provider: 'google', model: 'gemini-2.0-flash', messages: [{ role: 'system', content: script.system }] }, metadata: { proposalId: p.id }, serverUrl: baseUrl(req) + '/api/vapi', serverMessages: ['end-of-call-report'] } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.json({ result: { channel: 'call', to: number, status: 'failed', note: (j.message && String(j.message).slice(0, 160)) || ('Vapi answered ' + r.status) } });
    p.events = [...(p.events || []), { ts: new Date().toISOString(), who: role.name, text: 'Voice call started to ' + number }]; await hput('proposals', p);
    return res.json({ result: { channel: 'call', to: number, status: 'sent', note: 'Calling now. The outcome is recorded here when the call ends.' } });
  } catch (err) { return res.json({ result: { channel: 'call', to: number, status: 'failed', note: 'Could not reach the voice service' } }); }
}
