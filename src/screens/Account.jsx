import React, { useState } from 'react';
import { useKey, audit, resetDemo } from '../lib/store.js';
import { Head } from '../ui.jsx';

export default function Account({ role }) {
  const [log] = useKey('ac_audit', []); const [f, setF] = useState('All');
  const shown = log.filter(e => f === 'All' || (f === 'Decisions' && /Approved|Rejected|Reopened/.test(e.action)) || (f === 'Sign-ins' && /Signed/.test(e.action)));
  const out = () => { audit(role.name, 'Signed out', 'Workspace'); localStorage.removeItem('ac_user'); location.hash = ''; location.reload(); };
  return (
    <>
      <Head title="Account" sub="Your role, what it allows, and a record of every decision." right={<button className="btn" onClick={out}>Sign out</button>} />
      <section className="grid2e">
        <div className="card"><span className="eyebrow">Profile</span><div className="row"><span className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52 }}>{role.short}</span><div className="col" style={{ gap: 0 }}><b style={{ fontSize: 18 }}>{role.name}</b><span className="mute sm">{role.email}</span></div></div>
          <div className="list"><div className="row between"><span>Approve or reject actions</span><span className={'pill ' + (role.canApprove ? 'ok' : 'bad')}>{role.canApprove ? 'Allowed' : 'Not allowed'}</span></div><div className="row between"><span>Run checklists and draft messages</span><span className="pill ok">Allowed</span></div><div className="row between"><span>Change data or send messages</span><span className="pill bad">Not allowed</span></div></div></div>
        <div className="card"><span className="eyebrow">Guardrails</span><ul className="col mute" style={{ margin: 0, paddingLeft: 18, gap: 8 }}><li>Every number is computed in code from synthetic data.</li><li>The AI explains and recommends. It never changes anything.</li><li>A person approves, and the decision is logged.</li><li>Simulations are labelled and make no promises.</li><li>No real payments, accounts or NPCI systems are connected.</li></ul></div>
      </section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">Audit log</span><div className="row"><div className="seg">{['All', 'Decisions', 'Sign-ins'].map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}</div><button className="btn" style={{ minHeight: 34, fontSize: 13 }} onClick={() => resetDemo()}>Reset demo</button></div></div>
        {shown.length === 0 ? <p className="mute">No entries yet. Approve or reject a finding on the Explain screen.</p> : <table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead><tbody>{shown.map((e, i) => <tr key={i}><td className="num">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>{e.who}</td><td><b>{e.action}</b></td><td className="mute">{e.target}{e.detail ? ' · ' + e.detail : ''}</td></tr>)}</tbody></table>}</section>
    </>
  );
}
