import React from 'react';
import * as S from './lib/stats.js';

const money = v => '₹' + Math.round(v).toLocaleString('en-IN');
const MARK = { ok: ['ok', 'Meets'], warn: ['warn', 'Partly'], bad: ['bad', 'Does not'], check: ['', 'To confirm'] };
export function FitMatrix({ mi, inst, title }) {
  const f = S.creditFit(mi, inst); const pot = f.pot; const tone = f.verdict === 'Strong fit' ? 'ok' : f.verdict === 'Moderate fit' ? 'warn' : 'bad';
  return (<section className="card fade" aria-label="Fit check"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">{title || 'Fit check before proposing'}</span><b style={{ fontSize: 18 }}>{f.merchant.name} · {f.instrument}</b></div><span className={'pill ' + tone} style={{ fontSize: 14, padding: '8px 14px' }}>{f.verdict} · {f.score} of {f.outOf}</span></div>
    <div className="grid3t"><div className="kt"><span className="mute sm">Potential on success rate</span><b className="num" style={{ fontSize: 22 }}>+{pot.lowPts.toFixed(2)} to +{pot.highPts.toFixed(2)} pts</b></div><div className="kt"><span className="mute sm">More completed per 1,000 attempts</span><b className="num" style={{ fontSize: 22 }}>{pot.per1000[0]} to {pot.per1000[1]}</b></div><div className="kt"><span className="mute sm">Sales per 1,000 attempts</span><b className="num" style={{ fontSize: 22 }}>{money(pot.valuePer1000[0])} to {money(pot.valuePer1000[1])}</b></div></div>
    <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Parameter</th><th>This merchant</th><th>Test</th><th>Result</th></tr></thead><tbody>{f.rows.map(r => <tr key={r.key}><td><b>{r.label}</b></td><td className="num">{r.value}</td><td className="mute sm">{r.rule}</td><td><span className={'pill ' + MARK[r.status][0]}>{MARK[r.status][1]}</span></td></tr>)}</tbody></table></div>
    <span className="mute sm">Synthetic demo data. The range assumes {Math.round(S.POTENTIAL_ASSUMPTION.low * 100)} to {Math.round(S.POTENTIAL_ASSUMPTION.high * 100)}% of insufficient-balance declines complete through a credit line. It is an illustration, not a forecast; a pilot replaces it with a measured result.</span></section>);
}
export function Showcase({ onUse, compact }) {
  return (<section className="card" aria-label="Demo showcase merchants"><div className="row between wrap"><span className="eyebrow">★ Demo showcase merchants</span><span className="pill">No credit on UPI today · enough payments · strong fit</span></div>
    <div className="grid2e">{S.SHOWCASE.map(mi => { const fit5 = S.creditFit(mi, 6); const pot = fit5.pot; const m = S.MERCH[mi]; return (<div key={mi} className="insight col" style={{ gap: 8 }}><div className="row between wrap"><b style={{ fontSize: 17 }}>{m.name}</b><span className={'pill ' + (fit5.verdict === 'Strong fit' ? 'ok' : 'warn')}>{fit5.verdict} · {fit5.score} of {fit5.outOf}</span></div>
      <span className="mute sm">{m.category} · {m.segment} · {m.acquirer} · {pot.n} payments · ticket {money(pot.avgTicket)}</span>
      <div className="row between sm"><span>Declined for insufficient balance</span><b className="num">{pot.insPct}%</b></div><div className="row between sm"><span>Potential on success rate</span><b className="num">+{pot.lowPts.toFixed(2)} to +{pot.highPts.toFixed(2)} pts</b></div>
      {onUse && <div className="row wrap">{[6, 5].map(i => <button key={i} className="btn pri" style={{ minHeight: 38 }} onClick={() => onUse(mi, i)}>Propose {S.INST[i]}</button>)}</div>}</div>); })}</div></section>);
}
