import React, { useEffect, useState } from 'react';
import { useKey, ROLES, audit, resetDemo } from './lib/store.js';
import { Logo } from './ui.jsx';
import Diagnose from './screens/Diagnose.jsx';
import Explain from './screens/Explain.jsx';
import Recommend from './screens/Recommend.jsx';
import Enable from './screens/Enable.jsx';
import Pilot from './screens/Pilot.jsx';
import Account from './screens/Account.jsx';
import Login from './screens/Login.jsx';

const VIEWS = [['diagnose', 'Diagnose'], ['explain', 'Explain'], ['recommend', 'Recommend'], ['enable', 'Enable'], ['pilot', 'Pilot']];
const useRoute = () => { const get = () => (location.hash.replace('#/', '') || 'diagnose').split('?')[0]; const [r, setR] = useState(get); useEffect(() => { const f = () => setR(get()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return r; };

export default function App() {
  const [user, setUser] = useKey('ac_user', null);
  const [theme, setTheme] = useKey('ac_theme', 'dark');
  const [open, setOpen] = useState(false);
  const route = useRoute();
  useEffect(() => { document.documentElement.dataset.theme = theme; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = theme === 'dark' ? '#0A1020' : '#F3F2ED'; }, [theme]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); if (route === 'reset') { resetDemo(); location.hash = '#/diagnose'; } }, [route]);
  if (!user) return <Login theme={theme} setTheme={setTheme} onLogin={r => { setUser(r.id); audit(r.name, 'Signed in', 'Workspace'); location.hash = '#/diagnose'; }} />;
  const role = ROLES.find(r => r.id === user) || ROLES[0];
  const signOut = () => { audit(role.name, 'Signed out', 'Workspace'); setUser(null); location.hash = ''; };
  const Screen = { diagnose: Diagnose, explain: Explain, recommend: Recommend, enable: Enable, pilot: Pilot, account: Account }[route] || Diagnose;
  return (
    <div className="shell">
      <header className="top">
        <a href="#/diagnose" className="brand"><Logo />Acceptance Copilot</a>
        <nav className="nav" aria-label="Views">{VIEWS.map(([k, l]) => <a key={k} href={'#/' + k} className={route === k ? 'on' : ''} aria-current={route === k ? 'page' : undefined}>{l}</a>)}</nav>
        <div style={{ flex: 1 }} className="spacer" />
        <div className="tools" style={{ position: 'relative' }}>
          <span className="pill" title="All data in this prototype is synthetic">Synthetic data</span>
          <button className="iconbtn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="3.4" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" /></svg> : <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 10.5A6.5 6.5 0 017.5 3 6.5 6.5 0 109 15.5a6.5 6.5 0 006-5z" /></svg>}</button>
          <button className="avatar" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)}>{role.short}</button>
          {open && <div className="menu" role="menu"><span className="who"><b>{role.name}</b><small>{role.email}</small></span><a href="#/account">Account and audit log</a><button onClick={() => { resetDemo(); setOpen(false); location.hash = '#/diagnose'; }}>Reset demo</button><button onClick={signOut}>Sign out</button></div>}
        </div>
      </header>
      <main className="page fade" key={route}><Screen role={role} /></main>
      <nav className="bottom" aria-label="Views">{VIEWS.map(([k, l]) => <a key={k} href={'#/' + k} className={route === k ? 'on' : ''}>{l}</a>)}</nav>
    </div>
  );
}
