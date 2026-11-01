import React, { useState } from 'react';
import { ROLES } from '../lib/roles.js';
import { conn } from '../lib/db.js';
import { Logo } from '../ui.jsx';
import { matrix, statusOf } from '../lib/stats.js';
import { useKey } from '../lib/store.js';
export default function Login({ onLogin, theme, setTheme }) {
  const [i, setI] = useState(0); const r = ROLES[i]; const [pw, setPw] = useState('demo-demo-demo'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [, setStatus] = useKey('ac_status', null);
  const cells = matrix().flat().slice(0, 21);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: r.email, password: pw }) });
      if (res.status === 401) { setErr('Wrong password for this workspace.'); setBusy(false); return; }
      const j = res.ok ? await res.json() : { mode: 'local' };
      if (j.mode === 'server') conn.setServer(j.token); else conn.setLocal();
      setStatus(j.status || null);
    } catch { conn.setLocal(); setStatus(null); }
    setBusy(false); onLogin(r);
  };
  return (
    <div className="login">
      <div className="l">
        <div className="row"><Logo size={32} /><b style={{ fontSize: 17 }}>Acceptance Copilot</b></div>
        <div className="col" style={{ gap: 18 }}>
          <h1>See where acceptance leaks.</h1>
          <p className="mute" style={{ maxWidth: '46ch', fontSize: 17 }}>It turns acceptance data into a prioritised, approvable action plan, and a small pilot tests whether it works.</p>
          <div className="tiles" aria-hidden="true">{cells.map((c, k) => { const s = statusOf(c.rate); return <i key={k} style={{ background: `color-mix(in srgb, var(--${s}) ${s === 'ok' ? 16 : 30}%, var(--s1))`, borderColor: `color-mix(in srgb, var(--${s}) 38%, var(--line))` }} />; })}</div>
        </div>
        <ul className="mute sm" style={{ margin: 0, paddingLeft: 18 }}><li>Numbers are computed in code. The AI explains and recommends.</li><li>A person approves every action, and it is logged.</li><li>Synthetic data only. No real payments or accounts.</li></ul>
      </div>
      <div className="r">
        <div className="row between"><div className="col" style={{ gap: 2 }}><h2 style={{ fontSize: 24, letterSpacing: '-.02em' }}>Sign in</h2><span className="mute sm">Choose a demo account</span></div><button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Ivory & Ink' : 'Midnight'}</button></div>
        <div className="col" role="group" aria-label="Demo accounts">{ROLES.map((x, k) => <button key={x.id} className={'role' + (k === i ? ' on' : '')} aria-pressed={k === i} onClick={() => setI(k)}><span className="av">{x.short}</span><span className="col" style={{ gap: 0 }}><b>{x.name}</b><span className="mute sm">{x.sub}</span></span></button>)}</div>
        <label className="col" style={{ gap: 4 }}><span className="sm mute">Email</span><input type="email" readOnly value={r.email} /></label>
        <label className="col" style={{ gap: 4 }}><span className="sm mute">Password</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} /></label>
        {err && <div className="err sm">{err}</div>}
        <button className="btn pri" style={{ minHeight: 50, fontSize: 16 }} disabled={busy} onClick={go}>{busy ? 'Signing in…' : 'Continue to workspace'}</button>
        <p className="mute sm">Demo workspace. No real accounts or payment data.</p>
      </div>
    </div>
  );
}
