import { authed, hget, hput, hgetall, rateLimit, status, baseUrl, intentToken } from '../server/lib.js';
import { sendMail, sendTelegram, allowedTo, allowedChat } from '../server/mail.js';
import { proposalEmail, ticketEmail, briefEmail } from '../src/lib/email.js';
import * as S from '../src/lib/stats.js';
import { buildBrief } from '../src/lib/brief.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const st = status(); if (!st.server) return res.status(503).json({ error: 'server features are not configured' });
  const role = authed(req); if (!role) return res.status(401).json({ error: 'sign in again' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tgTo = String(b.tgTo || '').trim(); const to = (b.to || []).map(s => String(s).trim()).filter(Boolean); const channels = b.channels || { email: true };
  try {
    if (!(await rateLimit('send', 40, 3600))) return res.status(429).json({ error: 'Too many messages in the last hour' });
    const results = []; let mail = null; let tg = null; let ctxItem = null; let tgButtons = null;
    if (b.kind === 'ticket') { const t = await hget('tickets', b.id); if (!t) return res.status(404).json({ error: 'ticket not found' }); ctxItem = t; mail = ticketEmail(t, baseUrl(req) + '/#/tickets?id=' + t.id); tg = `🎫 ${t.id} · ${t.kind} · ${t.priority}\n${t.title}\nRaised by ${t.requester}, assigned to ${t.assignee}\n\n${t.summary.slice(0, 500)}\n${baseUrl(req)}/#/tickets?id=${t.id}`; }
    else if (b.kind === 'proposal') {
      const p = await hget('proposals', b.id); if (!p) return res.status(404).json({ error: 'proposal not found' }); ctxItem = p; const base = baseUrl(req);
      const u = v => `${base}/api/intent?p=${encodeURIComponent(p.id)}&v=${v}&t=${intentToken(p.id, v)}`;
      mail = proposalEmail(p, { interested: u('interested'), more: u('more'), later: u('later') });
      const i0 = p.instruments[0]; const credit = i0 === 5 || i0 === 6; const pot = credit ? S.merchantPotential(p.merchantId) : null; const mn = S.MERCH[p.merchantId];
      if (credit) { tg = `${mn.name}: a way to complete more of your payments (${S.instName(p.instruments[0])})\n\nIllustrative potential: +${pot.lowPts.toFixed(2)} to +${pot.highPts.toFixed(2)} percentage points on payment success (${pot.per1000[0]} to ${pot.per1000[1]} more completed payments per 1,000 attempts), assuming a share of insufficient-balance declines complete via a credit line. Not a forecast. Demo merchant, synthetic payment data; UPI market figures are NPCI data, Sept 2026.\n\nNo commercial terms. Nothing is switched on until you reply.`; tgButtons = [['Yes, I would like to explore this', u('interested')], ['Tell me more', u('more')], ['Not now', u('later')]]; } else tg = `${mn.name}: a proposal to add ${S.instName(i0)}\n\nNo gain has been estimated; a short trial would measure it. Demo merchant, synthetic data.\n\nNo commercial terms. Nothing is switched on until you reply.`; 
    }
    else if (b.kind === 'brief') { const br = buildBrief(await hgetall('tickets'), await hgetall('proposals')); mail = briefEmail(br); tg = '☀️ Acceptance Copilot morning brief\n\n' + br.text; }
    else return res.status(400).json({ error: 'unknown kind' });
    if (channels.email) {
      if (!to.length) results.push({ channel: 'email', status: 'failed', note: 'No recipient given' });
      else if (!allowedTo(to)) results.push({ channel: 'email', to: to.join(', '), status: 'blocked', note: 'Recipient is not on the allowed list. Add it to ALLOWED_RECIPIENTS in Vercel.' });
      else { const r = await sendMail({ to, ...mail }); results.push({ channel: 'email', to: to.join(', '), status: r.ok ? 'sent' : 'failed', note: r.error || (r.rejected && r.rejected.length ? 'Gmail handed over ' + r.accepted.join(', ') + ' but REJECTED ' + r.rejected.join(', ') + '. Check the spelling of that address.' : 'Handed to Gmail for ' + r.accepted.join(', ') + '. If it does not arrive, open the Sent folder and look for a bounce message in the inbox of ' + (process.env.GMAIL_USER || 'the sending account') + '.') }); }
    }
    if (channels.telegram && tg) {
      if (tgTo && !allowedChat(tgTo)) results.push({ channel: 'telegram', to: tgTo, status: 'blocked', note: 'This chat is not on the allowed list. Add it to ALLOWED_TELEGRAM_CHATS in Vercel.' });
      else { const r = await sendTelegram(tg, tgTo || undefined, tgButtons || undefined); results.push({ channel: 'telegram', to: tgTo || 'team chat', status: r.ok ? 'sent' : 'failed', note: r.error || '' }); }
    }
    if (b.kind === 'proposal' && results.some(r => r.status === 'sent')) { const via = results.filter(r => r.status === 'sent'); ctxItem.status = 'sent'; ctxItem.sentAt = new Date().toISOString(); ctxItem.sentTo = via.map(r => r.to).join(', '); ctxItem.events = [...(ctxItem.events || []), { ts: ctxItem.sentAt, who: role.name, text: 'Proposal sent via ' + via.map(r => r.channel + ' to ' + r.to).join('; ') }]; await hput('proposals', ctxItem); }
    return res.status(200).json({ results });
  } catch (e) { return res.status(500).json({ error: 'could not send' }); }
}
