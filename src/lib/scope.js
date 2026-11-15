// Network scope. Default is RuPay only (the NPCI view). Extended scope adds other networks, debit, cardless, pay later, BIN logic and lender routing.
// Everything extended is additive: nothing in the RuPay view reads these switches or fields.
import { useEffect, useState } from 'react';
const KEY = 'ac_scope';
export const getScope = () => { try { return localStorage.getItem(KEY) === 'all' ? 'all' : 'rupay'; } catch { return 'rupay'; } };
export const setScope = v => { try { localStorage.setItem(KEY, v === 'all' ? 'all' : 'rupay'); } catch {} dispatchEvent(new Event('ac-scope')); };
export function useScope() { const [s, set] = useState(getScope); useEffect(() => { const f = () => set(getScope()); addEventListener('ac-scope', f); addEventListener('storage', f); return () => { removeEventListener('ac-scope', f); removeEventListener('storage', f); }; }, []); return s; }
export const useExtended = () => useScope() === 'all';
