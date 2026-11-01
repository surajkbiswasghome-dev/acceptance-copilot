import React, { useMemo } from 'react';
import * as S from '../lib/stats.js';
import { useKey, audit } from '../lib/store.js';
import { Head } from '../ui.jsx';

export default function Pilot({ role }) {
  const cohort = useMemo(() => S.pilotCohort(8), []);
  const [st, setSt] = useKey('ac_pilot', { status: 'planned' }); const status = st.status || 'planned';
  const rows = S.TX.filter(t => cohort.some(m => m.id === t.m));
  const base = { n: rows.length, success: S.rate(rows), share: Math.round(1000 * rows.filter(t => t.inst === 5).length / rows.length) / 10 };
  const go = (next, label) => { setSt({ status: next }); audit(role.name, label, 'Pilot'); };
  const tag = { planned: ['warn', 'Planned, not launched'], running: ['ok', 'Running'], paused: ['bad', 'Paused'] }[status];
  return (
    <>
      <Head title="Pilot" sub="The smallest test that shows whether the copilot’s recommendations help." right={<span className="pill warn">Plan, not a result</span>} />
      <section className="grid4">{[['Cohort', cohort.length + ' merchants', 'chosen by rules from the data'], ['Duration', '8 weeks', '2 to baseline, 6 live'], ['Baseline success', base.success + '%', 'cohort, last 30 days'], ['Baseline share', base.share + '%', 'UPI + RuPay credit in cohort']].map(([a, b, c]) => <div className="card kpi" key={a}><span className="eyebrow">{a}</span><b className="num">{b}</b><small>{c}</small></div>)}</section>
      <section className="grid2e">
        <div className="card"><span className="eyebrow">Scope</span><div className="list"><div><b>Phase 1 (this pilot): UPI + RuPay credit</b><p className="mute sm">Enable it where missing, and test a checkout prompt and offer where it is enabled but rarely used.</p></div><div><b>Phase 2, after phase 1 passes its gates: UPI + credit line</b><p className="mute sm">Credit line is just as important in the JD. It is sequenced second because it is rarely used at high tickets today, and its eligibility and discovery friction needs its own test.</p></div></div></div>
        <div className="card"><span className="eyebrow">What we measure</span><div className="list"><div><b>Primary</b><p className="mute sm">Share of cohort payments made with UPI + RuPay credit, against the same merchants’ own baseline.</p></div><div><b>Secondary</b><p className="mute sm">Cohort success rate and decline mix.</p></div><div><b>Guardrail</b><p className="mute sm">Overall success must not fall by more than 1 point. If it does, pause.</p></div></div></div>
      </section>
      <section className="card"><span className="eyebrow">Cohort</span><table><thead><tr><th>Merchant</th><th>Category</th><th>Acquirer</th><th>UPI + RuPay credit</th></tr></thead><tbody>{cohort.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.category}</td><td>{m.acquirer}</td><td><span className={'pill ' + (m.enabled[5] ? 'ok' : 'warn')}>{m.enabled[5] ? 'Enabled, low use' : 'To enable'}</span></td></tr>)}</tbody></table></section>
      <section className="card"><span className="eyebrow">Scale gates (thresholds to be agreed with the team)</span><div className="grid4" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}><div><b>1. Coverage</b><p className="mute sm">Instrument enabled and tested at every cohort merchant.</p></div><div><b>2. Experience</b><p className="mute sm">Success holds within the guardrail for 4 straight weeks.</p></div><div><b>3. Preference</b><p className="mute sm">Share rises against baseline, and merchants want to continue.</p></div></div></section>
      <section className="card"><div className="row between wrap"><div className="col" style={{ gap: 4 }}><span className="eyebrow">Launch and kill-switch</span><span className={'pill ' + tag[0]} style={{ alignSelf: 'flex-start' }}>{tag[1]}</span></div>
        <div className="row">{status === 'planned' && <button className="btn pri" disabled={!role.canApprove} onClick={() => go('running', 'Pilot launched')}>Launch pilot</button>}{status === 'running' && <button className="btn" onClick={() => go('paused', 'Pilot paused (kill-switch)')}>Pause pilot</button>}{status === 'paused' && <button className="btn pri" onClick={() => go('running', 'Pilot resumed')}>Resume pilot</button>}</div></div>
        <span className="mute sm">{status === 'planned' ? (role.canApprove ? 'Launching records the decision in the audit log.' : 'Only the Acceptance PM can launch the pilot.') : 'A person can pause at any time.'} This prototype does not touch real payments.</span></section>
    </>
  );
}
