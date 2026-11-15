// Extended scope data: other networks, debit EMI, cardless EMI, pay later, synthetic BINs and issuer enablement.
// All of it is invented and additive. The RuPay view never reads the extended fields, and BINs here are fictional, not real ranges.
import { ISS } from './stats.js';
import { EMI_PRODUCTS } from './emi.js';

export const EXT_PRODUCTS = [
  { id: 'emi:xcard', code: 3, name: 'Visa or Mastercard credit card EMI (card rails)', short: 'Visa or Mastercard EMI, on card rails', stage: 'EMI conversion', ext: true, repay: 'Card bill, paid by any rail', ready: 1, tenures: null },
  { id: 'emi:debit', code: 4, name: 'Debit card EMI', short: 'Debit card EMI', stage: 'EMI conversion', ext: true, repay: 'Instalments debited from the bank account', ready: 0.9, tenures: [3, 6, 9, 12] },
  { id: 'emi:cardless', code: 5, name: 'Cardless EMI', short: 'Cardless EMI', stage: 'EMI conversion', ext: true, repay: 'Lender collects by mandate or UPI', ready: 0.8, tenures: [3, 6, 9, 12, 18] },
  { id: 'emi:bnpl', code: 6, name: 'Pay later (BNPL)', short: 'Pay later', stage: 'EMI conversion', ext: true, repay: 'Lender collects by mandate or UPI', ready: 0.8, tenures: [1, 2, 3] }
];
export const ALL_PRODUCTS = [...EMI_PRODUCTS, ...EXT_PRODUCTS];
export const PRODUCT = code => ALL_PRODUCTS[code];
export const EXT_RATES = { 'emi:xcard': 15, 'emi:debit': 16, 'emi:cardless': 18, 'emi:bnpl': 24 };

// Issuer enablement (illustrative): which synthetic issuers have switched on each RuPay product. Codes 0 to 2.
export const ISSUER_CAPS = ISS.map((name, i) => ({ name, i, upiEmi: ![8, 11].includes(i), line: ![9, 11].includes(i), card: i !== 10 }));
export const issuerSupports = (i, code) => { const c = ISSUER_CAPS[i]; if (!c) return true; return code === 0 ? c.upiEmi : code === 1 ? c.line : code === 2 ? c.card : true; };

// Fictional BINs: 6 digits starting 9. Not real ranges.
const NET = ['RuPay', 'Visa', 'Mastercard'];
export const BINS = [];
ISS.forEach((name, i) => {
  const k = String(i + 1).padStart(2, '0');
  BINS.push({ bin: '9' + k + '001', issuer: i, issuerName: name, network: 'RuPay', type: 'Credit', upiEmi: issuerSupports(i, 0) && i !== 4, cardEmi: issuerSupports(i, 2), line: issuerSupports(i, 1) });
  BINS.push({ bin: '9' + k + '101', issuer: i, issuerName: name, network: NET[1 + (i % 2)], type: 'Credit', upiEmi: false, cardEmi: i !== 7, line: false });
  BINS.push({ bin: '9' + k + '301', issuer: i, issuerName: name, network: NET[i % 3], type: 'Debit', upiEmi: false, cardEmi: i % 4 !== 3, line: false });
});
export const binInfo = b => BINS.find(x => x.bin === b);

const mul = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const r1k = x => Math.round(x / 1000) * 1000;
// Extra customer fields, derived deterministically from the existing synthetic row. Nothing here changes an existing field.
export function extFields(c, i) {
  const r = mul(7919 * (i + 13)); const cp = c.cohort; const iss = Math.floor(r() * ISS.length);
  const primary = BINS.find(b => b.issuer === iss && b.network === 'RuPay' && b.type === 'Credit');
  const pOther = Math.min(0.6, 0.08 + c.income / 220000); const hasOther = r() < pOther; const ob = BINS.find(b => b.issuer === (iss + 3) % ISS.length && b.type === 'Credit' && b.network !== 'RuPay');
  const pDeb = cp === 4 ? 0.7 : 0.45; const hasDebit = r() < pDeb; const db = BINS.find(b => b.issuer === (iss + 5) % ISS.length && b.type === 'Debit');
  const pCl = cp === 3 || cp === 4 ? 0.55 : 0.3; const hasCardless = r() < pCl; const pBn = cp === 0 ? 0.35 : 0.6; const hasBnpl = r() < pBn;
  return {
    issuer: iss, bin: primary.bin,
    xLimit: hasOther ? r1k(c.income * (2.5 + r() * 2.5)) : 0, xUtil: Math.round(15 + r() * 55), xBin: hasOther ? ob.bin : null, xNetwork: hasOther ? ob.network : null,
    debitLimit: hasDebit ? r1k(Math.max(5000, c.income * (0.6 + r() * 0.8))) : 0, debitUtil: 0, debitBin: hasDebit ? db.bin : null,
    clLimit: hasCardless ? r1k(Math.max(10000, c.income * (1 + r()))) : 0, clUtil: Math.round(r() * 45),
    bnplLimit: hasBnpl ? Math.min(30000, r1k(Math.max(5000, c.income * (0.3 + r() * 0.4)))) : 0, bnplUtil: Math.round(r() * 60)
  };
}
