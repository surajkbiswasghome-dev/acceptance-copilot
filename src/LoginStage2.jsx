import React, { useEffect, useState } from 'react';
// Login type 2. Illustrative figures only, labelled as such on screen. No real or NPCI data.
const useTick = ms => { const [t, setT] = useState(0); useEffect(() => { const i = setInterval(() => setT(x => x + 1), ms); return () => clearInterval(i); }, [ms]); return t; };
const wob = (t, a, s) => Math.sin(t / 2.3 + s) * a + Math.sin(t / 5.1 + s * 2) * a * 0.5;

const STAGES = [['Eligible', 100], ['Offered', 71], ['Accepted', 42], ['On EMI', 34], ['Repaid on time', 31]];
const MIX = [['RuPay credit on UPI', 46, 'var(--acc)'], ['Credit line on UPI', 22, 'var(--warn)'], ['Card rails EMI', 32, 'var(--ok)']];

function Funnel({ t }) {
  return (<div className="tile2"><div className="eyebrow">Acceptance funnel</div><div className="fun2">{STAGES.map(([n, v], i) => { const w = Math.max(8, Math.min(100, v + wob(t, 3.5, i))); return (<div key={n} className="fr2"><span className="sm mute">{n}</span><span className="bar2"><i style={{ width: w + '%', transitionDelay: i * 60 + 'ms' }} /></span><b className="sm">{Math.round(w)}%</b></div>); })}</div></div>);
}
function Trend({ t }) {
  const N = 16, pts = Array.from({ length: N }, (_, k) => 58 + wob(t + k * 1.7, 9, 1.3) + k * 0.9);
  const X = k => 8 + k * (284 / (N - 1)), Y = v => 96 - (v - 40) * 1.25;
  const d = pts.map((v, k) => (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  return (<div className="tile2"><div className="eyebrow">Acceptance rate, last 16 weeks</div>
    <svg viewBox="0 0 300 110" className="trend2" role="img" aria-label="Illustrative acceptance rate trend rising over 16 weeks">
      {[30, 55, 80].map(y => <line key={y} x1="8" x2="292" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 5" />)}
      <path d={d + ` L ${X(N - 1)} 104 L ${X(0)} 104 Z`} fill="var(--acc)" opacity=".12" style={{ transition: 'd 1.6s ease' }} />
      <path d={d} fill="none" stroke="var(--acc)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'd 1.6s ease' }} />
      <circle cx={X(N - 1)} cy={Y(pts[N - 1])} r="4.5" fill="var(--acc)" className="pulse2" />
    </svg></div>);
}
function Mix({ t }) {
  const R = 38, C = 2 * Math.PI * R; const vals = MIX.map(([, v], i) => Math.max(10, v + wob(t, 3, i + 4))); const tot = vals.reduce((a, b) => a + b, 0); let off = 0;
  return (<div className="tile2"><div className="eyebrow">EMI product mix</div><div className="row" style={{ gap: 14, alignItems: 'center' }}>
    <svg viewBox="0 0 100 100" width="96" height="96" role="img" aria-label="Illustrative mix of EMI products"><g transform="rotate(-90 50 50)">{MIX.map(([n, , c], i) => { const len = (vals[i] / tot) * C; const el = <circle key={n} cx="50" cy="50" r={R} fill="none" stroke={c} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} style={{ transition: 'all 1.4s ease' }} />; off += len; return el; })}</g></svg>
    <div className="col" style={{ gap: 5 }}>{MIX.map(([n, , c], i) => <span key={n} className="sm"><i className="dot2" style={{ background: c }} />{n} <b>{Math.round((vals[i] / tot) * 100)}%</b></span>)}</div></div></div>);
}
function Counters({ t }) {
  const items = [['Offers scored', 12840 + t * 7], ['Approved', 9102 + t * 5], ['Awaiting second approver', 4 + (Math.floor(t / 4) % 4)]];
  return (<div className="count2">{items.map(([n, v]) => <div key={n} className="tile2 c2"><b>{v.toLocaleString('en-IN')}</b><span className="sm mute">{n}</span></div>)}</div>);
}
export function Control2() {
  const t = useTick(2200);
  return (<div className="ctl2">
    <Counters t={t} /><div className="g2"><Funnel t={t} /><Trend t={t} /></div><Mix t={t} />
    <div className="mute sm">Illustrative demo figures, moving to show the idea. Real numbers appear after sign-in, from the synthetic dataset.</div></div>);
}

const STEPS = [
  ['Scan and pay', 'Customer scans the merchant QR for ₹24,000', 'scan'],
  ['Choose the instrument', 'Picks RuPay credit card ending 4821 on UPI', 'card'],
  ['See the EMI offers', '3, 6 or 9 months, ranked for comfort and cost', 'offer'],
  ['Affordability check', 'Approved within policy. Reason codes recorded', 'ok'],
  ['Instalments run', 'First instalment auto-debits through UPI AutoPay', 'repay']
];
function Screen({ kind }) {
  if (kind === 'scan') return (<div className="scr2"><div className="qr2" aria-hidden="true">{Array.from({ length: 49 }, (_, i) => <i key={i} className={(i * 7 + (i >> 2)) % 3 === 0 || i % 8 === 0 ? 'on' : ''} />)}</div><b>Pay ₹24,000</b><span className="sm mute">Sample Electronics</span></div>);
  if (kind === 'card') return (<div className="scr2"><div className="cc2"><span>RuPay credit</span><b>•••• 4821</b></div><span className="sm mute">Pay using</span><b className="sm">UPI · RuPay credit card</b></div>);
  if (kind === 'offer') return (<div className="scr2"><span className="sm mute">Pay in instalments</span>{[['3 months', '₹8,350'], ['6 months', '₹4,180'], ['9 months', '₹2,830']].map(([m, v], i) => <div key={m} className={'opt2' + (i === 1 ? ' on' : '')}><span>{m}</span><b>{v}/mo</b></div>)}</div>);
  if (kind === 'ok') return (<div className="scr2"><div className="okc2">✓</div><b>EMI approved</b><span className="sm mute">Score 71 · within policy</span></div>);
  return (<div className="scr2"><span className="sm mute">UPI AutoPay set up</span><b>₹4,180 on the 5th</b><div className="dots2">{[1, 2, 3, 4, 5, 6].map(n => <i key={n} className={n === 1 ? 'on' : ''} />)}</div><span className="sm mute">1 of 6 instalments</span></div>);
}
export function Journey2({ steps }) {
  const t = useTick(1900); const k = t % STEPS.length;
  return (<div className="signing" role="status" aria-live="polite"><div className="signbox j2">
    <div className="jrow2"><div className="phone2" aria-hidden="true"><div className="notch2" /><div className="scrw2" key={k}><Screen kind={STEPS[k][2]} /></div></div>
      <ol className="tl2">{STEPS.map(([n, d], i) => <li key={n} className={i === k ? 'on' : i < k ? 'past' : ''}><span className="pin2">{i < k ? '✓' : i + 1}</span><span className="col" style={{ gap: 0 }}><b className="sm">{n}</b><span className="sm mute">{d}</span></span></li>)}</ol></div>
    <div className="steps">{steps.map(([label, st]) => <div key={label} className={'stp ' + st}><span className="dot">{st === 'done' ? '✓' : st === 'run' ? <span className="spin" /> : ''}</span>{label}</div>)}</div>
    <div className="mute sm">Example EMI-on-UPI journey for a RuPay credit card. Illustrative amounts.</div></div></div>);
}
