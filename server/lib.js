import crypto from 'node:crypto';
import { ROLES } from '../src/lib/roles.js';

export const env = () => ({
  secret: process.env.SESSION_SECRET || '',
  redisUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  redisToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  gmailUser: process.env.GMAIL_USER || '', gmailPass: process.env.GMAIL_APP_PASSWORD || '',
  allow: (process.env.ALLOWED_RECIPIENTS || process.env.GMAIL_USER || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  tgToken: process.env.TELEGRAM_BOT_TOKEN || '', tgChat: process.env.TELEGRAM_CHAT_ID || '', tgAllow: (process.env.ALLOWED_TELEGRAM_CHATS || process.env.TELEGRAM_CHAT_ID || '').split(',').map(x => x.trim()).filter(Boolean),
  demoPassword: process.env.DEMO_PASSWORD || 'demo-demo-demo', briefTo: process.env.BRIEF_EMAIL || process.env.GMAIL_USER || ''
});
export const status = () => { const e = env(); return { server: !!(e.secret && (e.redisUrl || globalThis.__REDIS_STUB)), storage: !!(e.redisUrl || globalThis.__REDIS_STUB), email: !!(e.gmailUser && e.gmailPass) || !!globalThis.__MAIL_CAPTURE, telegram: !!(e.tgToken && e.tgChat) || !!globalThis.__TG_CAPTURE }; };

const b64 = b => Buffer.from(b).toString('base64url');
export const hmac = (data) => crypto.createHmac('sha256', env().secret).update(data).digest('base64url');
export const signToken = (obj) => { const body = b64(JSON.stringify(obj)); return body + '.' + hmac(body); };
export function verifyToken(t) {
  if (!t || !env().secret) return null; const [body, sig] = t.split('.'); if (!body || !sig) return null;
  const good = hmac(body); if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
export const intentToken = (proposalId, v) => hmac('intent|' + proposalId + '|' + v);
export function authed(req, allowed) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, ''); const o = verifyToken(t);
  if (!o) return null; const role = ROLES.find(r => r.id === o.sub); if (!role) return null;
  if (allowed && !allowed.includes(role.id)) return null; return role;
}
export const baseUrl = req => { const h = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'; const p = req.headers['x-forwarded-proto'] || (String(h).startsWith('localhost') ? 'http' : 'https'); return p + '://' + h; };

export async function redis(cmd) {
  if (globalThis.__REDIS_STUB) return globalThis.__REDIS_STUB(cmd);
  const e = env(); if (!e.redisUrl) throw new Error('storage not configured');
  const r = await fetch(e.redisUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + e.redisToken, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
export const hgetall = async c => { const flat = (await redis(['HGETALL', 'coll:' + c])) || []; const out = []; for (let i = 0; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i + 1])); } catch {} } return out; };
export const hget = async (c, id) => { const v = await redis(['HGET', 'coll:' + c, id]); return v ? JSON.parse(v) : null; };
export const hput = (c, item) => redis(['HSET', 'coll:' + c, item.id, JSON.stringify(item)]);
export async function rateLimit(key, max, windowSec) {
  const k = 'rl:' + key + ':' + Math.floor(Date.now() / 1000 / windowSec); const n = await redis(['INCR', k]); if (n === 1) await redis(['EXPIRE', k, windowSec]); return n <= max;
}
