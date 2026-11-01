import { useSyncExternalStore } from 'react';
const mem = {}; const subs = new Set();
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } };
const write = (k, v) => { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} subs.forEach(f => f()); };
const cache = {};
export function useKey(k, d) {
  const snap = () => { const raw = JSON.stringify(read(k, d)); if (cache[k] !== raw) cache[k] = raw; return cache[k]; };
  const raw = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, snap);
  return [JSON.parse(raw), v => write(k, typeof v === 'function' ? v(read(k, d)) : v)];
}
export const ROLES = [
  { id: 'pm', name: 'Priya, Acceptance PM', short: 'PA', sub: 'Approves actions, sees the audit log', email: 'priya@demo.example', canApprove: true },
  { id: 'en', name: 'Arjun, Merchant enablement', short: 'AM', sub: 'Runs checklists, drafts messages', email: 'arjun@demo.example', canApprove: false }
];
export function audit(who, action, target, detail = '') {
  write('ac_audit', [{ ts: new Date().toISOString(), who, action, target, detail }, ...read('ac_audit', [])].slice(0, 300));
}
export const resetDemo = () => { ['ac_audit', 'ac_dec', 'ac_pilot', 'ac_checks'].forEach(k => write(k, k === 'ac_pilot' ? { status: 'planned' } : k === 'ac_audit' ? [] : {})); };
