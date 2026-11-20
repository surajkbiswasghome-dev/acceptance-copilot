import React, { useState } from 'react';
import { ROLES } from '../lib/roles.js';
import { Logo } from '../ui.jsx';
import { Flow, Facts, News, SigningIn } from '../LoginStage.jsx';
import { Control2, Journey2 } from '../LoginStage2.jsx';
import { prepareVoice } from '../lib/speech.js';
import { conn, load, getAll } from '../lib/db.js';
import { LANGS, DEFAULT_LANG } from '../lib/lang.js';
import { useKey } from '../lib/store.js';
export default function Login({ onLogin, theme, setTheme }) {
  const [i, setI] = useState(0); const r = ROLES[i]; const [pw, setPw] = useState('demo-demo-demo'); const [nm, setNm] = useState(() => { try { return localStorage.getItem('ac_name') || 'Suraj'; } catch { return 'Suraj'; } }); const [lang, setLang] = useState({}); const L = lang[r.id] || (() => { try { return localStorage.getItem('ac_lang_' + r.id); } catch { return null; } })() || DEFAULT_LANG[r.id] || 'en'; const [greet, setGreet] = useState(() => { try { return localStorage.getItem('ac_greet') !== 'off'; } catch { return true; } }); const [steps, setSteps] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [, setStatus] = useKey('ac_status', null);
  const [ls, setLs] = useKey('ac_loginstyle', 1);
    const go = async () => {
    setBusy(true); setErr(''); const S3 = (a, b, c) => setSteps([['Signing you in', a], ['Loading your workspace', b], ...(greet ? [['Preparing your welcome voice', c]] : [])]); S3('run', 'todo', 'todo');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: r.email, password: pw }) });
      if (res.status === 401) { setErr('Wrong password for this workspace.'); setBusy(false); setSteps(null); return; }
      const j = res.ok ? await res.json() : { mode: 'local' };
      if (j.mode === 'server') conn.setServer(j.token); else conn.setLocal();
      setStatus(j.status || null);
    } catch { conn.setLocal(); setStatus(null); }
    try { localStorage.setItem('ac_name', nm.trim() || 'Suraj'); localStorage.setItem('ac_lang_' + r.id, L); sessionStorage.setItem('ac_welcome_lang', L); localStorage.setItem('ac_greet', greet ? 'on' : 'off'); } catch {}
    S3('done', 'run', 'todo'); try { await Promise.all(['decisions', 'tickets', 'proposals'].map(load)); } catch {}
    // Make the welcome voice now, while the infographics play, so it is ready the moment the workspace opens.
    S3('done', 'done', 'run');
    if (greet) try { const [{ welcomeLines }, { LANGS: LG }] = await Promise.all([import('../lib/assistant.js'), import('../lib/lang.js')]); const w = welcomeLines(nm.trim() || 'Suraj', { decisions: getAll('decisions'), tickets: getAll('tickets'), proposals: getAll('proposals') }, new Date(), L); await prepareVoice(w.parts.map(p => p.text).join(' '), LG.find(x => x.id === L).tag, 14000); } catch {}
    S3('done', 'done', 'done'); await new Promise(x => setTimeout(x, 350)); setBusy(false); setSteps(null); onLogin(r, greet);
  };
  return (
    <div className="login">
      {steps && (ls === 2 ? <Journey2 steps={steps} /> : <SigningIn steps={steps} />)}
      <div className="l">
        <div className="row"><Logo size={30} /><b style={{ fontSize: 17 }}>Manthan Acceptance Copilot</b></div>
        <div className="col" style={{ gap: 8 }}>
          <h1>{ls === 2 ? 'Every approval, in one view.' : 'See where acceptance leaks.'}</h1>
          <p className="mute" style={{ maxWidth: '54ch', fontSize: 15, margin: 0 }}>It turns acceptance data into a prioritised, approvable action plan. A person approves every action, and it is logged.</p>
        </div>
        {ls === 2 ? <Control2 /> : <><Flow />
        <News compact /></>}
        <div className="mute sm">Numbers are computed in code; the AI explains and recommends. Synthetic data only.</div>
      </div>
      <div className="r">
        <div className="row between"><div className="col" style={{ gap: 2 }}><h2 style={{ fontSize: 22, letterSpacing: '-.02em' }}>Sign in</h2><span className="mute sm">Choose a demo account</span></div><span className="row" style={{ gap: 6 }}><button className="btn" style={{ minHeight: 36 }} aria-label={'Login style ' + (ls === 2 ? 2 : 1) + ', switch'} onClick={() => setLs(ls === 2 ? 1 : 2)}>Style {ls === 2 ? '2' : '1'}</button><button className="btn" style={{ minHeight: 36 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Ivory & Ink' : 'Midnight'}</button></span></div>
        <div className="roles" role="group" aria-label="Demo accounts">{ROLES.map((x, k) => <button key={x.id} className={'role' + (k === i ? ' on' : '')} aria-pressed={k === i} title={x.sub} onClick={() => setI(k)}><span className="av">{x.short}</span><span className="col" style={{ gap: 0, minWidth: 0 }}><b>{x.name.split(',')[0]}</b><span className="mute sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name.split(',')[1]}</span></span></button>)}</div>
        <div className="grid2e" style={{ gap: 10 }}>
          <label className="col" style={{ gap: 4 }}><span className="sm mute">Your name (for the welcome)</span><input type="text" value={nm} onChange={e => setNm(e.target.value)} /></label>
          <label className="col" style={{ gap: 4 }}><span className="sm mute">Email</span><input type="email" readOnly value={r.email} /></label>
        </div>
        <div className="col" style={{ gap: 6 }} role="radiogroup" aria-label="Welcome language"><span className="sm mute">Welcome message language (the rest stays in English)</span><div className="row wrap" style={{ gap: 8 }}>{LANGS.map(x => <label key={x.id} className="row sm" style={{ gap: 6, border: '1px solid var(--line)', borderRadius: 999, padding: '5px 12px', background: L === x.id ? 'color-mix(in srgb, var(--acc) 18%, var(--s1))' : 'transparent', cursor: 'pointer' }}><input type="radio" name="wl" checked={L === x.id} onChange={() => setLang(v => ({ ...v, [r.id]: x.id }))} />{x.label}</label>)}</div></div>
        <label className="row between" style={{ gap: 10, cursor: 'pointer' }}><span className="col" style={{ gap: 0 }}><b className="sm">Play the welcome greeting</b><span className="sm mute">{greet ? 'On: a spoken welcome with pending items opens after sign-in.' : 'Off: goes straight to the workspace, no voice, no pop-up.'}</span></span><input type="checkbox" role="switch" aria-label="Play the welcome greeting" checked={greet} onChange={e => setGreet(e.target.checked)} style={{ width: 44, height: 24, accentColor: 'var(--acc)', flex: 'none' }} /></label>
        <label className="col" style={{ gap: 4 }}><span className="sm mute">Password</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} /></label>
        {err && <div className="err sm">{err}</div>}
        <button className="btn pri" style={{ minHeight: 48, fontSize: 16 }} disabled={busy} onClick={go}>{busy ? 'Signing in…' : 'Continue to workspace'}</button>
        <p className="mute sm" style={{ margin: 0 }}>Demo workspace. No real accounts or payment data.</p>
      </div>
    </div>
  );
}
