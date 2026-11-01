import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { useColl, put, audit } from '../lib/db.js';
import { STEPS } from './Enable.jsx';
import { Head } from '../ui.jsx';

const DEF = { id: 'main', status: 'planned', cohort: [], th: { lift: 2, drop: 1 }, weeks: {} };
const num = v => (v === '' || v == null ? null : Number(v));
export default function Pilot({ role }) {
  const doc = useColl('pilot').find(x => x.id === 'main') || DEF; const props = useColl('proposals'); const checks = useColl('checks');
  const [add, setAdd] = useState(S.MERCH.findIndex(m => m.category === 'Electronics'));
  const edit = ['pm', 'head'].includes(role.id); const save = async d => put('pilot', { ...DEF, ...doc, ...d });
  const rows = useMemo(() => S.TX.filter(t => doc.cohort.includes(t.m)), [doc.cohort.join()]);
  const base = rows.length ? { share: Math.round(1000 * rows.filter(t => t.inst === 5).length / rows.length) / 10, success: S.rate(rows), n: rows.length } : null;
  const wk = Array.from({ length: 8 }, (_, i) => ({ w: i + 1, ...(doc.weeks[i + 1] || {}) }));
  const entered = wk.filter(x => num(x.success) != null && num(x.share) != null);
  const last4 = entered.slice(-4), last2 = entered.slice(-2);
  const covDone = doc.cohort.filter(m => { const p = props.find(x => x.merchantId === m && ['interested', 'live'].includes(x.status)); return p && (p.status === 'live' || (checks.find(c => c.id === p.id)?.done || []).length === STEPS.length); }).length;
  const gates = [
    { n: '1. Coverage', rule: 'Instrument enabled and tested at every cohort merchant', pass: doc.cohort.length > 0 && covDone === doc.cohort.length, state: doc.cohort.length ? covDone + ' of ' + doc.cohort.length + ' merchants ready' : 'No cohort yet' },
    { n: '2. Experience', rule: 'Success stays within ' + doc.th.drop + ' point of baseline for 4 weeks', pass: base && last4.length === 4 && last4.every(x => num(x.success) >= base.success - doc.th.drop), breach: base && entered.some(x => num(x.success) < base.success - doc.th.drop), state: last4.length < 4 ? entered.length + ' of 4 weeks entered' : '' },
    { n: '3. Preference', rule: 'Share is at least ' + doc.th.lift + ' points above baseline over the last 2 weeks', pass: base && last2.length === 2 && last2.reduce((a, x) => a + num(x.share), 0) / 2 >= base.share + doc.th.lift, state: last2.length < 2 ? 'Needs 2 weeks of data' : '' }
  ];
  const decision = gates[1].breach ? ['bad', 'Pause and investigate', 'Success fell below the guardrail in at least one week.'] : gates.every(g => g.pass) ? ['ok', 'Ready to scale', 'All three gates are met.'] : ['warn', 'Hold: keep running', 'Not all gates are met yet.'];
  const tag = { planned: ['warn', 'Planned, not launched'], running: ['ok', 'Running'], paused: ['bad', 'Paused'] }[doc.status || 'planned'];
  const go = async (s, label) => { await save({ status: s }); await audit(role.name, label, 'Pilot'); };
  const setW = (w, k, v) => save({ weeks: { ...doc.weeks, [w]: { ...(doc.weeks[w] || {}), [k]: v } } });
  const fromQueue = props.filter(p => ['interested', 'live'].includes(p.status)).map(p => p.merchantId).filter(m => !doc.cohort.includes(m));
  return (
    <>
      <Head help="pilot" title="Pilot" sub="Run a small test and record the weekly numbers. The gates decide whether to scale, hold or pause." right={<span className="pill warn">You enter the results. Nothing here is a prediction.</span>} />
      <section className="card"><div className="row between wrap"><div className="col" style={{ gap: 4 }}><span className="eyebrow">Status</span><span className={'pill ' + tag[0]} style={{ alignSelf: 'flex-start' }}>{tag[1]}</span></div>
        <div className="row">{doc.status === 'planned' || !doc.status ? <button className="btn pri" disabled={!edit || !doc.cohort.length} onClick={() => go('running', 'Pilot launched')}>Launch pilot</button> : doc.status === 'running' ? <button className="btn" disabled={!edit} onClick={() => go('paused', 'Pilot paused (kill-switch)')}>Pause pilot</button> : <button className="btn pri" disabled={!edit} onClick={() => go('running', 'Pilot resumed')}>Resume pilot</button>}</div></div>
        <span className="mute sm">{!doc.cohort.length ? 'Add merchants to the cohort first.' : edit ? 'Launching and pausing are logged. This prototype does not touch real payments.' : 'Only the Acceptance PM or Head can launch or pause.'}</span></section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">Cohort (phase 1: UPI + RuPay credit)</span>{fromQueue.length > 0 && edit && <button className="btn" onClick={() => save({ cohort: [...doc.cohort, ...fromQueue] })}>Add the {fromQueue.length} merchants from enablement</button>}</div>
        {doc.cohort.length === 0 ? <p className="mute">No merchants yet. Add those who said yes (from Enablement) or pick any merchant.</p> : <table><thead><tr><th>Merchant</th><th>Category</th><th>Acquirer</th><th></th></tr></thead><tbody>{doc.cohort.map(i => <tr key={i}><td>{S.MERCH[i].name}</td><td>{S.MERCH[i].category}</td><td>{S.MERCH[i].acquirer}</td><td>{edit && <button className="btn" style={{ minHeight: 32, fontSize: 13 }} onClick={() => save({ cohort: doc.cohort.filter(x => x !== i) })}>Remove</button>}</td></tr>)}</tbody></table>}
        {edit && <div className="row wrap"><select style={{ width: 'auto' }} value={add} onChange={e => setAdd(+e.target.value)} aria-label="Merchant to add">{S.MERCH.map((m, i) => <option key={i} value={i}>{m.name} · {m.category}</option>)}</select><button className="btn" disabled={doc.cohort.includes(add)} onClick={() => save({ cohort: [...doc.cohort, add] })}>Add to cohort</button></div>}
        {base && <span className="mute sm num">Baseline from the last 30 days: success {base.success}%, UPI + RuPay credit share {base.share}% (n = {base.n}). Phase 2, UPI + credit line, starts only after phase 1 passes its gates.</span>}</section>
      <section className="card"><span className="eyebrow">Weekly results (you enter these)</span>
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Week</th><th>Share on instrument (%)</th><th>Cohort success (%)</th></tr></thead><tbody>{wk.map(x => <tr key={x.w}><td>Week {x.w}{x.w <= 2 ? ' (baseline)' : ''}</td><td><input type="number" step="0.1" disabled={!edit} style={{ minHeight: 38, maxWidth: 140 }} value={x.share ?? ''} onChange={e => setW(x.w, 'share', e.target.value)} /></td><td><input type="number" step="0.1" disabled={!edit} style={{ minHeight: 38, maxWidth: 140 }} value={x.success ?? ''} onChange={e => setW(x.w, 'success', e.target.value)} /></td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">Scale gates</span><div className="row sm"><label className="row">Share lift ≥<input type="number" disabled={!edit} style={{ minHeight: 34, width: 64 }} value={doc.th.lift} onChange={e => save({ th: { ...doc.th, lift: Number(e.target.value) } })} />pts</label><label className="row">Max success drop<input type="number" disabled={!edit} style={{ minHeight: 34, width: 64 }} value={doc.th.drop} onChange={e => save({ th: { ...doc.th, drop: Number(e.target.value) } })} />pt</label></div></div>
        <div className="list">{gates.map(g => <div key={g.n} className="row between wrap"><div className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b>{g.n}</b><span className="mute sm">{g.rule}</span></div><span className={'pill ' + (g.pass ? 'ok' : g.breach ? 'bad' : '')}>{g.pass ? 'Met' : g.breach ? 'Breached' : g.state || 'Not yet'}</span></div>)}</div>
        <div className={'insight row between wrap'}><div className="col" style={{ gap: 2 }}><b>Recommendation</b><span className="mute sm">{decision[2]} Thresholds are for the team to agree.</span></div><span className={'pill ' + decision[0]} style={{ fontSize: 14, padding: '8px 14px' }}>{decision[1]}</span></div></section>
    </>
  );
}
