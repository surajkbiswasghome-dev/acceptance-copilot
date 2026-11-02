import React from 'react';
export const Logo = ({ size = 28 }) => (<svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ color: 'var(--acc)' }}><rect x="1.5" y="1.5" width="25" height="25" rx="8" stroke="currentColor" strokeWidth="2" /><rect x="7" y="14" width="3.4" height="7" rx="1.2" fill="currentColor" /><rect x="12.3" y="10" width="3.4" height="11" rx="1.2" fill="currentColor" /><rect x="17.6" y="6.5" width="3.4" height="14.5" rx="1.2" fill="currentColor" /></svg>);
export const Spark = () => (<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" /></svg>);
export const AiTag = () => <span className="pill"><Spark />AI suggestion</span>;
export const Tick = () => (<span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3.6 8.4l2.8 2.8 6-6.4" /></svg></span>);
export const Gate = ({ g }) => <span className={'pill ' + (g === 'Experience' ? 'warn' : g === 'Coverage' || g === 'Enablement' ? 'ok' : '')}>{g}</span>;
export const Head = ({ title, sub, right, help }) => (<div className="row between wrap"><div className="pagehead"><h1>{title}{help && <Info k={help} />}</h1>{sub && <p>{sub}</p>}</div>{right}</div>);
export const Seg = ({ value, onChange, options }) => (<div className="seg" role="group">{options.map(o => <button key={o[0]} className={value === o[0] ? 'on' : ''} aria-pressed={value === o[0]} onClick={() => onChange(o[0])}>{o[1]}</button>)}</div>);
export const Bar = ({ v, max = 100 }) => <div className="bar"><i style={{ width: Math.min(100, (100 * v) / max) + '%' }} /></div>;
export const Mic = ({ onText }) => {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [on, setOn] = React.useState(false);
  if (!SR) return null;
  const go = () => { const r = new SR(); r.lang = 'en-IN'; r.onresult = e => onText(e.results[0][0].transcript); r.onend = () => setOn(false); setOn(true); r.start(); };
  return (<button type="button" className="iconbtn" style={{ width: 46, height: 46, borderColor: on ? 'var(--acc)' : undefined }} aria-label="Speak a question" onClick={go}><svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6.5" y="1.8" width="5" height="9" rx="2.5" /><path d="M3.6 8.6a5.4 5.4 0 0010.8 0M9 14v2.4" /></svg></button>);
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
export const isEmail = v => EMAIL_RE.test(v);
// Email tiles: type or paste addresses, separated by comma, space, semicolon or Enter. Backspace removes the last tile.
export function ChipInput({ value, onChange, placeholder, label }) {
  const [draft, setDraft] = React.useState('');
  const add = raw => { const parts = String(raw).split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean); if (!parts.length) return; onChange([...value, ...parts.filter((x, i) => !value.includes(x) && parts.indexOf(x) === i)]); setDraft(''); };
  const key = e => { if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key) && draft.trim()) { e.preventDefault(); add(draft); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); };
  return (<label className="field"><span>{label}</span><div className="chips" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
    {value.map(v => <span key={v} className={'chip' + (isEmail(v) ? '' : ' bad')}>{v}<button type="button" aria-label={'Remove ' + v} onClick={() => onChange(value.filter(x => x !== v))}>×</button></span>)}
    <input type="text" inputMode="email" value={draft} placeholder={value.length ? '' : placeholder} onChange={e => { const v = e.target.value; if (/[,;\s]$/.test(v)) add(v); else setDraft(v); }} onKeyDown={key} onBlur={() => add(draft)} onPaste={e => { const t = e.clipboardData.getData('text'); if (/[,;\s]/.test(t.trim())) { e.preventDefault(); add(t); } }} />
  </div></label>);
}

// Small "i" button. Hover, focus or tap shows what a section is for.
import { HELP } from './lib/help.js';
export function Info({ k, text }) {
  const [open, setOpen] = React.useState(false); const t = text || HELP[k]; if (!t) return null;
  return (<span className="info" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><button type="button" aria-label="What is this?" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(o => !o); }} onBlur={() => setOpen(false)}>i</button>{open && <span role="tooltip" className="infotip">{t}</span>}</span>);
}
// Renders children only once scrolled into view, so chart animations play when the reader arrives.
export function Reveal({ children, h = 240 }) {
  const ref = React.useRef(null); const [on, setOn] = React.useState(false);
  React.useEffect(() => { const el = ref.current; if (!el || on) return; if (typeof IntersectionObserver === 'undefined') { setOn(true); return; } const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.25 }); io.observe(el); return () => io.disconnect(); }, [on]);
  return <div ref={ref} style={{ minHeight: on ? undefined : h }}>{on ? children : null}</div>;
}
// Type to find a merchant. Partial names float the right choice to the top.
export function MerchantPicker({ merchants, value, onChange, allLabel = 'Whole portfolio' }) {
  const [q, setQ] = React.useState(''); const [open, setOpen] = React.useState(false);
  const cur = value === '' || value == null ? null : merchants[value];
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const list = merchants.map((m, i) => ({ m, i })).filter(({ m }) => !q.trim() || norm(m.name + ' ' + m.category).includes(norm(q.trim()))).sort((a, b) => (norm(a.m.name).startsWith(norm(q.trim())) ? 0 : 1) - (norm(b.m.name).startsWith(norm(q.trim())) ? 0 : 1)).sort((a, b) => (q.trim() ? 0 : (b.m.showcase ? 1 : 0) - (a.m.showcase ? 1 : 0))).slice(0, 8);
  const pick = i => { onChange(i); setQ(''); setOpen(false); };
  return (<div className="mpick"><div className="chips" onClick={() => setOpen(true)} style={{ minHeight: 40 }}>
    {cur ? <span className="chip">{cur.name}<button type="button" aria-label="Clear merchant" onClick={e => { e.stopPropagation(); pick(''); }}>×</button></span> : <span className="mute sm" style={{ paddingLeft: 4 }}>{allLabel}</span>}
    <input type="text" value={q} placeholder={cur ? '' : 'Type a merchant name'} aria-label="Find a merchant" onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={e => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); pick(list[0].i); } if (e.key === 'Escape') { setQ(''); setOpen(false); } }} /></div>
    {open && <div className="mlist" role="listbox"><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick('')}><b>{allLabel}</b></button>{list.map(({ m, i }) => <button type="button" key={i} onMouseDown={e => e.preventDefault()} onClick={() => pick(i)}><b>{m.showcase ? "★ " : ""}{m.name}</b><small>{m.showcase ? "Demo showcase · " : ""}{m.category}</small></button>)}{list.length === 0 && <span className="mute sm" style={{ padding: 10 }}>No merchant matches “{q}”.</span>}</div>}</div>);
}

// Reset with clear feedback: asks to confirm, disables while working, then confirms, and raises a toast.
export function ResetButton({ onReset, className = 'btn', style, bare }) {
  const [st, setSt] = React.useState('idle');
  React.useEffect(() => { if (st !== 'confirm') return; const t = setTimeout(() => setSt('idle'), 5000); return () => clearTimeout(t); }, [st]);
  const click = async e => { e.stopPropagation(); if (st === 'busy' || st === 'done') return; if (st === 'idle') { setSt('confirm'); return; } setSt('busy'); try { await onReset(); setSt('done'); window.dispatchEvent(new CustomEvent('ac-toast', { detail: 'Demo data cleared. Tickets, proposals, decisions, pilot data and the audit log are empty.' })); } catch (err) { setSt('idle'); window.dispatchEvent(new CustomEvent('ac-toast', { detail: 'Reset failed: ' + (err.message || err) })); return; } setTimeout(() => setSt('idle'), 3000); };
  const label = { idle: 'Reset demo', confirm: 'Click again to clear all demo data', busy: 'Clearing…', done: '✓ Demo data cleared' }[st];
  return <button className={className} style={{ ...style, ...(st === 'confirm' ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : {}), ...(st === 'done' ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : {}) }} disabled={st === 'busy'} aria-live="polite" onClick={click}>{st === 'busy' && <span className="spin" aria-hidden="true" />}{label}</button>;
}
export function Toasts() {
  const [t, setT] = React.useState(null);
  React.useEffect(() => { let h; const f = e => { setT(e.detail); clearTimeout(h); h = setTimeout(() => setT(null), 4500); }; addEventListener('ac-toast', f); return () => { removeEventListener('ac-toast', f); clearTimeout(h); }; }, []);
  return t ? <div className="toast" role="status">{t}</div> : null;
}
