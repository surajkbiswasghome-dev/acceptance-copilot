// One data layer for tickets, proposals, decisions, audit and more.
// Server mode (shared, via /api/db and Redis) when the server is configured; otherwise this browser only.
import { useSyncExternalStore, useEffect } from 'react';
const EMPTY = Object.freeze([]);
const state = {}; const subs = new Set(); let timer = null; let pending = 0;
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
let mode = ls.get('ac_mode') || 'local'; let token = ls.get('ac_token') || '';
export const conn = { mode: () => mode, setServer: t => { mode = 'server'; token = t; ls.set('ac_mode', 'server'); ls.set('ac_token', t); }, setLocal: () => { mode = 'local'; token = ''; ls.set('ac_mode', 'local'); ls.del('ac_token'); }, token: () => token };
const emit = () => subs.forEach(f => f());
const lkey = n => 'ac_c_' + n;
const readLocal = n => { try { return Object.values(JSON.parse(ls.get(lkey(n)) || '{}')); } catch { return []; } };
const writeLocal = (n, arr) => ls.set(lkey(n), JSON.stringify(Object.fromEntries(arr.map(x => [x.id, x]))));
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token });
async function server(path, opts) { const r = await fetch(path, { ...opts, headers: headers() }); if (r.status === 401) { window.dispatchEvent(new Event('ac-unauth')); throw new Error('unauthorised'); } if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch (e) {} throw new Error(m || 'HTTP ' + r.status); } return r.json(); }
export async function load(n) {
  if (pending) return;
  try { state[n] = mode === 'server' ? (await server('/api/db?c=' + n)).items : readLocal(n); } catch { state[n] = state[n] || readLocal(n); }
  emit();
}
const poll = () => { if (mode === 'server' && subs.size) Object.keys(state).forEach(load); };
function subscribe(f) { subs.add(f); if (!timer) timer = setInterval(poll, 5000); return () => { subs.delete(f); if (!subs.size) { clearInterval(timer); timer = null; } }; }
export function useColl(n) {
  useEffect(() => { if (!(n in state)) load(n); }, [n]);
  return useSyncExternalStore(subscribe, () => state[n] || EMPTY);
}
export const getAll = n => state[n] || EMPTY;
export async function put(n, item) {
  const cur = state[n] || []; state[n] = cur.some(x => x.id === item.id) ? cur.map(x => (x.id === item.id ? item : x)) : [...cur, item]; emit();
  if (mode === 'server') { pending++; try { await server('/api/db', { method: 'POST', body: JSON.stringify({ c: n, op: 'put', item }) }); } catch { pending--; await load(n); return; } pending--; } else writeLocal(n, state[n]);
}
export async function del(n, id) {
  state[n] = (state[n] || []).filter(x => x.id !== id); emit();
  if (mode === 'server') { pending++; try { await server('/api/db', { method: 'POST', body: JSON.stringify({ c: n, op: 'del', id }) }); } catch {} pending--; } else writeLocal(n, state[n]);
}
export async function clearAll(names) {
  for (const n of names) { state[n] = []; if (mode === 'server') { try { await server('/api/db', { method: 'POST', body: JSON.stringify({ c: n, op: 'clear' }) }); } catch {} } else ls.del(lkey(n)); }
  emit();
}
export async function callApi(path, body) { return server(path, { method: 'POST', body: JSON.stringify(body) }); }
export const uid = p => p + '-' + Math.floor(1000 + Math.random() * 9000);
export const audit = (who, action, target, detail = '') => put('audit', { id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), who, action, target, detail });
export const COLLECTIONS = ['decisions', 'tickets', 'proposals', 'notifications', 'audit', 'pilot', 'checks'];
export const resetDemo = () => clearAll(COLLECTIONS);
