import { authed, hgetall, hput, redis, status } from '../server/lib.js';
const W = { decisions: ['pm', 'head'], policy: ['pm', 'head'], tickets: ['pm', 'head', 'dev', 'en', 'aff'], proposals: ['pm', 'head', 'en'], notifications: ['pm', 'head', 'dev', 'en', 'aff'], audit: ['pm', 'head', 'dev', 'en', 'aff'], pilot: ['pm', 'head'], checks: ['pm', 'head', 'en'], settings: ['pm', 'head'] };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!status().server) return res.status(503).json({ error: 'server storage is not configured' });
  const role = authed(req); if (!role) return res.status(401).json({ error: 'sign in again' });
  try {
    if (req.method === 'GET') { const c = String(req.query?.c || new URL(req.url, 'http://x').searchParams.get('c')); if (!W[c]) return res.status(400).json({ error: 'unknown collection' }); return res.status(200).json({ items: await hgetall(c) }); }
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!W[b.c]) return res.status(400).json({ error: 'unknown collection' });
    if (!W[b.c].includes(role.id)) return res.status(403).json({ error: 'your role cannot change ' + b.c });
    if (b.op === 'put') { if (!b.item?.id || JSON.stringify(b.item).length > 30000) return res.status(400).json({ error: 'bad item' }); await hput(b.c, b.item); return res.status(200).json({ ok: true }); }
    if (b.op === 'del') { await redis(['HDEL', 'coll:' + b.c, String(b.id)]); return res.status(200).json({ ok: true }); }
    if (b.op === 'clear') { if (!['pm', 'head'].includes(role.id)) return res.status(403).json({ error: 'not allowed' }); await redis(['DEL', 'coll:' + b.c]); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: 'unknown operation' });
  } catch (e) { return res.status(500).json({ error: 'storage error' }); }
}
