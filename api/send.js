import { authed, hget, hput, hgetall, rateLimit, status, baseUrl, intentToken } from '../server/lib.js';
import { sendMail, sendTelegram, allowedTo } from '../server/mail.js';
import { proposalEmail, ticketEmail, briefEmail } from '../src/lib/email.js';
import { buildBrief } from '../src/lib/brief.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const st = status(); if (!st.server) return res.status(503).json({ error: 'server features are not configured' });
  const role = authed(req); if (!role) return res.status(401).json({ error: 'sign in again' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const to = (b.to || []).map(s => String(s).trim()).filter(Boolean); const channels = b.channels || { email: true };
  try {
    if (!(await rateLimit('send', 40, 3600))) return res.status(429).json({ error: 'Too many messages in the last hour' });
    const results = []; let mail = null; let tg = null; let ctxItem = null;
    if (b.kind === 'ticket') { const t = await hget('tickets', b.id); if (!t) return res.status(404).json({ error: 'ticket not found' }); ctxItem = t; mail = ticketEmail(t, baseUrl(req) + '/#/tickets?id=' + t.id); tg = `🎫 ${t.id} · ${t.kind} · ${t.priority}\n${t.title}\nRaised by ${t.requester}, assigned to ${t.assignee}\n\n${t.summary.slice(0, 500)}\n${baseUrl(req)}/#/tickets?id=${t.id}`; }
    else if (b.kind === 'proposal') {
      const p = await hget('proposals', b.id); if (!p) return res.status(404).json({ error: 'proposal not found' }); ctxItem = p; const base = baseUrl(req);
      const u = v => `${base}/api/intent?p=${encodeURIComponent(p.id)}&v=${v}&t=${intentToken(p.id, v)}`;
      mail = proposalEmail(p, { interested: u('interested'), more: u('more'), later: u('later') });
    }
    else if (b.kind === 'brief') { const br = buildBrief(await hgetall('tickets'), await hgetall('proposals')); mail = briefEmail(br); tg = '☀️ Acceptance Copilot morning brief\n\n' + br.text; }
    else return res.status(400).json({ error: 'unknown kind' });
    if (channels.email) {
      if (!to.length) results.push({ channel: 'email', status: 'failed', note: 'No recipient given' });
      else if (!allowedTo(to)) results.push({ channel: 'email', to: to.join(', '), status: 'blocked', note: 'Recipient is not on the allowed list. Add it to ALLOWED_RECIPIENTS in Vercel.' });
      else { const r = await sendMail({ to, ...mail }); results.push({ channel: 'email', to: to.join(', '), status: r.ok ? 'sent' : 'failed', note: r.error || '' }); }
    }
    if (channels.telegram && tg) { const r = await sendTelegram(tg); results.push({ channel: 'telegram', to: 'team chat', status: r.ok ? 'sent' : 'failed', note: r.error || '' }); }
    if (b.kind === 'proposal' && results.some(r => r.channel === 'email' && r.status === 'sent')) { ctxItem.status = 'sent'; ctxItem.sentAt = new Date().toISOString(); ctxItem.sentTo = to.join(', '); ctxItem.events = [...(ctxItem.events || []), { ts: ctxItem.sentAt, who: role.name, text: 'Proposal emailed to ' + ctxItem.sentTo }]; await hput('proposals', ctxItem); }
    return res.status(200).json({ results });
  } catch (e) { return res.status(500).json({ error: 'could not send' }); }
}
