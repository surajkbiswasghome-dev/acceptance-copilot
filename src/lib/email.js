// Email templates. The same functions render the in-app preview and the email that is actually sent.
import * as S from './stats.js';
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = v => '₹' + Math.round(v).toLocaleString('en-IN');
const NAVY = '#0A1020', ACC = '#2F5BEA', INK = '#14213D', MUTE = '#566075', LINE = '#E3E5EC';
const wrap = (inner, preheader = '') => `<div style="background:#F3F4F8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:${INK}"><span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span><table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid ${LINE}" cellspacing="0" cellpadding="0">${inner}</table></div>`;
const head = sub => `<tr><td style="background:${NAVY};padding:18px 28px;color:#fff"><b style="font-size:16px;letter-spacing:-.01em">Acceptance Copilot</b><div style="font-size:12px;color:#9FB0D0;margin-top:2px">${esc(sub)}</div></td></tr>`;
const btn = (href, label, primary) => `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;${primary ? `background:${ACC};color:#fff;` : `background:#fff;color:${INK};border:1px solid ${LINE};`}">${esc(label)}</a>`;
const bar = (label, value, max, color) => `<tr><td style="padding:3px 0;font-size:12px;color:${MUTE};width:46%">${esc(label)}</td><td style="padding:3px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="background:${color};height:12px;border-radius:6px;width:${Math.max(4, Math.round((100 * value) / max))}%"></td><td style="font-size:12px;font-weight:700;padding-left:8px;white-space:nowrap">${value}%</td><td style="width:${Math.max(0, 100 - Math.round((100 * value) / max))}%"></td></tr></table></td></tr>`;
const tile = (big, small) => `<td style="width:33%;vertical-align:top;padding:4px"><div style="background:#F3F5FC;border:1px solid ${LINE};border-radius:12px;padding:14px 12px"><div style="font-size:24px;font-weight:700;letter-spacing:-.02em;color:${ACC}">${esc(big)}</div><div style="font-size:12px;color:${MUTE};margin-top:4px;line-height:1.4">${esc(small)}</div></div></td>`;

// Verified market figures. Each carries its date and source so the reader can check it.
export const MARKET = {
  upi: { vol: '24.07 bn', val: '₹29.4 lakh cr', yoy: '+23%', daily: '802 mn', when: 'September 2026', src: 'NPCI monthly UPI statistics, as reported by StartupTalky, 2 Oct 2026' },
  ru: { txn: '362.8 mn', val: '₹33,439 crore', avg: '₹922', when: 'FY24', src: 'RuPay credit cards on UPI, FY24 (Business Standard, via Gokiwi). Average ticket is derived: value ÷ transactions' },
};
const r1 = v => Math.round(v * 10) / 10;
const sec = t => `<div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTE};margin:0 0 10px">${esc(t)}</div>`;
const seg = (pct, color, label) => `<td style="width:${Math.max(pct, 0.8)}%;background:${color};height:14px;font-size:0;line-height:0" title="${esc(label)}">&nbsp;</td>`;
const stat = (big, small, note) => `<td style="width:33%;vertical-align:top;padding:0 8px 0 0"><div style="font-size:26px;font-weight:700;letter-spacing:-.03em;color:${INK}">${esc(big)}</div><div style="font-size:12px;line-height:1.45;color:${MUTE};margin-top:3px">${esc(small)}</div>${note ? `<div style="font-size:10.5px;color:#8A93A6;margin-top:3px">${esc(note)}</div>` : ''}</td>`;

export function proposalEmail(p, urls) {
  const m = S.MERCH[p.merchantId]; const inst = p.instruments[0]; const name = S.INST[inst]; const b = S.peerBenchmark(p.merchantId, inst); const pot = S.merchantPotential(p.merchantId);
  const u = urls || { interested: '#interested', more: '#more', later: '#later' };
  const subject = `${m.name}: a way to complete more of your payments (${name}) [${p.id}]`;
  const mk = MARKET;
  const range = `+${pot.lowPts.toFixed(2)} to +${pot.highPts.toFixed(2)}`;
  const html = wrap(`${head('Merchant growth proposal · ' + p.id)}
  <tr><td style="padding:30px 28px 6px"><div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${ACC}">Prepared for ${esc(m.name)} · ${esc(m.category)}</div>
  <div style="font-size:24px;font-weight:700;letter-spacing:-.025em;line-height:1.2;margin-top:8px">Some customers want to pay but are declined for lack of balance. A credit line can complete those payments.</div>
  <p style="font-size:14px;line-height:1.6;color:${MUTE};margin:12px 0 0">We compared your recent payments with how ${esc(name)} performs across the network, and estimated the range of what it could add. It is a range with a stated assumption, not a promise.</p></td></tr>

  <tr><td style="padding:18px 28px 6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${NAVY};border-radius:14px"><tr><td style="padding:22px 24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9FB0D0">Potential gain in your payment success rate</div>
    <div style="font-size:38px;font-weight:700;letter-spacing:-.03em;color:#fff;margin-top:6px">${range} <span style="font-size:16px;font-weight:600;color:#9FB0D0">percentage points</span></div>
    <div style="font-size:13px;line-height:1.55;color:#C9D4EC;margin-top:8px">About ${pot.per1000[0]} to ${pot.per1000[1]} more completed payments in every 1,000 attempts, worth roughly ${money(pot.valuePer1000[0])} to ${money(pot.valuePer1000[1])} in sales per 1,000 attempts, at your average ticket of ${money(pot.avgTicket)}.</div>
  </td></tr></table></td></tr>

  <tr><td style="padding:22px 28px 4px">${sec('Your payments today')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:7px;overflow:hidden"><tr>${seg(pot.okPct, '#1F9D6B', 'Successful')}${seg(Math.max(100 - pot.okPct, 1), '#E3A008', 'Not successful')}</tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px"><tr>${stat(pot.okPct + '%', 'of your payments succeed', '')}${stat(r1(100 - pot.okPct) + '%', 'of your payments do not complete', 'Across all causes')}${stat(pot.insPct + '%', 'declined for insufficient balance (' + pot.basis + ')', 'The part a credit line can address')}</tr></table></td></tr>

  <tr><td style="padding:22px 28px 4px">${sec('The market, in numbers')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${stat(mk.upi.vol, 'UPI payments in ' + mk.upi.when, mk.upi.yoy + ' on a year earlier')}${stat(mk.upi.val, 'moved over UPI in ' + mk.upi.when, mk.upi.daily + ' payments a day')}${stat(mk.ru.txn, 'RuPay credit card payments on UPI in ' + mk.ru.when, mk.ru.val + ' in value')}</tr></table>
    <div style="font-size:13px;line-height:1.6;margin-top:12px;color:${INK}">Customers already pay by credit on UPI at scale. ${b.peers} of ${b.sameCategory} ${esc(m.category.toLowerCase())} merchants in our sample already accept ${esc(name)}, and it succeeds ${b.networkSuccess}% of the time across the network in that sample.</div></td></tr>

  <tr><td style="padding:18px 28px 4px">${sec('How the range is worked out')}
    <div style="font-size:12.5px;line-height:1.65;color:${MUTE};border-left:3px solid ${LINE};padding-left:12px">${pot.insPct}% of payments (${pot.basis}) are declined for insufficient balance. We assume ${Math.round(S.POTENTIAL_ASSUMPTION.low * 100)}% to ${Math.round(S.POTENTIAL_ASSUMPTION.high * 100)}% of those could complete through a credit line. That gives the range above. A short trial would replace this assumption with your own measured result.</div></td></tr>

  <tr><td style="padding:22px 28px 6px">${sec('Next step')}<div style="font-size:14px;line-height:1.6;margin-bottom:12px">One click tells us you would like to explore it. Nothing is switched on. We then confirm the technical steps with your acquirer and agree a small trial, with results reviewed together before anything wider.</div>${btn(u.interested, 'Yes, I would like to explore this', true)}${btn(u.more, 'Tell me more', false)}${btn(u.later, 'Not now', false)}</td></tr>

  <tr><td style="padding:18px 28px 26px"><div style="font-size:11px;color:#8A93A6;line-height:1.6;border-top:1px solid ${LINE};padding-top:12px">No commercial terms are included. The market figures are real and dated: ${esc(mk.upi.src)}; ${esc(mk.ru.src)}. The merchant and payment figures belong to a fictional demo merchant built on synthetic data, and the range is an illustration with the stated assumption, not a forecast.</div></td></tr>`, `${range} points potential on ${m.name}`);
  const text = `${m.name}: a way to complete more of your payments (${name}).\n\nIllustrative potential: ${range} percentage points on payment success (about ${pot.per1000[0]} to ${pot.per1000[1]} more completed payments per 1,000), assuming ${Math.round(S.POTENTIAL_ASSUMPTION.low * 100)}-${Math.round(S.POTENTIAL_ASSUMPTION.high * 100)}% of the ${pot.insPct}% insufficient-balance declines complete via a credit line. Not a forecast.\n\nMarket: UPI ${mk.upi.vol} payments in ${mk.upi.when} (${mk.upi.yoy} YoY, NPCI).\n\nInterested: ${u.interested}\nTell me more: ${u.more}\nNot now: ${u.later}`;
  return { subject, html, text };
}

export function ticketEmail(t, link) {
  const subject = `[${t.priority}] ${t.kind}: ${t.title} (${t.id})`;
  const rows = [['Ticket', t.id], ['Type', t.kind], ['Priority', t.priority], ['Assigned to', t.assignee], ['Raised by', t.requester]].map(([k, v]) => `<tr><td style="padding:4px 0;font-size:13px;color:${MUTE};width:110px">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:700">${esc(v)}</td></tr>`).join('');
  const html = wrap(`${head(t.kind + ' · ' + t.id)}<tr><td style="padding:24px 28px 8px"><div style="font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.3">${esc(t.title)}</div></td></tr>
  <tr><td style="padding:4px 28px"><table role="presentation" cellspacing="0" cellpadding="0">${rows}</table></td></tr>
  <tr><td style="padding:12px 28px"><div style="background:#F3F5FC;border:1px solid ${LINE};border-radius:10px;padding:14px;font-size:13.5px;line-height:1.6;white-space:pre-line">${esc(t.summary)}</div></td></tr>
  <tr><td style="padding:8px 28px 24px">${link ? btn(link, 'Open the ticket', true) : ''}<div style="font-size:11.5px;color:${MUTE};margin-top:10px">Demo data. Raised from Acceptance Copilot.</div></td></tr>`, t.title);
  return { subject, html, text: `${subject}\n\n${t.summary}\n\nRaised by ${t.requester}. Assigned to ${t.assignee}.${link ? '\n' + link : ''}` };
}

export function briefEmail(b) {
  const sec = b.sections.map(s => `<tr><td style="padding:10px 28px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTE};margin-bottom:6px">${esc(s.title)}</div>${s.lines.map(l => `<div style="font-size:14px;line-height:1.6;padding:3px 0">• ${esc(l)}</div>`).join('')}</td></tr>`).join('');
  const html = wrap(`${head('Morning brief')}<tr><td style="padding:24px 28px 4px"><div style="font-size:20px;font-weight:700;letter-spacing:-.02em">${esc(b.headline)}</div></td></tr>${sec}<tr><td style="padding:16px 28px 24px;font-size:11.5px;color:${MUTE}">Demo data. Numbers are computed from the synthetic dataset.</td></tr>`, b.headline);
  return { subject: 'Acceptance Copilot morning brief', html, text: b.text };
}
