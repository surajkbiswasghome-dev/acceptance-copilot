import { Info } from '../../ui.jsx';
import React, { useMemo } from 'react';
import * as S from '../../lib/stats.js';
import * as A from '../../lib/analytics.js';
import { Count, Table } from '../../charts.jsx';

const heat = v => (v >= 85 ? 'color-mix(in srgb,var(--ok) 45%,var(--s1))' : v >= 60 ? 'color-mix(in srgb,var(--ok) 22%,var(--s1))' : v >= 35 ? 'color-mix(in srgb,var(--warn) 30%,var(--s1))' : 'color-mix(in srgb,var(--bad) 30%,var(--s1))');
export default function Grow({ filters, lens }) {
  const L = useMemo(() => A.levers(filters), [JSON.stringify(filters)]); const grid = useMemo(() => A.coverageGrid(), []);
  const max = Math.max(...L.levers.map(l => l.highPts), 0.1);
  const merchant = lens.merchant != null ? S.MERCH[lens.merchant] : null;
  return (<div className="col gap16">
    <section className="card"><div className="row between wrap"><div className="col" style={{ gap: 4 }}><span className="eyebrow">Where acceptance can grow<Info k="grow" /></span><span className="mute sm" style={{ maxWidth: 720 }}>Each lever is the pool of failed payments it could address, and an assumed share of that pool that could be recovered. The assumption is shown beside each bar. These are ranges to test in a pilot, not forecasts.</span></div>
        <div className="kt" style={{ minWidth: 220 }}><small>Combined potential, success rate</small><b>+<Count value={L.totalLow} decimals={2} /> to +<Count value={L.totalHigh} decimals={2} /> pts</b><small>from {L.baseline}% today</small></div></div>
      <div className="col" style={{ gap: 14 }}>{L.levers.map(l => (<div key={l.id} className="col" style={{ gap: 6 }}>
        <div className="row between wrap"><b>{l.name}</b><span className="mono sm">+{l.lowPts.toFixed(2)} to +{l.highPts.toFixed(2)} pts · about {l.lowN} to {l.highN} payments</span></div>
        <div className="rangebar" title={l.basis}><i style={{ left: (100 * l.lowPts) / max / 1.0 * 0 + '%', width: (100 * l.highPts) / max + '%', opacity: 0.35 }} /><i style={{ left: 0, width: (100 * l.lowPts) / max + '%' }} /></div>
        <div className="row between wrap"><span className="mute sm">{l.basis}: {l.base.toLocaleString('en-IN')} payments. Assumes {Math.round(l.a[0] * 100)}% to {Math.round(l.a[1] * 100)}% recoverable.</span><a className="sm" style={{ color: 'var(--acc)', fontWeight: 700 }} href={l.link}>{l.linkText}</a></div></div>))}</div></section>
    <section className="card"><div className="row between wrap"><span className="eyebrow">Reach: which instruments each category can accept today<Info k="gr-reach" /></span><span className="mute sm">Share of merchants in the category with the instrument enabled. Gaps are customers who cannot pay their preferred way.</span></div>
      <div style={{ overflowX: 'auto' }}><div className="hgrid" style={{ gridTemplateColumns: `minmax(130px,auto) repeat(${grid.insts.length},minmax(70px,1fr))` }}><span />{grid.insts.map(i => <span key={i} className="hl" style={{ justifyContent: 'center', textAlign: 'center', fontSize: 11 }}>{i}</span>)}
        {grid.cats.map((c, ci) => (<React.Fragment key={c}><span className="hl">{c}</span>{grid.cells[ci].map((v, ii) => <div key={ii} className="hc" style={{ background: heat(v), cursor: 'default', outline: merchant && merchant.category === c && !merchant.enabled[ii] ? '2px solid var(--bad)' : 'none' }} title={v + '% of merchants'}>{v}%</div>)}</React.Fragment>))}</div></div>
      {merchant && <div className="insight"><b>{merchant.name}</b> has {S.INST.filter((_, i) => !merchant.enabled[i]).length === 0 ? 'every instrument enabled.' : 'gaps in: ' + S.INST.filter((_, i) => !merchant.enabled[i]).join(', ') + ' (outlined in red).'}</div>}
      <div className="row wrap"><a className="btn" href="#/recommend">Recommendations per merchant</a><a className="btn" href="#/proposals">Send a proposal</a></div></section>
    <section className="grid-ins"><div className="card"><span className="eyebrow">Playbook: merchant</span><div className="col sm" style={{ gap: 6 }}><span><b>1.</b> Enable the instruments your category’s peers already accept.</span><span><b>2.</b> Fix configuration declines at source. They are the most recoverable.</span><span><b>3.</b> Show payment choices clearly at checkout, especially for high tickets.</span><span><b>4.</b> Agree retry and fallback behaviour with your aggregator.</span></div></div>
      <div className="card"><span className="eyebrow">Playbook: payment aggregator</span><div className="col sm" style={{ gap: 6 }}><span><b>1.</b> Dynamic routing with failover per acquirer and instrument.</span><span><b>2.</b> Smart retry for soft declines, with limits per issuer.</span><span><b>3.</b> Issuer outreach where one issuer declines far above the rest.</span><span><b>4.</b> Run a small pilot with gates before scaling anything.</span></div></div></section>
    <div className="next"><span className="mute sm">Now find the specific causes and decide what to do.</span><a className="btn pri" href="#/diagnose">Next: Diagnose the leaks</a></div>
  </div>);
}
