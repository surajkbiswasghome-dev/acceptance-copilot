import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { useColl, put, audit, uid } from '../lib/db.js';
import { Head, Gate } from '../ui.jsx';

const presets = ['Electronics', 'Travel', 'Grocery'].map(c => S.MERCH.findIndex(m => m.category === c));
const money = v => (v == null ? '–' : '₹' + Math.round(v).toLocaleString('en-IN'));
export default function Recommend({ role }) {
  const [mi, setMi] = useState(presets[0]); const props = useColl('proposals'); const [made, setMade] = useState(null);
  const r = useMemo(() => S.recommend(mi), [mi]); const p = r.profile; const m = p.merchant;
  const cov = r.recs.filter(x => x.gate === 'Coverage'); const pref = r.recs.filter(x => x.gate !== 'Coverage');
  const insts = cov.map(x => S.INST.indexOf(x.instrument)).filter(i => i >= 0);
  const bench = [5, 6].map(i => ({ i, b: S.peerBenchmark(mi, i) }));
  const existing = props.find(x => x.merchantId === mi && x.status !== 'not_now');
  const canEdit = ['pm', 'head', 'en'].includes(role.id);
  const create = async () => { const now = new Date().toISOString(); const id = uid('PRP'); await put('proposals', { id, merchantId: mi, instruments: insts, status: 'draft', created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Draft created from recommendation' }] }); await audit(role.name, 'Created proposal', m.name, id); setMade(id); };
  return (
    <>
      <Head help="recommend" title="Recommend" sub="For a merchant, what to enable and why, using what similar merchants on the network already see. It leads straight to a proposal." />
      <div className="row wrap"><span className="sm mute">Merchant</span>{presets.map(i => <button key={i} className={'btn' + (mi === i ? ' pri' : '')} style={{ minHeight: 38 }} onClick={() => { setMi(i); setMade(null); }}>{S.MERCH[i].category}</button>)}
        <select style={{ width: 'auto', minHeight: 38 }} value={mi} onChange={e => { setMi(+e.target.value); setMade(null); }} aria-label="Merchant">{S.MERCH.map((x, i) => <option key={i} value={i}>{x.name} · {x.category}</option>)}</select></div>
      <section className="card"><div className="col" style={{ gap: 2 }}><b style={{ fontSize: 20 }}>{m.name}</b><span className="mute sm">{m.category} · {m.segment} · {m.acquirer} · average ticket {money(p.avgTicket)} · {p.n} payments in 30 days · success {p.success}%</span></div>
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Instrument</th><th>Enabled</th><th>Share of its payments</th><th>Success</th></tr></thead><tbody>{p.mix.map(x => <tr key={x.instrument}><td>{x.instrument}</td><td><span className={'pill ' + (x.enabled ? 'ok' : 'bad')}>{x.enabled ? 'Enabled' : 'Not enabled'}</span></td><td className="num">{x.share ?? '–'}%</td><td className="num">{x.success ?? '–'}%</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">What similar merchants see</span><span className="pill">Peer benchmark, synthetic data</span></div>
        <div className="grid2e">{bench.map(({ i, b }) => <div key={i} className="insight col" style={{ gap: 8 }}><b>{S.INST[i]}</b>
          <div className="row between sm"><span>{m.category} merchants that accept it</span><b className="num">{b.peers} of {b.sameCategory}</b></div>
          <div className="row between sm"><span>Share of their payments</span><b className="num">{b.share ?? '–'}%</b></div>
          <div className="row between sm"><span>Success on the network</span><b className="num">{b.networkSuccess}% (cards {b.cardSuccess}%)</b></div>
          <div className="row between sm"><span>Average ticket on it vs {m.name}</span><b className="num">{money(b.avgOn)} vs {money(b.merchantAvg)}</b></div>
          {b.share != null && <div className="row between sm"><span>If {m.name} matched its peers</span><b className="num">about {b.share} in every 100 payments</b></div>}</div>)}</div>
        <span className="mute sm">Benchmark arithmetic from the demo dataset, not a forecast. Only a pilot can show what this merchant would actually see.</span></section>
      <section className="card"><div className="row between"><span className="eyebrow">Recommended next steps</span><span className="pill">Rules-based</span></div>
        {r.recs.length === 0 && <p className="mute">This merchant already covers the instruments its profile suggests.</p>}
        <div className="list">{r.recs.map((x, i) => <div key={i} className="row between wrap"><div className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b>{x.instrument}</b><span className="mute sm">{x.why}{x.gate !== 'Coverage' ? ' Tested through the pilot, as a checkout prompt or offer.' : ''}</span></div><Gate g={x.gate} /></div>)}</div>
        {insts.length > 0 && canEdit && (made || existing ? <a className="btn pri" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center' }} href={'#/proposals?id=' + (made || existing.id)}>{made ? 'Draft created. Open the proposal' : 'A proposal already exists. Open it'}</a> : <button className="btn pri" style={{ alignSelf: 'flex-start' }} onClick={create}>Create proposal for {insts.map(i => S.INST[i]).join(' and ')}</button>)}
        {pref.length > 0 && insts.length === 0 && <span className="mute sm">No missing instruments. The checkout prompt and offer ideas above are tested through the pilot.</span>}</section>
    </>
  );
}
