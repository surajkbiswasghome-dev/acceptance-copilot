// Test-only server: serves dist and runs the /api handlers with in-memory stand-ins for Redis, Gmail and Telegram.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const PORT = Number(process.env.PORT || 4180); const STUB = process.env.STUB !== '0';
if (STUB) {
  process.env.SESSION_SECRET = 'test-secret'; process.env.ALLOWED_RECIPIENTS = 'me@test.example,dev@test.example';
  const H = {}; const C = {};
  globalThis.__REDIS_STUB = cmd => { const [op, key, a, b] = cmd; H[key] = H[key] || {};
    if (op === 'HGETALL') return Object.entries(H[key]).flat(); if (op === 'HGET') return H[key][a] ?? null; if (op === 'HSET') { H[key][a] = b; return 1; }
    if (op === 'HDEL') { delete H[key][a]; return 1; } if (op === 'DEL') { delete H[key]; return 1; } if (op === 'INCR') { C[key] = (C[key] || 0) + 1; return C[key]; } return 1; };
  globalThis.__MAIL_CAPTURE = []; globalThis.__TG_CAPTURE = [];
}
const dist = path.resolve('dist'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__debug') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ mails: globalThis.__MAIL_CAPTURE || [], tg: globalThis.__TG_CAPTURE || [] })); }
  if (u.pathname.startsWith('/api/')) {
    let body = ''; for await (const c of req) body += c;
    const r = { method: req.method, headers: req.headers, url: req.url, body: body || undefined, query: Object.fromEntries(u.searchParams) };
    const out = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return this; }, json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); }, send(t) { res.end(t); } };
    try { const mod = await import(pathToFileURL(path.resolve('api', u.pathname.slice(5) + '.js'))); await mod.default(r, out); } catch (e) { res.statusCode = 500; res.end('handler error ' + e.message); }
    return;
  }
  let f = path.join(dist, u.pathname === '/' ? 'index.html' : u.pathname); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log('dev server on', PORT, STUB ? '(stubs on)' : '(no stubs)'));
