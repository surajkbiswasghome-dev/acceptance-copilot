import React, { useEffect, useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { proposalEmail } from '../lib/email.js';
import { useColl, put, audit, uid } from '../lib/db.js';
import { notify, statusPill, statusText } from '../lib/notify.js';
import { Head } from '../ui.jsx';

export const PSTATUS = { draft: ['Draft', ''], sent: ['Sent, awaiting reply', 'warn'], interested: ['Interested', 'ok'], wants_call: ['Wants a call', 'warn'], not_now: ['Not now', 'bad'], live: ['Live', 'ok'] };
const fromHash = () => (location.hash.split('?id=')[1] || '').split('&')[0] || null;
export default function Proposals({ role }) {
  const all = useColl('proposals'); const notes = useColl('notifications');
  const [sel, setSel] = useState(fromHash()); const [to, setTo] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const [nm, setNm] = useState(S.MERCH.findIndex(m => m.category === 'Electronics')); const [ni, setNi] = useState([5]);
  useEffect(() => { const f = () => setSel(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const rows = [...all].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  const p = all.find(x => x.id === sel); const counts = Object.keys(PSTATUS).map(k => [k, all.filter(x => x.status === k).length]);
  const mail = useMemo(() => (p ? proposalEmail(p) : null), [p?.id, p?.instruments?.join()]);
  const canEdit = ['pm', 'head', 'en'].includes(role.id);
  const create = async () => { const now = new Date().toISOString(); const id = uid('PRP'); await put('proposals', { id, merchantId: nm, instruments: ni, status: 'draft', created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Draft created' }] }); await audit(role.name, 'Created proposal', S.MERCH[nm].name, id); setSel(id); history.replaceState(null, '', '#/proposals?id=' + id); };
  const ev = (text, extra = {}) => put('proposals', { ...p, ...extra, events: [...p.events, { ts: new Date().toISOString(), who: role.name, text }] });
  const send = async () => {
    setBusy(true); setMsg(null); const list = to.split(/[,;\s]+/).filter(x => x.includes('@'));
    const r = await notify({ kind: 'proposal', id: p.id, to: list, channels: { email: true }, refId: p.id });
    const ok = r.some(x => x.status === 'sent'); const prev = r.some(x => x.status === 'preview');
    if (prev && !ok) await ev('Proposal prepared for ' + (list.join(', ') || 'merchant') + ' (preview only, email not connected)', { status: 'sent', sentAt: new Date().toISOString(), sentTo: list.join(', '), previewOnly: true });
    await audit(role.name, ok ? 'Sent proposal' : 'Prepared proposal', S.MERCH[p.merchantId].name, p.id); setMsg(r); setBusy(false);
  };
  const simulate = (k, label) => ev('Simulated merchant reply: ' + label + ' (demo)', { status: k, intentAt: new Date().toISOString(), simulated: true });
  return (
    <>
      <Head title="Proposals" sub="Offers to merchants for instruments they do not yet accept. No commercial terms. Merchants reply with one click, and a reply moves them into enablement." />
      <div className="chiprow">{counts.map(([k, n]) => <span key={k} className={'pill ' + PSTATUS[k][1]}>{PSTATUS[k][0]}: {n}</span>)}</div>
      <div className="grid2 split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', alignItems: 'start' }}>
        <div className="col gap16">
          {canEdit && <section className="card"><span className="eyebrow">New proposal</span>
            <select value={nm} onChange={e => setNm(+e.target.value)} aria-label="Merchant">{S.MERCH.map((m, i) => <option key={i} value={i}>{m.name} · {m.category}</option>)}</select>
            <div className="chiprow">{[1, 5, 6].map(i => <label key={i} className="row sm"><input type="checkbox" checked={ni.includes(i)} onChange={e => setNi(e.target.checked ? [...ni, i] : ni.filter(x => x !== i))} />{S.INST[i]}{S.MERCH[nm].enabled[i] ? ' (already enabled)' : ''}</label>)}</div>
            <button className="btn pri" disabled={!ni.length} onClick={create}>Create draft</button></section>}
          <section className="card"><span className="eyebrow">{rows.length} proposal{rows.length === 1 ? '' : 's'}</span>
            {rows.length === 0 ? <p className="mute">None yet. Create one here, from Recommend, or from an approved finding on Explain.</p> :
              <table><thead><tr><th>Merchant</th><th>Status</th></tr></thead><tbody>{rows.map(x => <tr key={x.id} className="tr" onClick={() => { setSel(x.id); history.replaceState(null, '', '#/proposals?id=' + x.id); setMsg(null); }} style={{ outline: x.id === sel ? '2px solid var(--acc)' : 'none', outlineOffset: -2 }}><td><b>{S.MERCH[x.merchantId].name}</b><div className="mute sm">{x.instruments.map(i => S.INST[i]).join(', ')}</div></td><td><span className={'pill ' + PSTATUS[x.status][1]}>{PSTATUS[x.status][0]}</span></td></tr>)}</tbody></table>}</section>
        </div>
        {p ? <section className="card fade"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">{p.id}</span><h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{S.MERCH[p.merchantId].name}</h2></div><span className={'pill ' + PSTATUS[p.status][1]}>{PSTATUS[p.status][0]}</span></div>
          <span className="eyebrow">The email the merchant receives</span>
          <div className="emailframe"><div dangerouslySetInnerHTML={{ __html: mail.html }} /></div>
          {['draft', 'sent'].includes(p.status) && canEdit && <div className="col" style={{ gap: 8 }}>
            <label className="field"><span>Send to</span><input type="text" placeholder="merchant contact email (use your own address for the demo)" value={to} onChange={e => setTo(e.target.value)} /></label>
            <div className="row wrap"><button className="btn pri" disabled={busy || !to.includes('@')} onClick={send}>{busy ? 'Sending…' : p.status === 'sent' ? 'Send again' : 'Send proposal'}</button></div>
            {msg && msg.map((x, i) => <div key={i} className="row wrap sm"><span className={'pill ' + statusPill(x.status)}>{statusText(x.status)}</span><span>{x.channel}{x.to ? ' to ' + x.to : ''}</span>{x.note && <span className="mute">{x.note}</span>}</div>)}</div>}
          {p.previewOnly && <div className="banner">Preview only. Email is not connected in this workspace, so nothing was actually sent.</div>}
          {['draft', 'sent', 'wants_call'].includes(p.status) && canEdit && <div className="col" style={{ gap: 6 }}><span className="eyebrow">Demo: simulate the merchant’s reply</span><span className="mute sm">Real merchants reply with the email buttons. This stands in for that while the merchant is fictional.</span><div className="row wrap"><button className="btn" onClick={() => simulate('interested', 'Interested')}>Interested</button><button className="btn" onClick={() => simulate('wants_call', 'Wants a call')}>Wants a call</button><button className="btn" onClick={() => simulate('not_now', 'Not now')}>Not now</button></div></div>}
          {p.status === 'interested' && <div className="insight row between wrap"><span><b>Merchant is interested.</b> The enablement checklist is ready.</span><a className="btn pri" href={'#/enable?id=' + p.id}>Open in enablement</a></div>}
          <span className="eyebrow">Activity</span><ul className="timeline">{[...p.events].reverse().map((e, i) => <li key={i}><b>{e.who}</b> · <span className="mute">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><div>{e.text}</div></li>)}</ul>
        </section> : <section className="card"><p className="mute">Select a proposal to preview the email and send it.</p></section>}
      </div>
    </>
  );
}
