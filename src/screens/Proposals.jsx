import React, { useEffect, useMemo, useState } from 'react';
import { FitMatrix, Showcase } from '../FitMatrix.jsx';
import * as S from '../lib/stats.js';
import { proposalEmail } from '../lib/email.js';
import { useColl, put, audit, uid, callApi, conn } from '../lib/db.js';
import { notify, statusPill, statusText } from '../lib/notify.js';
import { Head, ChipInput, isEmail } from '../ui.jsx';

export const PSTATUS = { draft: ['Draft', ''], sent: ['Sent, awaiting reply', 'warn'], interested: ['Interested', 'ok'], wants_call: ['Wants a call', 'warn'], not_now: ['Not now', 'bad'], live: ['Live', 'ok'] };
const fromHash = () => (location.hash.split('?id=')[1] || '').split('&')[0] || null;
export default function Proposals({ role }) {
  const all = useColl('proposals'); const notes = useColl('notifications');
  const [sel, setSel] = useState(fromHash()); const [to, setTo] = useState([]); const [phone, setPhone] = useState(''); const [callMsg, setCallMsg] = useState(null); const [viaEmail, setViaEmail] = useState(true); const [viaTg, setViaTg] = useState(false); const [tgId, setTgId] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const [nm, setNm] = useState(S.SHOWCASE[0] ?? S.MERCH.findIndex(m => m.category === 'Electronics')); const [ni, setNi] = useState([5]);
  useEffect(() => { const f = () => setSel(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const rows = [...all].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  const p = all.find(x => x.id === sel); const counts = Object.keys(PSTATUS).map(k => [k, all.filter(x => x.status === k).length]);
  const mail = useMemo(() => (p ? proposalEmail(p) : null), [p?.id, p?.instruments?.join()]);
  const canEdit = ['pm', 'head', 'en'].includes(role.id);
  const valid = ni.filter(i => typeof i !== 'number' || !S.MERCH[nm].enabled[i]);
  const create = async () => { if (!valid.length) return; const now = new Date().toISOString(); const id = uid('PRP'); await put('proposals', { id, merchantId: nm, instruments: valid, status: 'draft', created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Draft created' }] }); await audit(role.name, 'Created proposal', S.MERCH[nm].name, id); setSel(id); history.replaceState(null, '', '#/proposals?id=' + id); };
  const ev = (text, extra = {}) => put('proposals', { ...p, ...extra, events: [...p.events, { ts: new Date().toISOString(), who: role.name, text }] });
  const send = async () => {
    setBusy(true); setMsg(null); const list = viaEmail ? to.filter(isEmail) : [];
    const r = await notify({ kind: 'proposal', id: p.id, to: list, channels: { email: viaEmail, telegram: viaTg }, tgTo: viaTg ? tgId.trim() : '', refId: p.id });
    const ok = r.some(x => x.status === 'sent'); const prev = r.some(x => x.status === 'preview');
    if (prev && !ok) await ev('Proposal prepared for ' + (list.join(', ') || 'merchant') + ' (preview only, email not connected)', { status: 'sent', sentAt: new Date().toISOString(), sentTo: list.join(', '), previewOnly: true });
    await audit(role.name, ok ? 'Sent proposal' : 'Prepared proposal', S.MERCH[p.merchantId].name, p.id); setMsg(r); setBusy(false);
  };
  const call = async () => {
    setBusy(true); setCallMsg(null); let r;
    if (conn.mode() === 'server') { try { r = (await callApi('/api/call', { id: p.id, number: phone })).result; } catch (e) { r = { channel: 'call', to: phone, status: 'failed', note: 'The server could not start the call' }; } }
    else r = { channel: 'call', to: phone, status: 'preview', note: 'Voice calling is not connected in this workspace. Nothing was dialled.' };
    await put('notifications', { id: uid('NTF') + Math.random().toString(36).slice(2, 5), ts: new Date().toISOString(), refId: p.id, kind: 'call', ...r });
    if (r.status === 'preview') await ev('Call prepared for ' + phone + ' (preview only, voice not connected)'); await audit(role.name, r.status === 'sent' ? 'Started voice call' : 'Prepared voice call', S.MERCH[p.merchantId].name, p.id); setCallMsg(r); setBusy(false);
  };
  const simulate = (k, label) => ev('Simulated merchant reply: ' + label + ' (demo)', { status: k, intentAt: new Date().toISOString(), simulated: true });
  return (
    <>
      <Head help="proposals" title="Proposals" sub="Offers to merchants for instruments they do not yet accept. No commercial terms. Merchants reply with one click, and a reply moves them into enablement." />
      <div className="chiprow">{counts.map(([k, n]) => <span key={k} className={'pill ' + PSTATUS[k][1]}>{PSTATUS[k][0]}: {n}</span>)}</div>
      {canEdit && <Showcase onUse={(mi, i) => { setNm(mi); setNi([i]); setTimeout(() => document.getElementById('fitm')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} />}
      {canEdit && ni.some(i => i === 5 || i === 6) && <div id="fitm"><FitMatrix mi={nm} inst={ni.includes(6) && !S.MERCH[nm].enabled[6] ? 6 : 5} /></div>}
      <div className="grid2 split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', alignItems: 'start' }}>
        <div className="col gap16">
          {canEdit && <section className="card"><span className="eyebrow">New proposal</span>
            <select value={nm} onChange={e => setNm(+e.target.value)} aria-label="Merchant">{S.MERCH_ORDER.map(i => <option key={i} value={i}>{(S.MERCH[i].showcase ? '★ ' : '') + S.MERCH[i].name} · {S.MERCH[i].category}</option>)}</select>
            <div className="mute sm">Only options this merchant does not accept yet can be proposed. Ones already enabled are shown locked.</div>
            <div className="chiprow">{S.INST.map((n, i) => { const on = !!S.MERCH[nm].enabled[i]; return <label key={i} className="row sm" style={{ opacity: on ? .55 : 1 }}><input type="checkbox" disabled={on} checked={!on && ni.includes(i)} onChange={e => setNi(e.target.checked ? [...ni, i] : ni.filter(x => x !== i))} />{n}{on ? ' · enabled' : ''}</label>; })}{S.EXTRA_INST.map(x => <label key={x.id} className="row sm" title={x.what}><input type="checkbox" checked={ni.includes(x.id)} onChange={e => setNi(e.target.checked ? [...ni, x.id] : ni.filter(y => y !== x.id))} />{x.name}</label>)}</div>
            <button className="btn pri" disabled={!valid.length} onClick={create}>Create draft</button></section>}
          <section className="card"><span className="eyebrow">{rows.length} proposal{rows.length === 1 ? '' : 's'}</span>
            {rows.length === 0 ? <p className="mute">None yet. Create one here, from Recommend, or from an approved finding on Explain.</p> :
              <table><thead><tr><th>Merchant</th><th>Status</th></tr></thead><tbody>{rows.map(x => <tr key={x.id} className="tr" onClick={() => { setSel(x.id); history.replaceState(null, '', '#/proposals?id=' + x.id); setMsg(null); }} style={{ outline: x.id === sel ? '2px solid var(--acc)' : 'none', outlineOffset: -2 }}><td><b>{S.MERCH[x.merchantId].name}</b><div className="mute sm">{x.instruments.map(i => S.instName(i)).join(', ')}</div></td><td><span className={'pill ' + PSTATUS[x.status][1]}>{PSTATUS[x.status][0]}</span></td></tr>)}</tbody></table>}</section>
        </div>
        {p ? <section className="card fade"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">{p.id}</span><h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{S.MERCH[p.merchantId].name}</h2></div><span className={'pill ' + PSTATUS[p.status][1]}>{PSTATUS[p.status][0]}</span></div>
          <span className="eyebrow">The email the merchant receives</span>
          <div className="emailframe"><div dangerouslySetInnerHTML={{ __html: mail.html }} /></div>
          {['draft', 'sent'].includes(p.status) && canEdit && <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">Send by</span>
            <div className="row wrap"><label className="row"><input type="checkbox" checked={viaEmail} onChange={e => setViaEmail(e.target.checked)} />Email</label><label className="row"><input type="checkbox" checked={viaTg} onChange={e => setViaTg(e.target.checked)} />Telegram</label></div>
            {viaEmail && <ChipInput label="Email addresses" value={to} onChange={setTo} placeholder="Type or paste addresses. Press comma, space or Enter to add each one." />}
            {viaTg && <label className="field"><span>Telegram chat ID</span><input type="text" inputMode="numeric" placeholder="e.g. 852893915 (the person must have started the bot first)" value={tgId} onChange={e => setTgId(e.target.value)} /></label>}
            <div className="row wrap"><button className="btn pri" disabled={busy || (!viaEmail && !viaTg) || (viaEmail && !(to.length && to.every(isEmail))) || (viaTg && !/^-?\d{5,}$/.test(tgId.trim()))} onClick={send}>{busy ? 'Sending…' : p.status === 'sent' ? 'Send again' : 'Send proposal'}</button></div>
            {msg && msg.map((x, i) => <div key={i} className="row wrap sm"><span className={'pill ' + statusPill(x.status)}>{statusText(x.status)}</span><span>{x.channel}{x.to ? ' to ' + x.to : ''}</span>{x.note && <span className="mute">{x.note}</span>}</div>)}</div>}
          {['draft', 'sent', 'wants_call', 'interested'].includes(p.status) && canEdit && <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">Call the merchant{p.status === 'wants_call' ? ' (they asked for a call)' : ''}</span>
            <span className="mute sm">An AI voice agent introduces itself, asks one question and records the outcome here. Use the international format.</span>
            <div className="row wrap"><input type="text" inputMode="tel" style={{ maxWidth: 260 }} placeholder="+919876543210" value={phone} onChange={e => setPhone(e.target.value)} aria-label="Merchant phone number" /><button className="btn" disabled={busy || !/^\+[1-9][\d\s-]{7,16}$/.test(phone.trim())} onClick={call}>Call with voice agent</button></div>
            {callMsg && <div className="col" style={{ gap: 4 }}><div className="row wrap sm"><span className={'pill ' + statusPill(callMsg.status)}>{statusText(callMsg.status)}</span><span>call to {callMsg.to}</span><span className="mute">{callMsg.note}</span></div>{callMsg.script && <span className="mute sm">Opening line: “{callMsg.script}”</span>}</div>}</div>}
          {p.previewOnly && <div className="banner">Preview only. Email is not connected in this workspace, so nothing was actually sent.</div>}
          {['draft', 'sent', 'wants_call'].includes(p.status) && canEdit && <div className="col" style={{ gap: 6 }}><span className="eyebrow">Demo: simulate the merchant’s reply</span><span className="mute sm">Real merchants reply with the email buttons. This stands in for that while the merchant is fictional.</span><div className="row wrap"><button className="btn" onClick={() => simulate('interested', 'Interested')}>Interested</button><button className="btn" onClick={() => simulate('wants_call', 'Wants a call')}>Wants a call</button><button className="btn" onClick={() => simulate('not_now', 'Not now')}>Not now</button></div></div>}
          {p.status === 'interested' && <div className="insight row between wrap"><span><b>Merchant is interested.</b> The enablement checklist is ready.</span><a className="btn pri" href={'#/enable?id=' + p.id}>Open in enablement</a></div>}
          <span className="eyebrow">Activity</span><ul className="timeline">{[...p.events].reverse().map((e, i) => <li key={i}><b>{e.who}</b> · <span className="mute">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><div>{e.text}</div></li>)}</ul>
        </section> : <section className="card"><p className="mute">Select a proposal to preview the email and send it.</p></section>}
      </div>
    </>
  );
}
