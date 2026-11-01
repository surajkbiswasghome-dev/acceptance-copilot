import { status, signToken, env } from '../server/lib.js';
import { ROLES } from '../src/lib/roles.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const st = status(); if (!st.server) return res.status(200).json({ mode: 'local', status: st });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const r = ROLES.find(x => x.email === b.email);
  if (!r || b.password !== env().demoPassword) return res.status(401).json({ error: 'wrong email or password' });
  res.status(200).json({ mode: 'server', token: signToken({ sub: r.id, exp: Date.now() + 12 * 3600e3 }), status: st });
}
