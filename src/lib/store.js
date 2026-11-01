import { useSyncExternalStore } from 'react';
// Light per-browser settings only (theme, signed-in user). Shared business data lives in db.js.
const mem = {}; const subs = new Set(); const cache = {};
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } };
const write = (k, v) => { mem[k] = v; try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} subs.forEach(f => f()); };
export function useKey(k, d) {
  const snap = () => { const raw = JSON.stringify(read(k, d)); if (cache[k] !== raw) cache[k] = raw; return cache[k]; };
  const raw = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, snap);
  return [JSON.parse(raw), v => write(k, typeof v === 'function' ? v(read(k, d)) : v)];
}
export { ROLES } from './roles.js';
