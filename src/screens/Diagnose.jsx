import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { Head, Seg, Bar, Gate } from '../ui.jsx';
import { useKey } from '../lib/store.js';

export default function Diagnose() {
  const k = useMemo(() => S.kpis(), []); const mx = useMemo(() => S.matrix(), []);
  const [lens, setLens] = useState('success'); const [sel, setSel] = useState([2, 0]);
  const [inst, setInst] = useState(5); const [dec] = useKey('ac_dec', {});
  const decl = useMemo(() => S.declineBreakdown(), []); const iss = useMemo(() => S.issuerSplit().sort((a, b) => b.declines - a.declines).slice(0, 5), []);
  const sc = useMemo(() => S.shareByCategory(inst), [inst]); const fnd = useMemo(() => S.findings(), []);
  const cov = (ai, ii) => { const m = S.MERCH.filter(x => x.acquirer === S.ACQ[ai]); const e = m.filter(x => x.enabled[ii]).length; return { rate: m.length ? Math.round((100 * e) / m.length) : null, n: m.length }; };
  const [sa, si] = sel; const cell = mx[sa][si];
  const cellDecl = S.declineBreakdown(t => t.acq === sa && t.inst === si).slice(0, 3);
  const matchId = sa === 2 && si <= 1 ? 'f1' : null;
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
              return <button key={n} className={`cell ${st}${sa === ai && si === ii ? ' sel' : ''}`} onClick={() => setSel([ai, ii])} aria-label={`${a}, ${n}, ${c.rate ?? 'no data'} percent`}><b className="num">{c.rate == null ? '–' : (lens === 'success' && c.n < 20 ? 'low n' : c.rate + '%')}</b><small className="num">{ai === 2 && ii <= 1 && dec.f1 === 'approved' ? 'action approved' : lens === 'success' ? 'n = ' + c.n : c.n + ' merchants'}</small></button>; })}</React.Fragment>))}
        </div></div>
        <div className="insight row between wrap">
          <div className="col" style={{ gap: 2 }}><b>{S.ACQ[sa]} · {S.INST[si]}</b><span className="mute sm num">{cell.rate ?? '–'}% success · n = {cell.n}{cellDecl.length ? ' · top declines: ' + cellDecl.map(d => d.label.toLowerCase() + ' ' + d.share + '%').join(', ') : ''}</span></div>
          {matchId && dec[matchId] === 'approved' && <span className="pill ok">Approved · numbers change only after the pilot runs</span>}{matchId ? <a className="btn pri" style={{ display: 'inline-flex', alignItems: 'center' }} href={'#/explain?id=' + matchId}>Investigate with the agent</a> : <span className="mute sm">No flagged leak in this cell.</span>}
        </div>
      </section>
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
    </>
  );
}
