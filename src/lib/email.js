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

export function proposalEmail(p, urls) {
  const m = S.MERCH[p.merchantId]; const inst = p.instruments[0]; const name = S.INST[inst]; const b = S.peerBenchmark(p.merchantId, inst);
  const u = urls || { interested: '#interested', more: '#more', later: '#later' };
  const subject = `${m.name}: another way for your customers to pay (${name}) [${p.id}]`;
  const other = p.instruments.slice(1).map(i => S.INST[i]);
  const html = wrap(`${head('Merchant growth proposal · ' + p.id)}
  <tr><td style="padding:28px 28px 8px"><div style="font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.25">${esc(m.name)}, give your customers another way to pay</div>
  <p style="font-size:14px;line-height:1.55;color:${MUTE};margin:12px 0 0">We looked at how ${esc(m.category.toLowerCase())} merchants on the network use <b style="color:${INK}">${esc(name)}</b>${other.length ? ' and ' + esc(other.join(', ')) : ''}. Here is what we found, and a small step you can take.</p></td></tr>
  <tr><td style="padding:12px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${tile(b.networkSuccess + '%', 'of payments succeed on ' + name + ' across the network')}${tile(b.peers + ' of ' + b.sameCategory, m.category.toLowerCase() + ' merchants like you already accept it')}${tile(b.avgOn ? money(b.avgOn) : '–', 'average ticket on ' + name + ' (' + money(b.avgAll) + ' across all payments)')}</tr></table></td></tr>
  <tr><td style="padding:8px 28px 4px"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTE};margin-bottom:6px">Success rate on the network</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${bar(name, b.networkSuccess, 100, ACC)}${bar('Debit and credit cards', b.cardSuccess, 100, '#A9B4D0')}</table></td></tr>
  <tr><td style="padding:14px 28px 4px"><div style="font-size:14px;line-height:1.55">Your average ticket is <b>${money(b.merchantAvg)}</b> against ${money(b.avgAll)} across the network. At that value, customers appreciate more ways to pay at checkout.</div></td></tr>
  <tr><td style="padding:14px 28px 4px"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTE};margin-bottom:6px">What happens next</div>
  <div style="font-size:14px;line-height:1.7">1. Tell us you are interested. It takes one click.<br>2. We confirm the technical steps with your acquirer.<br>3. A small 8-week trial, with results reviewed together before anything wider.</div></td></tr>
  <tr><td style="padding:18px 28px 6px"><div style="font-size:14px;font-weight:700;margin-bottom:8px">Would you like to take part?</div>${btn(u.interested, 'Yes, I am interested', true)}${btn(u.more, 'Tell me more', false)}${btn(u.later, 'Not now', false)}</td></tr>
  <tr><td style="padding:16px 28px 24px"><div style="font-size:11.5px;color:${MUTE};line-height:1.5;border-top:1px solid ${LINE};padding-top:12px">This message contains no commercial terms. Figures are illustrative benchmarks from demo data, not a forecast or a promise of results.</div></td></tr>`, 'Another way for your customers to pay, with one click to tell us you are interested');
  const text = `${m.name}: another way for your customers to pay (${name}).\n\nNetwork success on ${name}: ${b.networkSuccess}% (cards ${b.cardSuccess}%). ${b.peers} of ${b.sameCategory} ${m.category.toLowerCase()} merchants already accept it.\n\nInterested: ${u.interested}\nTell me more: ${u.more}\nNot now: ${u.later}\n\nNo commercial terms are included. Figures are illustrative demo data.`;
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
