import React, { useState } from 'react';
import * as S from '../lib/stats.js';
import { useColl, put, audit, uid } from '../lib/db.js';
import { notify, statusPill, statusText } from '../lib/notify.js';

const partyOf = f => (f.acq != null ? S.ACQ[f.acq] : f.iss != null ? S.ISS[f.iss] : f.inc ? f.inc.acquirer : f.au ? f.au.acquirer : 'the partner');
const money = v => '₹' + Math.round(v).toLocaleString('en-IN');

function presets(kind, f, run) {
  const evidence = run.steps.map(s => '• ' + s.result).join('\n');
  const base = `Finding: ${f.title}\n${f.subtitle}\n\nLikely cause: ${run.finding.cause}\nConfidence: ${run.finding.confidence}\n\nEvidence (computed from data):\n${evidence}\n`;
  if (kind === 'Routing change') { const r = f.route; return { title: `Routing change: ${r.from} to ${r.to}`, priority: 'P2', summary: `Request to route the affected traffic through ${r.to} instead of ${r.from}.\n\nSuccess today: ${r.from} ${r.fromRate}% (n = ${r.fromN}) against ${r.to} ${r.toRate}% (n = ${r.toN}).\nArithmetic only, not a forecast: at those rates, about ${r.implied} fewer failed payments per 30 days.\n\n${base}\nNeeds approval by the Head of Acceptance. DevOps applies the change after approval.` }; }
  if (kind === 'Escalation') return { title: `Escalate to ${partyOf(f)}: ${f.title}`, priority: 'P2', summary: `Please review the following with ${partyOf(f)} and share a root-cause note.\n\n${base}\nRequested action: ${run.finding.action}` };
  return { title: `Investigate: ${f.title}`, priority: f.id === 'f6' ? 'P3' : 'P2', summary: base + `\nRecommended action: ${run.finding.action}` };
}

function TicketForm({ kind, f, run, role, onDone, onCancel }) {
  const p = presets(kind, f, run); const settings = useColl('settings').find(x => x.id === 'main') || {};
  const [title, setTitle] = useState(p.title), [summary, setSummary] = useState(p.summary), [priority, setPriority] = useState(p.priority);
  const [useDev, setUseDev] = useState(true), [extra, setExtra] = useState(''), [email, setEmail] = useState(true), [tg, setTg] = useState(false), [busy, setBusy] = useState(false), [res, setRes] = useState(null);
  const recips = [...(useDev && settings.devopsEmail ? [settings.devopsEmail] : []), ...extra.split(/[,;\s]+/).filter(x => x.includes('@'))];
  const submit = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const t = { id: uid('TCK'), kind, findingId: f.id, title, summary, priority, assignee: kind === 'Escalation' ? partyOf(f) : 'DevOps team', requester: role.name, requesterId: role.id, status: kind === 'Routing change' ? 'Pending approval' : 'Open', recipients: recips, channels: { email, telegram: tg }, route: kind === 'Routing change' ? f.route : null, created: now, ts: now, events: [{ ts: now, who: role.name, text: kind + ' raised' }] };
    await put('tickets', t); await audit(role.name, 'Raised ' + kind.toLowerCase() + ' ticket', f.title, t.id);
    const r = await notify({ kind: 'ticket', id: t.id, to: recips, channels: { email, telegram: tg }, refId: t.id });
    setRes({ id: t.id, r }); setBusy(false); onDone && onDone(t);
  };
  if (res) return (<div className="insight col fade"><b>{res.id} created</b>{res.r.length === 0 && <span className="mute sm">No notification channel was selected.</span>}{res.r.map((x, i) => <div key={i} className="row wrap sm"><span className={'pill ' + statusPill(x.status)}>{statusText(x.status)}</span><span>{x.channel}{x.to ? ' to ' + x.to : ''}</span>{x.note && <span className="mute">{x.note}</span>}</div>)}<div className="row wrap"><a className="btn pri" style={{ display: 'inline-flex', alignItems: 'center' }} href={'#/tickets?id=' + res.id}>Open the ticket</a><button className="btn" onClick={onCancel}>Back to actions</button></div></div>);
  return (
    <div className="col fade" style={{ gap: 12 }}>
      <label className="field"><span>Title</span><input type="text" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="grid2e"><label className="field"><span>Priority</span><select value={priority} onChange={e => setPriority(e.target.value)}><option>P1</option><option>P2</option><option>P3</option></select></label>
        <label className="field"><span>Assigned to</span><input type="text" readOnly value={kind === 'Escalation' ? partyOf(f) : 'DevOps team'} /></label></div>
      <div className="field"><span>Notify</span>
        <label className="row sm"><input type="checkbox" checked={useDev} onChange={e => setUseDev(e.target.checked)} /> DevOps team{settings.devopsEmail ? ' (' + settings.devopsEmail + ')' : ' (no address set. Add one in Account → Notification settings)'}</label>
        <input type="text" placeholder="Other recipients, separated by commas" value={extra} onChange={e => setExtra(e.target.value)} />
        <div className="row wrap"><label className="row sm"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email</label><label className="row sm"><input type="checkbox" checked={tg} onChange={e => setTg(e.target.checked)} /> Telegram</label></div></div>
      <label className="field"><span>Details sent with the ticket</span><textarea value={summary} onChange={e => setSummary(e.target.value)} style={{ minHeight: 220 }} /></label>
      <div className="row wrap"><button className="btn pri" disabled={busy || !title.trim()} onClick={submit}>{busy ? 'Creating…' : 'Create ticket and notify'}</button><button className="btn" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

export default function Actions({ f, run, role }) {
  const [open, setOpen] = useState(null); const tickets = useColl('tickets').filter(t => t.findingId === f.id); const proposals = useColl('proposals');
  const [made, setMade] = useState(null);
  const cand = f.actions.includes('proposal') ? S.proposalCandidates(f.id) : [];
  const createProposals = async () => {
    let n = 0; const now = new Date().toISOString();
    for (const c of cand) { if (proposals.some(p => p.merchantId === c.mi && p.instruments.includes(c.inst) && p.status !== 'not_now')) continue; await put('proposals', { id: uid('PRP'), merchantId: c.mi, instruments: [c.inst], status: 'draft', findingId: f.id, created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Draft created from finding: ' + f.title }] }); n++; }
    await audit(role.name, 'Created draft proposals', f.title, n + ' merchants'); setMade(n);
  };
  const A = { ticket: ['Raise an investigation ticket', 'Creates a ticket for DevOps and notifies them by email or Telegram.', 'Investigation'], routing: ['Request a routing change', f.route ? `Move traffic from ${f.route.from} to ${f.route.to}, the best-suited route today. Needs approval by the Head of Acceptance.` : '', 'Routing change'], escalate: ['Escalate to the partner', `Opens an escalation to ${partyOf(f)} with the evidence attached.`, 'Escalation'] };
  const kinds = f.actions.filter(a => A[a] && (a !== 'routing' || f.route));
  return (
    <section className="card fade" aria-label="Next steps"><span className="eyebrow">What happens next</span>
      <p className="mute sm">Approval is the go-ahead. Choose how it gets acted on. Nothing here touches real payments.</p>
      {open ? <><b>{A[open][0]}</b>{open === 'routing' && f.route && <div className="insight sm"><table><thead><tr><th>Route</th><th>Success</th><th>Payments</th></tr></thead><tbody><tr><td>{f.route.from} (today)</td><td className="num">{f.route.fromRate}%</td><td className="num">{f.route.fromN}</td></tr><tr><td>{f.route.to} (proposed)</td><td className="num">{f.route.toRate}%</td><td className="num">{f.route.toN}</td></tr></tbody></table><span className="mute">Arithmetic, not a forecast: about {f.route.implied} fewer failed payments per 30 days if {f.route.to} keeps its current rate.</span></div>}<TicketForm kind={A[open][2]} f={f} run={run} role={role} onCancel={() => setOpen(null)} /></>
        : <div className="list">
          {kinds.map(a => <div key={a} className="row between wrap"><div className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b>{A[a][0]}</b><span className="mute sm">{A[a][1]}</span></div><button className="btn pri" onClick={() => setOpen(a)}>Start</button></div>)}
          {cand.length > 0 && <div className="row between wrap"><div className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b>Create draft proposals for {cand.length} merchants</b><span className="mute sm">Merchants where it is missing or rarely used. You review and send each one on the Proposals page.</span></div>{made == null ? <button className="btn pri" onClick={createProposals}>Create drafts</button> : <a className="btn pri" style={{ display: 'inline-flex', alignItems: 'center' }} href="#/proposals">{made} drafts created. Open</a>}</div>}
        </div>}
      {tickets.length > 0 && <div className="col" style={{ gap: 6 }}><span className="eyebrow">Tickets for this finding</span>{tickets.map(t => <a key={t.id} className="row between wrap sm" href={'#/tickets?id=' + t.id}><span><b>{t.id}</b> · {t.kind}</span><span className="pill">{t.status}</span></a>)}</div>}
    </section>
  );
}
