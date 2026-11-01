import nodemailer from 'nodemailer';
import { env, status } from './lib.js';
// Only addresses on the allowed list can receive email. The merchants in this prototype are fictional.
export const allowedTo = list => { const e = env(); return list.every(a => e.allow.includes(String(a).trim().toLowerCase())); };
export async function sendMail({ to, subject, html, text }) {
  if (globalThis.__MAIL_CAPTURE) { globalThis.__MAIL_CAPTURE.push({ to, subject, html, text }); return { ok: true }; }
  const e = env(); if (!e.gmailUser || !e.gmailPass) return { ok: false, error: 'Email is not connected (add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel)' };
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: e.gmailUser, pass: e.gmailPass } });
  try { await t.sendMail({ from: `"Acceptance Copilot (demo)" <${e.gmailUser}>`, to: to.join(','), subject, html, text }); return { ok: true }; } catch (err) { return { ok: false, error: 'Gmail refused: ' + String(err.message || err).slice(0, 140) }; }
}
export async function sendTelegram(text) {
  if (globalThis.__TG_CAPTURE) { globalThis.__TG_CAPTURE.push(text); return { ok: true }; }
  const e = env(); if (!e.tgToken || !e.tgChat) return { ok: false, error: 'Telegram is not connected (add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel)' };
  try { const r = await fetch(`https://api.telegram.org/bot${e.tgToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: e.tgChat, text, disable_web_page_preview: true }) }); const j = await r.json(); return j.ok ? { ok: true } : { ok: false, error: 'Telegram: ' + (j.description || r.status) }; } catch (err) { return { ok: false, error: 'Telegram unreachable' }; }
}
