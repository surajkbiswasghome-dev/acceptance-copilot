import { useColl } from './db.js';
import { DEFAULT_POLICY, POLICY_LABEL } from './afford.js';
// The policy in force: the last approved change, or the defaults. Changes need a second person (four-eyes).
export function useActivePolicy() {
  const docs = useColl('policy'); const a = docs.find(x => x.id === 'active');
  return a ? { ...DEFAULT_POLICY, ...a.policy, rates: { ...DEFAULT_POLICY.rates, ...(a.policy?.rates || {}) }, noCostMax: { ...DEFAULT_POLICY.noCostMax, ...(a.policy?.noCostMax || {}) } } : DEFAULT_POLICY;
}
export const policyChanges = (a, b) => { const out = []; if ((a.issuerAware !== false) !== (b.issuerAware !== false)) out.push('Issuer enablement check: ' + (a.issuerAware !== false ? 'on' : 'off') + ' to ' + (b.issuerAware !== false ? 'on' : 'off')); ['minTicket', 'maxFoir', 'minScore', 'stepUpBand', 'mandateBonus', 'feePct'].forEach(k => { if (a[k] !== b[k]) out.push(`${POLICY_LABEL[k] || k}: ${a[k]} to ${b[k]}`); }); Object.keys(b.rates).forEach(k => { if (a.rates[k] !== b.rates[k]) out.push(`rate ${k}: ${a.rates[k]}% to ${b.rates[k]}%`); }); Object.keys(b.noCostMax).forEach(k => { if (a.noCostMax[k] !== b.noCostMax[k]) out.push(`no-cost up to ${k}: ${a.noCostMax[k]} to ${b.noCostMax[k]} months`); }); return out; };
