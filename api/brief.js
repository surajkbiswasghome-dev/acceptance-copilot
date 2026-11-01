import { authed, hgetall, status, env } from '../server/lib.js';
import { sendMail, sendTelegram } from '../server/mail.js';
import { briefEmail } from '../src/lib/email.js';
import { buildBrief } from '../src/lib/brief.js';
// Called daily by Vercel Cron (set CRON_SECRET), or by a signed-in user.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!status().server) return res.status(503).json({ error: 'server features are not configured' });
  const cron = process.env.CRON_SECRET && req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET;
  if (!cron && !authed(req)) return res.status(401).json({ error: 'not allowed' });
  const br = buildBrief(await hgetall('tickets'), await hgetall('proposals')); const e = env(); const out = [];
  if (e.briefTo && (await sendMail({ to: [e.briefTo], ...briefEmail(br) })).ok) out.push('email');
  if ((await sendTelegram('☀️ Acceptance Copilot morning brief\n\n' + br.text)).ok) out.push('telegram');
  return res.status(200).json({ sent: out });
}
