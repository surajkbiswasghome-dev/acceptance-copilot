import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { Head, Seg, Bar, Gate } from '../ui.jsx';
import { useColl } from '../lib/db.js';

export default function Diagnose() {
  const k = useMemo(() => S.kpis(), []); const mx = useMemo(() => S.matrix(), []);
  const [lens, setLens] = useState('success'); const [sel, setSel] = useState([2, 0]);
  const [inst, setInst] = useState(5); const decisions = useColl('decisions'); const dec = Object.fromEntries(decisions.map(x => [x.id, x.status])); const [ta, setTa] = useState(-1);
  const decl = useMemo(() => S.declineBreakdown(), []); const iss = useMemo(() => S.issuerSplit().sort((a, b) => b.declines - a.declines).slice(0, 5), []);
  const sc = useMemo(() => S.shareByCategory(inst), [inst]); const fnd = useMemo(() => S.findings(), []);
  const cov = (ai, ii) => { const m = S.MERCH.filter(x => x.acquirer === S.ACQ[ai]); const e = m.filter(x => x.enabled[ii]).length; return { rate: m.length ? Math.round((100 * e) / m.length) : null, n: m.length }; };
  const [sa, si] = sel; const cell = mx[sa][si];
  const cellDecl = S.declineBreakdown(t => t.acq === sa && t.inst === si).slice(0, 3);
  const matchId = fnd.find(f => (f.id === 'f1' && sa === f.acq && si <= 1) || (f.id === 'f7' && f.au && sa === f.au.ai && si === f.au.inst))?.id || null;
  const approvedCell = (ai, ii) => fnd.some(f => dec[f.id] === 'approved' && ((f.id === 'f1' && ai === f.acq && ii <= 1) || (f.id === 'f7' && f.au && ai === f.au.ai && ii === f.au.inst)));
  return (
    <>
      <Head title="Diagnose" sub="Where payments leak across acquirers and instruments over the last 30 days. Every figure is computed from the data." right={<span className="pill">30 days · {k.n.toLocaleString('en-IN')} payments</span>} />
      <section className="grid4" aria-label="Key figures">
        {[['Overall success', k.success + '%', 'all instruments', k.success], ['UPI success', k.upiSuccess + '%', 'UPI bank and credit on UPI', k.upiSuccess], ['RuPay card success', k.rupaySuccess + '%', 'debit and credit', k.rupaySuccess], ['Value in declines', S.money(k.lostGmv), k.declines.toLocaleString('en-IN') + ' declined payments', 100 - (100 * k.lostGmv) / k.gmv]].map(([t, v, s, g]) => (
          <div className="card kpi" key={t}><span className="eyebrow">{t}</span><b className="num">{v}</b><Bar v={g} /><small>{s}</small></div>))}
      </section>
      <section className="card" aria-label="Heat map">
        <div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Acquirer × instrument</span><span className="mute sm">{lens === 'success' ? 'Success rate. Green 90%+, amber 87–90%, red below 87%. Cells under 20 payments show “low n”.' : 'Coverage: share of the acquirer’s merchants with the instrument enabled.'}</span></div><Seg value={lens} onChange={setLens} options={[['success', 'Success'], ['coverage', 'Coverage']]} /></div>
        <div className="heatwrap"><div className="heat">
          <span />{S.INST.map(n => <span className="h" key={n}>{n}</span>)}
          {S.ACQ.map((a, ai) => (<React.Fragment key={a}><span className="h" style={{ alignItems: 'center' }}>{a}</span>
            {S.INST.map((n, ii) => { const c = lens === 'success' ? mx[ai][ii] : cov(ai, ii); const st = lens === 'success' ? (c.n < 20 ? 'na' : S.statusOf(c.rate)) : c.rate >= 70 ? 'ok' : c.rate >= 40 ? 'warn' : 'bad';
              return <button key={n} className={`cell ${st}${sa === ai && si === ii ? ' sel' : ''}`} onClick={() => setSel([ai, ii])} aria-label={`${a}, ${n}, ${c.rate ?? 'no data'} percent`}><b className="num">{c.rate == null ? '–' : (lens === 'success' && c.n < 20 ? 'low n' : c.rate + '%')}</b><small className="num">{approvedCell(ai, ii) ? 'action approved' : lens === 'success' ? 'n = ' + c.n : c.n + ' merchants'}</small></button>; })}</React.Fragment>))}
        </div></div>
        <div className="insight row between wrap">
          <div className="col" style={{ gap: 2 }}><b>{S.ACQ[sa]} · {S.INST[si]} <span className="pill" style={{ marginLeft: 6 }}>this cell only</span></b><span className="mute sm num">{cell.rate ?? '–'}% success · n = {cell.n}{cellDecl.length ? ' · top declines: ' + cellDecl.map(d => d.label.toLowerCase() + ' ' + d.share + '%').join(', ') : ''}</span></div>
          {matchId && <span className="mute sm" style={{ maxWidth: 360 }}>For RuPay the agent reads debit and credit together, so its figures can differ from this single cell.</span>}{matchId && dec[matchId] === 'approved' && <span className="pill ok">Approved · numbers change only after the pilot runs</span>}{matchId ? <a className="btn pri" style={{ display: 'inline-flex', alignItems: 'center' }} href={'#/explain?id=' + matchId}>Investigate with the agent</a> : <span className="mute sm">No flagged leak in this cell.</span>}
        </div>
      </section>
      <section className="card" aria-label="Daily trend"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Daily success rate</span><span className="mute sm">Dips show short incidents that a 30-day average hides.</span></div>
        <select style={{ width: 'auto', minHeight: 38 }} value={ta} onChange={e => setTa(+e.target.value)} aria-label="Acquirer"><option value={-1}>All acquirers</option>{S.ACQ.map((a, i) => <option key={a} value={i}>{a}</option>)}</select></div>
        <Trend series={S.dailySeries(t => ta < 0 || t.acq === ta)} /></section>
      <section className="grid2">
        <div className="card"><span className="eyebrow">Ranked leaks</span>
          <div>{fnd.map((f, i) => (<a key={f.id} className="rank" href={'#/explain?id=' + f.id}><span className="n">{i + 1}</span><span className="col" style={{ gap: 2 }}><b>{f.title}</b><span className="mute sm">{f.subtitle}</span></span><span className="col" style={{ alignItems: 'flex-end', gap: 4 }}><Gate g={f.gate} />{dec[f.id] && <span className={'pill ' + (dec[f.id] === 'approved' ? 'ok' : 'bad')}>{dec[f.id] === 'approved' ? 'Approved · awaiting pilot' : 'Rejected'}</span>}</span></a>))}</div>
        </div>
        <div className="card"><span className="eyebrow">Why payments decline</span>
          <div className="col gap16">{decl.map(d => <div key={d.code} className="col" style={{ gap: 4 }}><div className="row between sm"><span>{d.label}</span><b className="num">{d.share}%</b></div><Bar v={d.share} max={Math.max(...decl.map(x => x.share))} /></div>)}</div>
        </div>
      </section>
      <section className="grid2e">
        <div className="card"><div className="row between wrap"><span className="eyebrow">Instrument share by category</span>
          <select style={{ width: 'auto', minHeight: 38 }} value={inst} onChange={e => setInst(+e.target.value)} aria-label="Instrument">{S.INST.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></div>
          <div className="col">{sc.map(c => <div key={c.category} className="col" style={{ gap: 4 }}><div className="row between sm"><span>{c.category}</span><span className="num mute">{c.share}% share · enabled {c.enabled}/{c.merchants}</span></div><Bar v={c.share} max={Math.max(5, ...sc.map(x => x.share))} /></div>)}</div></div>
        <div className="card"><span className="eyebrow">Declines by issuer (top 5)</span>
          <table><thead><tr><th>Issuer</th><th>Declines</th><th>Issuer-decline rate</th></tr></thead><tbody>{iss.map(r => <tr key={r.issuer}><td>{r.issuer}</td><td className="num">{r.declines}</td><td className="num">{r.issuerDeclineRate}%</td></tr>)}</tbody></table></div>
      </section>
      <section className="card" aria-label="Category by instrument"><span className="eyebrow">Share of payments: category × instrument</span>
        <div className="heatwrap"><table><thead><tr><th>Category</th>{S.INST.map(n => <th key={n}>{n}</th>)}</tr></thead><tbody>{S.categoryInstrumentMatrix().map(r => <tr key={r.category}><td>{r.category}</td>{r.shares.map((v, i) => <td key={i} className="num" style={{ background: `color-mix(in srgb, var(--acc) ${Math.min(55, v * 1.1)}%, transparent)` }}>{v}%</td>)}</tr>)}</tbody></table></div></section>
    </>
  );
}

function Trend({ series }) {
  const pts = series.filter(d => d.rate != null); const W = 900, H = 150, P = 28; const lo = 60, hi = 100;
  const x = i => P + (i * (W - 2 * P)) / 29, y = v => H - 18 - ((Math.max(lo, v) - lo) * (H - 36)) / (hi - lo);
  const path = pts.map((d, i) => (i ? 'L' : 'M') + x(d.day).toFixed(1) + ' ' + y(d.rate).toFixed(1)).join(' ');
  const worst = [...pts].sort((a, b) => a.rate - b.rate)[0];
  return (<div className="trendwrap"><svg viewBox={`0 0 ${W} ${H}`} className="sparkline" role="img" aria-label="Daily success rate over 30 days">
    {[70, 80, 90].map(v => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" /><text x={4} y={y(v) + 4} fontSize="11" fill="var(--mute)">{v}%</text></g>)}
    <path d={path} fill="none" stroke="var(--acc)" strokeWidth="2.2" strokeLinejoin="round" />
    {worst && <g><circle cx={x(worst.day)} cy={y(worst.rate)} r="5" fill="var(--bad)" /><text x={Math.min(W - 120, x(worst.day) + 8)} y={y(worst.rate) - 8} fontSize="12" fill="var(--ink)">Lowest: {worst.rate}% on {S.dayLabel(worst.day)}</text></g>}
    <text x={P} y={H - 2} fontSize="11" fill="var(--mute)">{S.dayLabel(0)}</text><text x={W - P - 30} y={H - 2} fontSize="11" fill="var(--mute)">{S.dayLabel(29)}</text></svg></div>);
}
