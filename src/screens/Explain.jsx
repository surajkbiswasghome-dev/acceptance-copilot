import React, { useEffect, useRef, useState } from 'react';
import * as S from '../lib/stats.js';
import { offlineAgent, offlineAnswer } from '../lib/agent.js';
import { useColl, put, del, audit } from '../lib/db.js';
import Actions from './Actions.jsx';
import { Head, AiTag, Tick, Gate, Mic } from '../ui.jsx';

async function callAgent(payload) {
  try {
    const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(50000) });
    if (!r.ok) throw new Error('server answered HTTP ' + r.status);
    const j = await r.json(); if (!j || j.error) throw new Error('server returned an unreadable answer'); return j;
  } catch (e) {
    const reason = e?.name === 'TimeoutError' ? 'The model took too long to answer, so the rules-based explanation is shown' : 'Could not reach the agent endpoint: ' + (e.message || e);
    return payload.question ? { ...offlineAnswer(payload.question), mode: 'offline', reason } : { ...offlineAgent(payload.id), reason };
  }
}
const fromHash = () => (location.hash.split('?id=')[1] || 'f1').split('&')[0];

export default function Explain({ role }) {
  const items = React.useMemo(() => S.findings(), []);
  const [id, setId] = useState(fromHash());
  const decisions = useColl('decisions'); const dec = Object.fromEntries(decisions.map(x => [x.id, x.status]));
  const [run, setRun] = useState(null); const [shown, setShown] = useState(0); const [err, setErr] = useState(false);
  const [q, setQ] = useState(''); const [qa, setQa] = useState([]); const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => { const f = () => setId(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => {
    const my = ++seq.current; setShown(0); setErr(false);
    const local = offlineAgent(id); // evidence comes from code, so it can show at once
    setRun({ steps: local.steps, pending: true }); local.steps.forEach((_, i) => setTimeout(() => my === seq.current && setShown(i + 1), 350 * (i + 1)));
    callAgent({ id }).then(r => { if (my === seq.current) setRun({ ...r, steps: local.steps, pending: false }); }).catch(() => { if (my === seq.current) setRun({ ...local, pending: false, reason: 'The agent could not run, so the rules-based explanation is shown' }); });
  }, [id]);
  const item = items.find(f => f.id === id) || items[0];
  const d = dec[item.id]; const stepsDone = run && shown >= run.steps.length; const done = stepsDone && !run.pending; const waiting = stepsDone && run.pending;
  const decide = v => { put('decisions', { id: item.id, status: v, by: role.name, ts: new Date().toISOString() }); audit(role.name, v === 'approved' ? 'Approved' : 'Rejected', item.title, run?.finding?.action || ''); };
  const reopen = () => { del('decisions', item.id); audit(role.name, 'Reopened', item.title); };
  const ask = async text => { const t = (text ?? q).trim(); if (!t) return; setBusy(true); setQ(''); const r = await callAgent({ question: t }); setQa(a => [{ q: t, a: r.answer, tool: r.tool || r.steps?.[0]?.tool, mode: r.mode }, ...a]); setBusy(false); };
  return (
    <>
      <Head title="Explain" sub="The agent picks tools, reads computed evidence, and proposes a cause and an action. A person decides." right={run && (run.pending ? <span className="pill">Reading the evidence…</span> : <span className="pill" title={run.mode === 'live' ? 'Explained by Gemini using the tools below' : 'Gemini is not connected, so a rules-based explanation is shown'}>{run.mode === 'live' ? 'Live model' : 'Offline rules mode'}</span>)} />
      {run && !run.pending && run.mode !== 'live' && run.reason && <div className="banner">Why offline: {run.reason}</div>}
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', alignItems: 'start' }}>
        <div className="col queue" aria-label="Findings queue">{items.map(f => <button key={f.id} className={f.id === item.id ? 'on' : ''} onClick={() => { location.hash = '#/explain?id=' + f.id; setId(f.id); }}><span className="row between"><Gate g={f.gate} />{dec[f.id] && <span className={'pill ' + (dec[f.id] === 'approved' ? 'ok' : 'bad')}>{dec[f.id]}</span>}</span><b>{f.title}</b><span className="mute sm">{f.impact}</span></button>)}</div>
        <div className="col gap16">
          <div className="col" style={{ gap: 8 }}><AiTag /><h2 style={{ fontSize: 26, letterSpacing: '-.025em' }}>{item.title}</h2><p className="mute num sm">{item.subtitle}</p></div>
          <section className="card" aria-label="How the agent worked it out"><span className="eyebrow">How the agent worked it out</span>
            {err && <div className="err">The agent could not run. Try again.</div>}
                        {run && <ol className="steps">{run.steps.slice(0, shown).map((s, i) => <li key={i} className="fade"><Tick /><div className="col" style={{ gap: 5, minWidth: 0 }}><span className="chip">{s.tool}</span><span style={{ fontSize: 14 }}>{s.result}</span></div></li>)}</ol>}
          </section>
          {waiting && <section className="card fade" aria-label="Finding"><span className="eyebrow">Finding</span><span className="row" style={{ gap: 10 }}><span className="mute">Reading the evidence and writing the explanation…</span></span><div className="col"><div className="skel" style={{ width: '85%' }} /><div className="skel" style={{ width: '60%' }} /></div><span className="mute sm">If the model is slow, a rules-based explanation appears automatically.</span></section>}
          {done && <section className="card fade" aria-label="Finding"><span className="eyebrow">Finding</span>
            <div className="col" style={{ gap: 4 }}><span className="eyebrow" style={{ fontSize: 11 }}>Likely cause</span><b style={{ fontSize: 17, letterSpacing: '-.01em' }}>{run.finding.cause}</b></div>
            <div className="col" style={{ gap: 6 }}><span className="eyebrow" style={{ fontSize: 11 }}>Confidence</span><span className="row"><span className="row" style={{ gap: 4 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 24, height: 6, borderRadius: 99, background: i <= ['Low', 'Medium', 'High'].indexOf(run.finding.confidence) ? 'var(--acc)' : 'var(--s2)' }} />)}</span><b>{run.finding.confidence}</b></span></div>
            <div className="insight col" style={{ gap: 4 }}><span className="eyebrow" style={{ fontSize: 11 }}>Recommended action</span><span>{run.finding.action}</span></div>
            {!d ? <div className="col"><div className="row"><button className="btn pri" disabled={!role.canApprove} onClick={() => decide('approved')}>Approve</button><button className="btn" disabled={!role.canApprove} onClick={() => decide('rejected')}>Reject</button></div>
              <span className="mute sm">{role.canApprove ? 'A person decides. Nothing changes until you approve.' : 'Your role cannot approve actions. Ask the Acceptance PM.'}</span></div>
              : <div className="row wrap"><span className={'pill ' + (d === 'approved' ? 'ok' : 'bad')} style={{ fontSize: 14, padding: '8px 14px' }}>{d === 'approved' ? 'Approved and recorded' : 'Rejected and recorded'}</span><button className="btn" style={{ border: 0, textDecoration: 'underline', color: 'var(--mute)' }} onClick={reopen}>Reopen decision</button></div>}
          </section>}
          {done && d === 'approved' && <Actions f={item} run={run} role={role} />}
          <section className="col" aria-label="Ask a follow-up"><label htmlFor="ask" className="sm mute" style={{ fontWeight: 600 }}>Ask Copilot</label>
            <form className="row" onSubmit={e => { e.preventDefault(); ask(); }}><input id="ask" type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="For example: which issuer is declining the most?" /><Mic onText={t => ask(t)} /><button className="btn pri" disabled={busy}>{busy ? '…' : 'Ask'}</button></form>
            {qa.map((x, i) => <div key={i} className="insight col fade" style={{ gap: 4 }}><span className="sm mute">{x.q}</span><span>{x.a}</span>{x.tool && <span className="chip">{x.tool}</span>}</div>)}
          </section>
        </div>
      </div>
    </>
  );
}
