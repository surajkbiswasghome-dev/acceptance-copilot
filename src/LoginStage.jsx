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
export function Flow() {
  const nodes = [['Merchant', 20], ['Acquirer', 160], ['Network', 300], ['Issuer', 440]];
  const path = 'M 60 62 L 480 62';
  return (<svg className="flow" viewBox="0 0 520 130" role="img" aria-label="A payment travels from merchant to acquirer, network and issuer">
    <defs><radialGradient id="gold" cx="35%" cy="30%"><stop offset="0" stopColor="#FFF1B8" /><stop offset=".55" stopColor="#F2B63C" /><stop offset="1" stopColor="#B9801A" /></radialGradient></defs>
    <path d={path} stroke="var(--line)" strokeWidth="2" strokeDasharray="5 6" fill="none" />
    {nodes.map(([n, x]) => <g key={n}><rect x={x} y="38" width="80" height="48" rx="12" fill="var(--s2)" stroke="var(--line)" /><text x={x + 40} y="67" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--ink)">{n}</text></g>)}
    {[0, 1, 2, 3, 4].map(i => <g key={i} className="coin"><animateMotion dur="5s" begin={'-' + i + 's'} repeatCount="indefinite" path={path} /><circle r="8" fill="url(#gold)" stroke="#9A6A12" strokeWidth=".8" /><text fontSize="9" fontWeight="700" fill="#7A520D" textAnchor="middle" dy="3">₹</text></g>)}
    <text x="260" y="116" textAnchor="middle" fontSize="11" fill="var(--mute)">Each coin is a payment. Where it slows or drops is what this platform finds.</text>
  </svg>);
}
export function Facts() {
  const [i, setI] = useState(0); useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % FACTS.length), 4500); return () => clearInterval(t); }, []); const f = FACTS[i];
  return (<div className="factcard" key={i}><div className="big">{f.big}</div><div>{f.text}</div><div className="mute" style={{ fontSize: 11.5, marginTop: 4 }}>Source: {f.src}</div></div>);
}
export function News({ compact }) {
  const d = useNews(); const live = d && d.items && d.items.length > 0;
  return (<div className="news"><div className="row between"><span className="eyebrow">Latest from RBI and NPCI</span>{d && !live && <span className="mute sm">Live headlines unavailable now</span>}</div>
    {!d && <div className="mute sm">Loading headlines…</div>}
    {live && d.items.slice(0, compact ? 4 : 6).map((x, k) => <a key={k} href={x.url} target="_blank" rel="noopener noreferrer" className="newsrow"><span className={'pill ' + (x.tag === 'RBI' ? 'warn' : 'ok')}>{x.tag}</span><span className="t">{x.title}</span><span className="mute sm">{x.source ? x.source + ' · ' : ''}{ago(x.date)}</span></a>)}
    {d && <div className="row wrap" style={{ gap: 8, marginTop: 4 }}><span className="mute sm">Official:</span>{(d.official || []).map(o => <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="chip">{o.tag}: {o.title.replace(/^(RBI|NPCI)( press releases)?:? ?/i, '') || 'Press releases'}</a>)}</div>}
  </div>);
}
export function SigningIn({ steps }) {
  return (<div className="signing" role="status" aria-live="polite"><div className="signbox">
    <Flow /><div className="steps">{steps.map(([label, st]) => <div key={label} className={'stp ' + st}><span className="dot">{st === 'done' ? '✓' : st === 'run' ? <span className="spin" /> : ''}</span>{label}</div>)}</div>
    <Facts /><News compact /></div></div>);
}
