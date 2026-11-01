import React, { useState } from 'react';
import { useColl, callApi, conn } from '../lib/db.js';
import { buildBrief } from '../lib/brief.js';
import { notify } from '../lib/notify.js';
import { Head } from '../ui.jsx';

export default function Brief({ role }) {
  const tickets = useColl('tickets'), proposals = useColl('proposals'); const b = buildBrief(tickets, proposals);
  const [speaking, setSpeaking] = useState(false); const [msg, setMsg] = useState(null); const [to, setTo] = useState(''); const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = () => { if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; } const u = new SpeechSynthesisUtterance(b.text); u.lang = 'en-IN'; u.rate = 0.98; u.onend = () => setSpeaking(false); setSpeaking(true); speechSynthesis.speak(u); };
  const send = async ch => { setMsg(null); const r = await notify({ kind: 'brief', id: 'brief', to: ch === 'email' ? to.split(/[,;\s]+/).filter(x => x.includes('@')) : [], channels: { [ch]: true }, refId: 'brief' }); setMsg(r); };
  return (
    <>
      <Head title="Morning brief" sub="What needs you today, in one place. Read it aloud, or send it to email or Telegram. A daily copy can go out automatically at 8:00 am." right={canSpeak && <button className="btn pri" onClick={speak}>{speaking ? 'Stop' : 'Read it aloud'}</button>} />
      <section className="card"><h2 style={{ fontSize: 22, letterSpacing: '-.02em' }}>{b.headline}</h2>
        {b.sections.map(s => <div key={s.title} className="col" style={{ gap: 6 }}><span className="eyebrow">{s.title}</span>{s.lines.map((l, i) => <div key={i}>{l}</div>)}</div>)}</section>
      <section className="card"><span className="eyebrow">Send it</span>
        <div className="row wrap"><input type="text" style={{ flex: 1, minWidth: 220 }} placeholder="Email address (must be on the allowed list)" value={to} onChange={e => setTo(e.target.value)} /><button className="btn pri" disabled={!to.includes('@')} onClick={() => send('email')}>Email me the brief</button><button className="btn" onClick={() => send('telegram')}>Send to Telegram</button></div>
        {msg && msg.map((x, i) => <div key={i} className="row wrap sm"><span className={'pill ' + (x.status === 'sent' ? 'ok' : x.status === 'preview' ? 'warn' : 'bad')}>{x.status === 'preview' ? 'Preview only' : x.status}</span><span>{x.channel}</span>{x.note && <span className="mute">{x.note}</span>}</div>)}
        {conn.mode() !== 'server' && <span className="mute sm">Email and Telegram are not connected in this workspace, so sending shows a preview only.</span>}</section>
    </>
  );
}
