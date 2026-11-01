// Voice call script for the merchant follow-up. It discloses that the caller is an AI assistant and makes no promises.
import * as S from './stats.js';
export function callScript(p) {
  const m = S.MERCH[p.merchantId]; const inst = S.INST[p.instruments[0]]; const pot = S.merchantPotential(p.merchantId);
  const first = `Hello, this is an AI assistant calling on behalf of the Acceptance team, about the proposal we emailed to ${m.name}. Do you have two minutes?`;
  const system = `You are a polite, brief voice assistant for a payments acceptance team in India. You are an AI and say so if asked. Purpose: follow up on a proposal to ${m.name} (${m.category}) about adding ${inst}. Key facts you may state: some customers are declined for insufficient balance and a credit line can complete some of those payments; the illustrative range is +${pot.lowPts.toFixed(2)} to +${pot.highPts.toFixed(2)} percentage points of payment success, based on an assumption, and it is not a forecast or a promise. There are no commercial terms in this proposal. Never quote prices, fees or MDR. Never pressure. Ask one question: would they like to explore a small trial. Outcomes: interested, wants more information, or not now. If they want more information, offer to send an email. End politely. Keep every reply under 25 words.`;
  return { first, system };
}
