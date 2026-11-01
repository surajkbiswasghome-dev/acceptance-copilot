import React, { useEffect, useRef, useState } from 'react';
import { useColl } from './lib/db.js';
import { welcomeLines, reply, SUGGESTIONS } from './lib/assistant.js';
import { speak, stopSpeech } from './lib/speech.js';
import { Logo } from './ui.jsx';

const useCtx = () => ({ decisions: useColl('decisions'), tickets: useColl('tickets'), proposals: useColl('proposals') });

export function Welcome({ name, role, onClose, onAsk }) {
  const ctx = useCtx(); const w = welcomeLines(name, ctx); const [muted, setMuted] = useState(false); const [talking, setTalking] = useState(false);
  const say = () => { setTalking(true); speak(w.parts, () => setTalking(false)); };
  useEffect(() => { say(); return () => stopSpeech(); }, []);
  const close = () => { stopSpeech(); onClose(); };
  return (<div className="welcome-bg" role="dialog" aria-label="Welcome" onClick={close}><div className="welcome" onClick={e => e.stopPropagation()}>
    <div className={'orb' + (talking ? ' talk' : '')}><Logo size={34} /></div>
    <h2>{w.l1}</h2><p>{w.l2}</p>
    <div className="row wrap" style={{ justifyContent: 'center' }}>{['Today’s update', 'Which tabs should I visit today?'].map(t => <button key={t} className="btn" onClick={() => { stopSpeech(); onAsk(t); }}>{t}</button>)}<button className="btn pri" onClick={close}>Start with Insights</button></div>
    <div className="row" style={{ justifyContent: 'center' }}><button className="btn" style={{ minHeight: 34, fontSize: 13 }} onClick={() => { if (talking) { stopSpeech(); setTalking(false); } else say(); }}>{talking ? 'Stop voice' : 'Play voice again'}</button></div>
  </div></div>);
}

export function Chat({ role, open, setOpen, seed }) {
  const ctx = useCtx(); const [msgs, setMsgs] = useState([]); const [q, setQ] = useState(''); const end = useRef(null);
  const ask = text => { const t = (text ?? q).trim(); if (!t) return; setQ(''); const r = reply(t, ctx, role); setMsgs(m => [...m, { me: true, text: t }, { text: r.text, links: r.links, chips: r.chips }]); };
  useEffect(() => { if (seed) { setOpen(true); ask(seed.text); } }, [seed]);
  useEffect(() => { end.current && end.current.scrollIntoView({ block: 'end' }); }, [msgs, open]);
  if (!open) return <button className="chatfab" aria-label="Ask Copilot" onClick={() => setOpen(true)}><Logo size={22} /><span>Ask Copilot</span></button>;
  return (<aside className="chat" aria-label="Copilot chat"><div className="row between"><b>Copilot</b><button className="iconbtn" style={{ width: 32, height: 32 }} aria-label="Close chat" onClick={() => setOpen(false)}>×</button></div>
    <div className="chatlog">{msgs.length === 0 && <div className="mute sm">Ask about this platform, today’s update, or your acceptance data.</div>}
      {msgs.map((m, i) => (<div key={i} className={'bub' + (m.me ? ' me' : '')}>{m.text.split('\n').map((l, k) => <div key={k}>{l}</div>)}{m.links && m.links.length > 0 && <div className="row wrap" style={{ marginTop: 6 }}>{m.links.map(l => <a key={l.href} className="btn" style={{ minHeight: 30, fontSize: 12.5, padding: '0 12px' }} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}</div>}{m.chips && <div className="row wrap" style={{ marginTop: 6 }}>{SUGGESTIONS.map(s => <button key={s} className="btn" style={{ minHeight: 30, fontSize: 12.5 }} onClick={() => ask(s)}>{s}</button>)}</div>}</div>))}<div ref={end} /></div>
    <div className="row wrap">{msgs.length === 0 && SUGGESTIONS.map(s => <button key={s} className="btn" style={{ minHeight: 30, fontSize: 12.5 }} onClick={() => ask(s)}>{s}</button>)}</div>
    <form className="row" onSubmit={e => { e.preventDefault(); ask(); }}><input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask Copilot…" aria-label="Ask Copilot" /><button className="btn pri" type="submit">Ask</button></form></aside>);
}
