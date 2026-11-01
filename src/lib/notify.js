import { put, callApi, conn, uid } from './db.js';
// Sends through the server when it is connected; otherwise records a clearly labelled preview.
export async function notify({ kind, id, to = [], channels, refId, tgTo = '' }) {
  const entries = [];
  if (conn.mode() === 'server') {
    try { const r = await callApi('/api/send', { kind, id, to, channels, tgTo }); entries.push(...r.results); } catch (e) { entries.push({ channel: channels.email ? 'email' : 'telegram', status: 'failed', note: 'The server could not send this' }); }
  } else {
    if (channels.email) entries.push({ channel: 'email', to: to.join(', ') || '(no recipient)', status: 'preview', note: 'Not actually sent. Email is not connected in this workspace.' });
    if (channels.telegram) entries.push({ channel: 'telegram', to: tgTo || 'team chat', status: 'preview', note: 'Not actually sent. Telegram is not connected in this workspace.' });
  }
  for (const e of entries) await put('notifications', { id: uid('NTF') + Math.random().toString(36).slice(2, 5), ts: new Date().toISOString(), refId, kind, ...e });
  return entries;
}
export const statusPill = s => ({ sent: 'ok', preview: 'warn', blocked: 'bad', failed: 'bad' }[s] || '');
export const statusText = s => ({ sent: 'Sent', preview: 'Preview only', blocked: 'Blocked', failed: 'Failed' }[s] || s);
