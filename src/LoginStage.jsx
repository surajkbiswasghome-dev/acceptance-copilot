import React, { useEffect, useState } from 'react';
import { MARKET } from './lib/email.js';

const FACTS = [
  { big: MARKET.upi.vol, text: `UPI payments in ${MARKET.upi.when}, ${MARKET.upi.yoy} on a year earlier`, src: 'NPCI monthly UPI statistics' },
  { big: MARKET.upi.val, text: `moved over UPI in ${MARKET.upi.when}`, src: 'NPCI monthly UPI statistics' },
  { big: MARKET.upi.daily, text: `UPI payments every day in ${MARKET.upi.when}`, src: 'NPCI monthly UPI statistics' },
  { big: MARKET.ru.txn, text: `RuPay credit card payments on UPI in ${MARKET.ru.when}, worth ${MARKET.ru.val}`, src: 'Business Standard, via Gokiwi' },
  { big: '1 click', text: 'is all a merchant needs to say yes to a proposal. A person approves everything else.', src: 'Acceptance Copilot' }
];
export function useNews() {
  const [d, setD] = useState(null);
  useEffect(() => { let on = true; fetch('/api/news').then(r => (r.ok ? r.json() : null)).then(j => on && setD(j || { items: [], official: [] })).catch(() => on && setD({ items: [], official: [] })); return () => { on = false; }; }, []);
  return d;
}
const ago = iso => { if (!iso) return ''; const h = Math.round((Date.now() - new Date(iso)) / 36e5); return h < 1 ? 'just now' : h < 24 ? h + ' h ago' : Math.round(h / 24) + ' d ago'; };
const NODES = ['Customer', 'Merchant', 'Aggregator', 'Acquirer', 'Network', 'Issuer'];
const NX = i => i * 112;
const BEATS = [
  [0, 'money', null, 'The customer chooses to pay'], [1, 'money', null, 'The payment reaches the merchant'], [1, 'msg', 1, 'The merchant processes the order and sends a payment request'],
  [2, 'msg', null, 'The request goes to the payment aggregator'], [2, 'msg', 2, 'The aggregator checks risk and picks the best route'], [3, 'msg', null, 'The acquirer receives the request'], [3, 'msg', 3, 'The acquirer prepares the authorisation'],
  [4, 'msg', null, 'The card network or UPI carries it to the issuer'], [5, 'msg', null, 'The issuer receives the request'], [5, 'msg', 5, 'The issuer checks balance and risk, then decides'],
  [4, 'ok', null, 'Approved. The answer travels back'], [3, 'ok', null, 'Back through the acquirer'], [2, 'ok', null, 'Back through the aggregator'], [1, 'ok', null, 'The merchant shows “Payment successful”'], [0, 'ok', null, 'The customer gets the confirmation'],
  [2, 'coin', null, 'Later, the aggregator settles the money to the merchant'], [1, 'coin', null, 'Settled into the merchant’s account']
];
function Token({ type }) {
  if (type === 'coin') return <g><circle r="7" fill="url(#gold)" stroke="#9A6A12" strokeWidth=".8" /><text fontSize="8" fontWeight="700" fill="#7A520D" textAnchor="middle" dy="2.8">₹</text></g>;
  if (type === 'money') return <g><rect x="-11" y="-7" width="22" height="14" rx="2.5" fill="#2E9D6A" stroke="#1B6E49" strokeWidth=".8" /><circle r="3.2" fill="none" stroke="#CFF3E0" strokeWidth="1" /></g>;
  if (type === 'ok') return <g><rect x="-10" y="-7" width="20" height="14" rx="3" fill="#2E9D6A" /><path d="M-4 0l3 3 5-6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>;
  return <g><rect x="-10" y="-7" width="20" height="14" rx="2.5" fill="#fff" stroke="#5F7BD6" strokeWidth="1" /><path d="M-10 -6l10 8 10-8" stroke="#5F7BD6" strokeWidth="1" fill="none" /></g>;
}
export function Flow() {
  const [k, setK] = useState(0); useEffect(() => { const t = setInterval(() => setK(x => (x + 1) % BEATS.length), 1150); return () => clearInterval(t); }, []);
  const [pos, type, proc, cap] = BEATS[k];
  return (<div className="flowbox"><svg className="flow" viewBox="0 0 640 118" role="img" aria-label="How a payment travels: customer, merchant, payment aggregator, acquirer, card network or UPI, issuer, and back">
    <defs><radialGradient id="gold" cx="35%" cy="30%"><stop offset="0" stopColor="#FFF1B8" /><stop offset=".55" stopColor="#F2B63C" /><stop offset="1" stopColor="#B9801A" /></radialGradient></defs>
    <path d="M 40 62 H 600" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 6" fill="none" />
    {NODES.map((n, i) => <g key={n}><rect x={NX(i)} y="40" width="80" height="44" rx="11" fill="var(--s2)" stroke={proc === i || pos === i ? 'var(--acc)' : 'var(--line)'} strokeWidth={proc === i ? 2 : 1} style={{ transition: 'stroke .3s' }} /><text x={NX(i) + 40} y="66" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--ink)">{n}</text>
      {proc === i && <g transform={`translate(${NX(i) + 40} 22)`}><g className="gear"><circle r="8" fill="none" stroke="var(--acc)" strokeWidth="2.4" strokeDasharray="3.1 3.1" /><circle r="3" fill="var(--acc)" /></g></g>}</g>)}
    <g style={{ transform: `translate(${NX(pos) + 40}px, 62px)`, transition: 'transform .9s cubic-bezier(.4,0,.2,1)' }}><g transform="translate(0 -28)"><Token type={type} /></g></g>
  </svg><div className="flowcap" aria-live="off">{cap}</div></div>);
}

export function Facts() {
  const [i, setI] = useState(0); useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % FACTS.length), 4500); return () => clearInterval(t); }, []); const f = FACTS[i];
  return (<div className="factcard" key={i}><div className="big">{f.big}</div><div>{f.text}</div><div className="mute" style={{ fontSize: 11.5, marginTop: 4 }}>Source: {f.src}</div></div>);
}
const host = u => { try { return new URL(u).hostname; } catch { return ''; } };
const thumbOf = x => x.thumb || (host(x.sourceUrl || x.url) ? 'https://www.google.com/s2/favicons?domain=' + host(x.sourceUrl || x.url) + '&sz=128' : '');
function Thumb({ x }) { const [bad, setBad] = useState(false); const t = thumbOf(x); const ini = (x.source || x.tag || 'N').trim()[0]; return <span className="thumb">{t && !bad ? <img src={t} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <b>{ini}</b>}</span>; }
export function News({ compact }) {
  const d = useNews(); const live = d && d.items && d.items.length > 0;
  const rows = d ? [...(live ? d.items.slice(0, 8) : []), ...(d.official || []).map(o => ({ ...o, source: o.tag === 'RBI' ? 'Reserve Bank of India' : 'NPCI', official: true }))] : [];
  const roll = rows.length > 3;
  return (<div className={'news' + (compact ? ' compact' : '')}><div className="row between"><span className="eyebrow">Latest news from the payments domain</span>{d && !live && <span className="mute sm">Live headlines unavailable now. Official sources:</span>}</div>
    {!d && <div className="mute sm">Loading headlines…</div>}
    {d && <div className="ticker"><div className={'tickin' + (roll ? ' roll' : '')} style={roll ? { animationDuration: rows.length * 5 + 's' } : undefined}>{(roll ? [...rows, ...rows] : rows).map((x, k) => <a key={k} href={x.url} target="_blank" rel="noopener noreferrer" className="newsrow" aria-hidden={roll && k >= rows.length ? true : undefined} tabIndex={roll && k >= rows.length ? -1 : undefined}><Thumb x={x} /><span className="col" style={{ gap: 1, minWidth: 0 }}><span className="t">{x.title}</span><span className="mute sm">{x.source || x.tag}{x.date ? ' · ' + ago(x.date) : ''}{x.official ? ' · official page' : ''}</span></span></a>)}</div></div>}
  </div>);
}

export function SigningIn({ steps }) {
  return (<div className="signing" role="status" aria-live="polite"><div className="signbox">
    <Flow /><div className="steps">{steps.map(([label, st]) => <div key={label} className={'stp ' + st}><span className="dot">{st === 'done' ? '✓' : st === 'run' ? <span className="spin" /> : ''}</span>{label}</div>)}</div>
    <Facts /><News compact /></div></div>);
}
