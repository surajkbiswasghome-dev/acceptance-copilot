import React, { useEffect, useState } from 'react';
import { Head } from '../ui.jsx';
import { AGENTS, GUARDRAILS, runEvals } from '../lib/agents.js';

const tone = s => (s.startsWith('Live') || s === 'Implemented' ? 'ok' : s.startsWith('Built') ? 'warn' : '');
const missed = () => { try { return JSON.parse(localStorage.getItem('ac_unanswered') || '[]'); } catch { return []; } };
export default function Agents() {
  const [res, setRes] = useState(() => runEvals()); const [open, setOpen] = useState('copilot'); const [miss, setMiss] = useState(missed);
  useEffect(() => { const f = () => setMiss(missed()); addEventListener('focus', f); return () => removeEventListener('focus', f); }, []);
  const by = Object.fromEntries(res.map(r => [r.id, r])); const pass = res.filter(r => r.pass).length; const gr = Object.fromEntries(GUARDRAILS.map(g => [g.id, g]));
  const groups = [...new Set(GUARDRAILS.map(g => g.group))];
  return (<>
    <Head help="agents" title="Agents, evals and guardrails" sub="Every agent in this platform, what it may and may not do, how it is tested, and the guardrails around it. Built means working today; Planned means not built yet." right={<button className="btn pri" onClick={() => setRes(runEvals())}>Run evals again</button>} />
    <div className="chiprow"><span className={'pill ' + (pass === res.length ? 'ok' : 'bad')}>{pass} of {res.length} live evals passing</span><span className="pill">{AGENTS.filter(a => a.status.startsWith('Live')).length} live agents</span><span className="pill">{AGENTS.filter(a => a.status.startsWith('Planned')).length} planned</span><span className="pill ok">{GUARDRAILS.filter(g => g.status === 'Implemented').length} guardrails built</span><span className="pill">{GUARDRAILS.filter(g => g.status === 'Planned').length} planned</span></div>
    <section className="card"><span className="eyebrow">Agents</span>
      <div className="col" style={{ gap: 10 }}>{AGENTS.map(a => { const ev = a.evals.map(i => by[i]).filter(Boolean); const ok = ev.filter(e => e.pass).length; const isOpen = open === a.id;
        return (<div key={a.id} className="insight col" style={{ gap: 10 }}>
          <button className="row between wrap" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', padding: 0, width: '100%' }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : a.id)}>
            <span className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b style={{ fontSize: 16 }}>{a.name}</b><span className="mute sm">{a.kind}</span></span>
            <span className="row wrap"><span className={'pill ' + tone(a.status)}>{a.status}</span>{a.evals.length > 0 && <span className={'pill ' + (ok === ev.length ? 'ok' : 'bad')}>Evals {ok}/{ev.length}</span>}<span className="pill">{a.guard.length} guardrails</span></span></button>
          {isOpen && <div className="col fade" style={{ gap: 12 }}>
            <p style={{ margin: 0 }}>{a.does}</p>
            <div className="grid2e"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Reads</span><span className="sm">{a.inputs}</span></div><div className="col" style={{ gap: 2 }}><span className="eyebrow">Model</span><span className="sm">{a.model}</span></div></div>
            <div className="col" style={{ gap: 2 }}><span className="eyebrow">How much it can do on its own</span><span className="sm">{a.autonomy}</span></div>
            <div className="col" style={{ gap: 6 }}><span className="eyebrow">Guardrails</span><div className="row wrap">{a.guard.map(g => <span key={g} className={'pill ' + tone(gr[g].status)} title={gr[g].how}>{gr[g].name}{gr[g].status === 'Planned' ? ' (planned)' : ''}</span>)}</div></div>
            <div className="col" style={{ gap: 6 }}><span className="eyebrow">Evals</span>{ev.length ? <table><tbody>{ev.map(e => <tr key={e.id}><td style={{ width: 52 }}><span className={'pill ' + (e.pass ? 'ok' : 'bad')}>{e.pass ? 'Pass' : 'Fail'}</span></td><td>{e.name}</td><td className="mute sm">{e.detail}</td></tr>)}</tbody></table> : <span className="mute sm">None yet. Planned agents need evals written before they are built.</span>}</div>
            {a.next && <div className="col" style={{ gap: 2 }}><span className="eyebrow">Next</span><span className="sm">{a.next}</span></div>}
          </div>}
        </div>); })}</div></section>
    <section className="card"><span className="eyebrow">Guardrails across the platform</span>
      {groups.map(g => <div key={g} className="col" style={{ gap: 6 }}><b>{g}</b><table><tbody>{GUARDRAILS.filter(x => x.group === g).map(x => <tr key={x.id}><td style={{ width: 96 }}><span className={'pill ' + tone(x.status)}>{x.status}</span></td><td><b>{x.name}</b><div className="mute sm">{x.how}{x.where ? ' · ' + x.where : ''}</div></td></tr>)}</tbody></table></div>)}</section>
    <section className="card"><span className="eyebrow">Checked on every build, outside the app</span><p className="mute sm" style={{ margin: 0 }}>Unit tests on the data, the questions, the welcome and the proposals, plus end-to-end checks of email, Telegram, call preview, roles and four-eyes approval run before each release. They are run by the team, not from this screen.</p></section>
    <section className="card"><div className="row between wrap"><span className="eyebrow">Questions the Copilot could not answer, and why</span>{miss.length > 0 && <button className="btn" style={{ minHeight: 32, fontSize: 13 }} onClick={() => { try { localStorage.removeItem('ac_unanswered'); } catch (e) {} setMiss([]); }}>Clear</button>}</div>
      {miss.length === 0 ? <p className="mute sm" style={{ margin: 0 }}>None recorded in this browser. When the Copilot declines or cannot map a question, it appears here with the reason, so a gap can become a new eval.</p> : <table><thead><tr><th>Question</th><th>Why</th><th>Screen</th></tr></thead><tbody>{miss.map((m, i) => <tr key={i}><td>{m.q}</td><td className="mute sm">{m.reason}</td><td className="mute sm">{m.screen}</td></tr>)}</tbody></table>}</section>
  </>);
}
