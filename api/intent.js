import { hget, hput, intentToken, status, baseUrl } from '../server/lib.js';
import { sendTelegram } from '../server/mail.js';
const MAP = { interested: ['interested', 'Interested. Moved to the enablement queue.', 'Thank you. We will be in touch to confirm the technical steps.'], more: ['wants_call', 'Asked for more information or a call.', 'Thank you. Someone from the acceptance team will reach out to you.'], later: ['not_now', 'Said not now.', 'No problem. We will not follow up unless you ask us to.'] };
const page = (title, msg) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#0A1020;color:#E9EEF8;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:420px;padding:32px;text-align:center"><div style="font-size:13px;color:#93A1BC;margin-bottom:8px">Acceptance Copilot</div><h1 style="font-size:26px;letter-spacing:-.02em;margin:0 0 12px">${title}</h1><p style="color:#93A1BC;line-height:1.6;margin:0">${msg}</p></div></body>`;
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  if (!status().server) return res.status(503).send(page('Not available', 'This link is not active right now.'));
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams); const m = MAP[q.v];
  if (!m || !q.p || q.t !== intentToken(String(q.p), String(q.v))) return res.status(400).send(page('Link not valid', 'This link is invalid or has expired.'));
  const p = await hget('proposals', String(q.p)); if (!p) return res.status(404).send(page('Not found', 'We could not find this proposal.'));
  if (!['interested', 'wants_call', 'not_now'].includes(p.status) || p.status !== m[0]) {
    p.status = m[0]; p.intentAt = new Date().toISOString(); p.events = [...(p.events || []), { ts: p.intentAt, who: 'Merchant (email link)', text: m[1] }]; await hput('proposals', p);
    await sendTelegram(`📬 ${p.id}: merchant response\n${m[1]}\n${baseUrl(req)}/#/proposals?id=${p.id}`);
  }
  return res.status(200).send(page('Response recorded', m[2]));
}
