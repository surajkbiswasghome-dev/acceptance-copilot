import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useKey } from './lib/store.js';
import { ROLES, roleById } from './lib/roles.js';
import { audit, conn } from './lib/db.js';
import { Logo } from './ui.jsx';
const Insights = lazy(() => import('./screens/Insights.jsx'));
import Diagnose from './screens/Diagnose.jsx';
import Explain from './screens/Explain.jsx';
import Recommend from './screens/Recommend.jsx';
import Proposals from './screens/Proposals.jsx';
import Enable from './screens/Enable.jsx';
import Tickets from './screens/Tickets.jsx';
import Pilot from './screens/Pilot.jsx';
import Brief from './screens/Brief.jsx';
import Account from './screens/Account.jsx';
import Login from './screens/Login.jsx';

const LABEL = { insights: 'Insights', diagnose: 'Diagnose', explain: 'Explain', recommend: 'Recommend', proposals: 'Proposals', enable: 'Enablement', tickets: 'Tickets', pilot: 'Pilot', brief: 'Brief' };
const SCREENS = { insights: Insights, diagnose: Diagnose, explain: Explain, recommend: Recommend, proposals: Proposals, enable: Enable, tickets: Tickets, pilot: Pilot, brief: Brief, account: Account };
const useRoute = () => { const get = () => (location.hash.replace('#/', '') || 'insights').split('?')[0]; const [r, setR] = useState(get); useEffect(() => { const f = () => setR(get()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []); return r; };

export default function App() {
  const [user, setUser] = useKey('ac_user', null);
  const [theme, setTheme] = useKey('ac_theme', 'dark');
  const [open, setOpen] = useState(false); const [more, setMore] = useState(false);
  const route = useRoute();
  useEffect(() => { document.documentElement.dataset.theme = theme; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = theme === 'dark' ? '#0A1020' : '#F3F2ED'; }, [theme]);
  useEffect(() => { setOpen(false); setMore(false); window.scrollTo(0, 0); }, [route]);
  useEffect(() => { const f = () => { conn.setLocal(); setUser(null); location.hash = ''; }; addEventListener('ac-unauth', f); return () => removeEventListener('ac-unauth', f); }, []);
  if (!user || !ROLES.some(r => r.id === user)) return <Login theme={theme} setTheme={setTheme} onLogin={r => { setUser(r.id); audit(r.name, 'Signed in', 'Workspace'); location.hash = '#/insights'; }} />;
  const role = roleById(user);
  const signOut = () => { audit(role.name, 'Signed out', 'Workspace'); conn.setLocal(); setUser(null); location.hash = ''; };
  const allowed = route === 'account' || role.views.includes(route);
  const Screen = allowed ? SCREENS[route] || Diagnose : Diagnose;
  const bottom = role.views.length > 5 ? role.views.slice(0, 4) : role.views; const rest = role.views.length > 5 ? role.views.slice(4) : [];
  return (
    <div className="shell">
      <header className="top">
        <a href="#/insights" className="brand"><Logo />Acceptance Copilot</a>
        <nav className="nav" aria-label="Views">{role.views.map(k => <a key={k} href={'#/' + k} className={route === k ? 'on' : ''} aria-current={route === k ? 'page' : undefined}>{LABEL[k]}</a>)}</nav>
        <div style={{ flex: 1 }} className="spacer" />
        <div className="tools" style={{ position: 'relative' }}>
          <span className="pill hide-sm" title="All data in this prototype is synthetic">Synthetic data</span>
          <button className="iconbtn" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="3.4" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" /></svg> : <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 10.5A6.5 6.5 0 017.5 3 6.5 6.5 0 109 15.5a6.5 6.5 0 006-5z" /></svg>}</button>
          <button className="avatar" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)}>{role.short}</button>
          {open && <div className="menu" role="menu"><span className="who"><b>{role.name}</b><small>{role.email}</small></span><a href="#/account">Account, settings and audit log</a><button onClick={signOut}>Sign out</button></div>}
        </div>
      </header>
      <main className="page fade" key={route}><Suspense fallback={<div className="mute">Loading…</div>}><Screen role={role} /></Suspense></main>
      <nav className="bottom" aria-label="Views" style={{ gridTemplateColumns: `repeat(${bottom.length + (rest.length ? 1 : 0)},1fr)` }}>
        {bottom.map(k => <a key={k} href={'#/' + k} className={route === k ? 'on' : ''}>{LABEL[k]}</a>)}
        {rest.length > 0 && <a href="#" className={rest.includes(route) || route === 'account' ? 'on' : ''} onClick={e => { e.preventDefault(); setMore(!more); }}>More</a>}
      </nav>
      {more && <div className="sheet" role="menu">{rest.map(k => <a key={k} href={'#/' + k}>{LABEL[k]}</a>)}<a href="#/account">Account</a><button onClick={signOut}>Sign out</button></div>}
    </div>
  );
}
