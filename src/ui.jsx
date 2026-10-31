import React from 'react';
export const Logo = ({ size = 28 }) => (<svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ color: 'var(--acc)' }}><rect x="1.5" y="1.5" width="25" height="25" rx="8" stroke="currentColor" strokeWidth="2" /><rect x="7" y="14" width="3.4" height="7" rx="1.2" fill="currentColor" /><rect x="12.3" y="10" width="3.4" height="11" rx="1.2" fill="currentColor" /><rect x="17.6" y="6.5" width="3.4" height="14.5" rx="1.2" fill="currentColor" /></svg>);
export const Spark = () => (<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" /></svg>);
export const AiTag = () => <span className="pill"><Spark />AI suggestion</span>;
export const Tick = () => (<span className="tick" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3.6 8.4l2.8 2.8 6-6.4" /></svg></span>);
export const Gate = ({ g }) => <span className={'pill ' + (g === 'Experience' ? 'warn' : g === 'Coverage' || g === 'Enablement' ? 'ok' : '')}>{g}</span>;
export const Head = ({ title, sub, right }) => (<div className="row between wrap"><div className="pagehead"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{right}</div>);
export const Seg = ({ value, onChange, options }) => (<div className="seg" role="group">{options.map(o => <button key={o[0]} className={value === o[0] ? 'on' : ''} aria-pressed={value === o[0]} onClick={() => onChange(o[0])}>{o[1]}</button>)}</div>);
export const Bar = ({ v, max = 100 }) => <div className="bar"><i style={{ width: Math.min(100, (100 * v) / max) + '%' }} /></div>;
export const Mic = ({ onText }) => {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [on, setOn] = React.useState(false);
  if (!SR) return null;
  const go = () => { const r = new SR(); r.lang = 'en-IN'; r.onresult = e => onText(e.results[0][0].transcript); r.onend = () => setOn(false); setOn(true); r.start(); };
  return (<button type="button" className="iconbtn" style={{ width: 46, height: 46, borderColor: on ? 'var(--acc)' : undefined }} aria-label="Speak a question" onClick={go}><svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6.5" y="1.8" width="5" height="9" rx="2.5" /><path d="M3.6 8.6a5.4 5.4 0 0010.8 0M9 14v2.4" /></svg></button>);
};
