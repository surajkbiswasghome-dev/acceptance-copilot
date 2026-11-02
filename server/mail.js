import nodemailer from 'nodemailer';
import { env, status } from './lib.js';
// Only addresses on the allowed list can receive email. The merchants in this prototype are fictional.
export const allowedTo = list => { const e = env(); return list.every(a => e.allow.includes(String(a).trim().toLowerCase())); };
export async function sendMail({ to, subject, html, text }) {
  if (globalThis.__MAIL_CAPTURE) { globalThis.__MAIL_CAPTURE.push({ to, subject, html, text }); return { ok: true, accepted: to, rejected: [] }; }
  const e = env(); if (!e.gmailUser || !e.gmailPass) return { ok: false, error: 'Email is not connected (add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel)' };
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: e.gmailUser, pass: e.gmailPass } });
  try {
    const info = await t.sendMail({ from: `"Acceptance Copilot (demo)" <${e.gmailUser}>`, to: to.join(','), subject, html, text });
    const acc = (info.accepted || []).map(String), rej = (info.rejected || []).map(String);
    // Gmail accepting the message is not the same as delivery, but a rejected address is a clear failure we can report.
    if (!acc.length) return { ok: false, error: 'Gmail accepted none of the addresses' + (rej.length ? ': ' + rej.join(', ') : '') };
    return { ok: true, accepted: acc, rejected: rej, id: String(info.messageId || ''), response: String(info.response || '').slice(0, 80) };
  } catch (err) { return { ok: false, error: 'Gmail refused: ' + String(err.message || err).slice(0, 140) }; }
}
export const allowedChat = id => { const e = env(); return e.tgAllow.includes(String(id).trim()); };
export async function sendTelegram(text, chatId, buttons) {
  if (globalThis.__TG_CAPTURE) { globalThis.__TG_CAPTURE.push(text + (chatId ? ' [to ' + chatId + ']' : '') + (buttons ? ' [buttons ' + buttons.map(b => b[0]).join('|') + ']' : '')); return { ok: true }; }
  const e = env(); const chat = chatId || e.tgChat;
  if (!e.tgToken || !chat) return { ok: false, error: 'Telegram is not connected (add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel)' };
  try {
    const body = { chat_id: chat, text, disable_web_page_preview: true };
    if (buttons) body.reply_markup = { inline_keyboard: buttons.map(b => [{ text: b[0], url: b[1] }]) };
    const r = await fetch(`https://api.telegram.org/bot${e.tgToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); return j.ok ? { ok: true } : { ok: false, error: j.description || ('Telegram answered ' + r.status) };
  } catch (err) { return { ok: false, error: 'Could not reach Telegram' }; }
}
