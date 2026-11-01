import React, { useEffect, useState } from 'react';
import { useColl, put, audit } from '../lib/db.js';
import { statusPill, statusText } from '../lib/notify.js';
import { Head } from '../ui.jsx';

const fromHash = () => (location.hash.split('?id=')[1] || '').split('&')[0] || null;
const tone = s => (/Closed|Applied/.test(s) ? 'ok' : /Rejected/.test(s) ? 'bad' : /Pending|Open|awaiting/.test(s) ? 'warn' : '');
// What each role can do next on a ticket
function moves(t, role) {
  const m = []; const staff = ['pm', 'head'].includes(role.id); const dev = role.id === 'dev';
  if (t.kind === 'Routing change') {
    if (t.status === 'Pending approval' && role.canApproveRouting) { if (t.requesterId === role.id) return [{ note: 'You raised this request. A second person has to approve it.' }]; m.push({ label: 'Approve routing change', to: 'Approved, ready to apply', pri: 1 }, { label: 'Reject', to: 'Rejected' }); }
    if (t.status === 'Approved, ready to apply' && (dev || role.canApproveRouting)) m.push({ label: 'Mark as applied', to: 'Applied', pri: 1 });
    if (t.status === 'Applied' && staff) m.push({ label: 'Verify and close', to: 'Closed', pri: 1 });
  } else {
    if (t.status === 'Open' && dev) m.push({ label: 'Acknowledge', to: 'Acknowledged', pri: 1 });
    if (['Open', 'Acknowledged'].includes(t.status) && dev) m.push({ label: 'Start investigating', to: 'Investigating' });
    if (t.status === 'Investigating' && dev) m.push({ label: 'Mark fixed', to: 'Fixed, awaiting verification', pri: 1 });
    if (t.status === 'Fixed, awaiting verification' && staff) m.push({ label: 'Verify and close', to: 'Closed', pri: 1 }, { label: 'Reopen', to: 'Investigating' });
    if (t.status === 'Closed' && staff) m.push({ label: 'Reopen', to: 'Investigating' });
  }
  return m;
}
export default function Tickets({ role }) {
  const all = useColl('tickets'); const notes = useColl('notifications');
  const [sel, setSel] = useState(fromHash()); const [fs, setFs] = useState('Open work'); const [comment, setComment] = useState('');
  useEffect(() => { const f = () => setSel(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const rows = [...all].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).filter(t => fs === 'All' || (fs === 'Open work' ? !['Closed', 'Rejected'].includes(t.status) : t.kind === fs));
  const t = all.find(x => x.id === sel);
  const act = async (to) => { const now = new Date().toISOString(); await put('tickets', { ...t, status: to, ts: t.ts, events: [...t.events, { ts: now, who: role.name, text: 'Status changed to ' + to }] }); await audit(role.name, 'Ticket ' + to, t.title, t.id); };
  const addComment = async () => { if (!comment.trim()) return; await put('tickets', { ...t, events: [...t.events, { ts: new Date().toISOString(), who: role.name, text: comment.trim() }] }); setComment(''); };
  return (
    <>
      <Head title="Tickets" sub="Investigations, routing changes and escalations raised from approved findings. DevOps works them here." right={<div className="seg">{['Open work', 'All', 'Investigation', 'Routing change', 'Escalation'].map(x => <button key={x} className={fs === x ? 'on' : ''} onClick={() => setFs(x)}>{x}</button>)}</div>} />
      <div className="grid2 split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', alignItems: 'start' }}>
        <section className="card"><span className="eyebrow">{rows.length} ticket{rows.length === 1 ? '' : 's'}</span>
          {rows.length === 0 ? <p className="mute">Nothing here yet. Approve a finding on the Explain screen, then raise a ticket.</p> :
            <table><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th></tr></thead><tbody>{rows.map(x => <tr key={x.id} className="tr" onClick={() => { setSel(x.id); history.replaceState(null, '', '#/tickets?id=' + x.id); }} style={{ outline: x.id === sel ? '2px solid var(--acc)' : 'none', outlineOffset: -2 }}><td><b>{x.id}</b> · {x.kind}<div className="mute sm">{x.title}</div></td><td><span className={'pill ' + tone(x.status)}>{x.status}</span></td><td>{x.priority}</td></tr>)}</tbody></table>}
        </section>
        {t ? <section className="card fade"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">{t.id} · {t.kind}</span><h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{t.title}</h2></div><span className={'pill ' + tone(t.status)}>{t.status}</span></div>
          <div className="chiprow"><span className="tag">Priority {t.priority}</span><span className="tag">Assigned to {t.assignee}</span><span className="tag">Raised by {t.requester}</span></div>
          <div className="insight sm" style={{ whiteSpace: 'pre-line' }}>{t.summary}</div>
          {moves(t, role).map((m, i) => m.note ? <span key={i} className="mute sm">{m.note}</span> : null)}
          <div className="row wrap">{moves(t, role).filter(m => m.label).map(m => <button key={m.label} className={'btn' + (m.pri ? ' pri' : '')} onClick={() => act(m.to)}>{m.label}</button>)}</div>
          {t.kind === 'Routing change' && <span className="mute sm">Approving records the decision. DevOps applies the change in the routing system. This prototype does not change real routing.</span>}
          <span className="eyebrow">Notifications</span>{notes.filter(n => n.refId === t.id).length === 0 ? <span className="mute sm">None recorded.</span> : notes.filter(n => n.refId === t.id).map(n => <div key={n.id} className="row wrap sm"><span className={'pill ' + statusPill(n.status)}>{statusText(n.status)}</span><span>{n.channel}{n.to ? ' to ' + n.to : ''}</span>{n.note && <span className="mute">{n.note}</span>}</div>)}
          <span className="eyebrow">Activity</span><ul className="timeline">{[...t.events].reverse().map((e, i) => <li key={i}><b>{e.who}</b> · <span className="mute">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><div>{e.text}</div></li>)}</ul>
          <div className="row"><input type="text" placeholder="Add a comment" value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} /><button className="btn" onClick={addComment}>Add</button></div>
          {t.findingId && <a className="mute sm" href={'#/explain?id=' + t.findingId}>View the finding behind this ticket</a>}
        </section> : <section className="card"><p className="mute">Select a ticket to see its details and next steps.</p></section>}
      </div>
    </>
  );
}
