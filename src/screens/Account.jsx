import React, { useState } from 'react';
import { useKey } from '../lib/store.js';
import { useColl, put, audit, resetDemo, conn } from '../lib/db.js';
import { Head, ResetButton } from '../ui.jsx';

export default function Account({ role }) {
  const log = useColl('audit'); const settings = useColl('settings').find(x => x.id === 'main') || { id: 'main', devopsEmail: '', approverEmail: '' };
  const [st] = useKey('ac_status', null); const [f, setF] = useState('All'); const [dv, setDv] = useState(null); const [ap, setAp] = useState(null);
  const shown = [...log].sort((a, b) => b.ts.localeCompare(a.ts)).filter(e => f === 'All' || (f === 'Decisions' && /Approved|Rejected|Reopened|approved|Pilot/.test(e.action)) || (f === 'Work' && /ticket|proposal|Ticket|Proposal|step|live/.test(e.action)) || (f === 'Sign-ins' && /Signed/.test(e.action)));
  const canSet = ['pm', 'head', 'admin'].includes(role.id);
  const saveSet = async () => { await put('settings', { id: 'main', devopsEmail: (dv ?? settings.devopsEmail).trim(), approverEmail: (ap ?? settings.approverEmail).trim() }); await audit(role.name, 'Updated notification settings', 'Account'); setDv(null); setAp(null); };
  const out = () => { audit(role.name, 'Signed out', 'Workspace'); conn.setLocal(); localStorage.removeItem('ac_user'); location.hash = ''; location.reload(); };
  const con = [['Shared storage', st?.storage, 'Tickets and proposals are shared between users and devices.', 'Without it, data stays in this browser only.'], ['Email (Gmail)', st?.email, 'Proposals, tickets and the brief can be emailed.', 'Without it, emails show as previews and nothing is sent.'], ['Voice calls (Vapi)', st?.voice, 'The agent can phone a merchant who asks for a call.', 'Without it, a call shows the script as a preview and nothing is dialled.'], ['Telegram', st?.telegram, 'Alerts and the brief go to the team chat.', 'Without it, Telegram alerts show as previews.']];
  return (
    <>
      <Head help="account" title="Account" sub="Your role, connections, notification settings and a record of every action." right={<button className="btn" onClick={out}>Sign out</button>} />
      <section className="grid2e">
        <div className="card"><span className="eyebrow">Profile</span><div className="row"><span className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52 }}>{role.short}</span><div className="col" style={{ gap: 0 }}><b style={{ fontSize: 18 }}>{role.name}</b><span className="mute sm">{role.email}</span></div></div>
          <div className="list"><div className="row between"><span>Approve or reject findings</span><span className={'pill ' + (role.canApprove ? 'ok' : 'bad')}>{role.canApprove ? 'Allowed' : 'Not allowed'}</span></div><div className="row between"><span>Approve routing changes</span><span className={'pill ' + (role.canApproveRouting ? 'ok' : 'bad')}>{role.canApproveRouting ? 'Allowed' : 'Not allowed'}</span></div><div className="row between"><span>Screens you can open</span><span className="mute sm" style={{ textAlign: 'right' }}>{role.views.join(', ')}</span></div></div>
          <span className="eyebrow">Module access</span><div className="row wrap"><span className={'pill ' + ((role.modules || []).includes('acceptance') ? 'ok' : 'bad')}>Acceptance: {(role.modules || []).includes('acceptance') ? 'on' : 'off'}</span><span className={'pill ' + ((role.modules || []).includes('affordability') ? 'ok' : 'bad')}>Affordability Engine: {(role.modules || []).includes('affordability') ? 'on' : 'off'}</span></div></div>
        <div className="card"><span className="eyebrow">Connections</span><div className="list">{con.map(([n, on, a, b]) => <div key={n} className="row between wrap"><div className="col" style={{ gap: 0, flex: 1, minWidth: 200 }}><b>{n}</b><span className="mute sm">{on ? a : b}</span></div><span className={'pill ' + (on ? 'ok' : 'warn')}>{on ? 'Connected' : 'Not connected'}</span></div>)}</div></div>
      </section>
      <section className="card"><span className="eyebrow">Notification settings</span>
        <div className="grid2e"><label className="field"><span>DevOps team email (default recipient for tickets)</span><input type="text" disabled={!canSet} value={dv ?? settings.devopsEmail} onChange={e => setDv(e.target.value)} placeholder="devops@yourcompany.com" /></label><label className="field"><span>Routing approver email</span><input type="text" disabled={!canSet} value={ap ?? settings.approverEmail} onChange={e => setAp(e.target.value)} placeholder="head@yourcompany.com" /></label></div>
        <div className="row wrap"><button className="btn pri" disabled={!canSet || (dv == null && ap == null)} onClick={saveSet}>Save</button><span className="mute sm">For safety, real email only goes to addresses on the allowed list set up with the server. Other addresses show as blocked.</span></div></section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">Audit log</span><div className="row"><div className="seg">{['All', 'Decisions', 'Work', 'Sign-ins'].map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}</div>{canSet && <ResetButton style={{ minHeight: 34, fontSize: 13 }} onReset={resetDemo} />}</div></div>
        {shown.length === 0 ? <p className="mute">No entries yet.</p> : <table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead><tbody>{shown.slice(0, 120).map(e => <tr key={e.id}><td className="num">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>{e.who}</td><td><b>{e.action}</b></td><td className="mute">{e.target}{e.detail ? ' · ' + e.detail : ''}</td></tr>)}</tbody></table>}</section>
    </>
  );
}
