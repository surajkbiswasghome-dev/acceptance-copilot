import React, { useEffect, useState } from 'react';
import * as S from '../lib/stats.js';
import { useColl, put, audit } from '../lib/db.js';
import { Head, Bar } from '../ui.jsx';

export const STEPS = [['Acquirer confirms the instrument is supported on this merchant’s route', 'Acquirer'], ['Issuer and BIN coverage checked', 'Enablement'], ['Instrument enabled in the gateway configuration', 'DevOps'], ['Sandbox test transaction passed', 'DevOps'], ['Checkout prompt and offer wording approved', 'Enablement'], ['Go live, then watch results for 7 days', 'Enablement']];
const fromHash = () => (location.hash.split('?id=')[1] || '').split('&')[0] || null;
export default function Enable({ role }) {
  const props = useColl('proposals'); const checks = useColl('checks');
  const queue = props.filter(p => ['interested', 'live'].includes(p.status)); const waiting = props.filter(p => p.status === 'sent').length; const calls = props.filter(p => p.status === 'wants_call');
  const [sel, setSel] = useState(fromHash());
  useEffect(() => { const f = () => setSel(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const p = queue.find(x => x.id === sel) || queue[0]; const done = (p && checks.find(c => c.id === p.id)?.done) || [];
  const canEdit = ['pm', 'head', 'en'].includes(role.id);
  const toggle = async i => { const next = done.includes(i) ? done.filter(x => x !== i) : [...done, i]; await put('checks', { id: p.id, done: next }); await audit(role.name, (done.includes(i) ? 'Unchecked' : 'Checked') + ' step', S.MERCH[p.merchantId].name, STEPS[i][0]); };
  const live = async () => { const now = new Date().toISOString(); await put('proposals', { ...p, status: 'live', events: [...p.events, { ts: now, who: role.name, text: 'Marked live after enablement' }] }); await audit(role.name, 'Marked live', S.MERCH[p.merchantId].name, p.id); };
  return (
    <>
      <Head title="Enablement" sub="Only merchants who said yes appear here. The checklist starts after their reply, never before." />
      <div className="chiprow"><span className="pill warn">Awaiting merchant reply: {waiting}</span><span className="pill">Asked for a call: {calls.length}</span><span className="pill ok">In enablement: {queue.filter(x => x.status === 'interested').length}</span><span className="pill ok">Live: {queue.filter(x => x.status === 'live').length}</span></div>
      {calls.length > 0 && <section className="card"><span className="eyebrow">Asked for a call</span>{calls.map(c => <a key={c.id} className="row between wrap sm" href={'#/proposals?id=' + c.id}><span><b>{S.MERCH[c.merchantId].name}</b> · {c.instruments.map(i => S.INST[i]).join(', ')}</span><span className="pill warn">Call them</span></a>)}</section>}
      {queue.length === 0 ? <section className="card"><p className="mute">No merchant has replied “interested” yet. Send a proposal on the Proposals page. When a merchant clicks Interested in the email, they appear here with a ready checklist.</p><a className="btn pri" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center' }} href="#/proposals">Go to proposals</a></section> :
        <div className="grid2 split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', alignItems: 'start' }}>
          <section className="card"><span className="eyebrow">Queue</span><table><tbody>{queue.map(x => { const d = (checks.find(c => c.id === x.id)?.done || []).length; return <tr key={x.id} className="tr" onClick={() => { setSel(x.id); history.replaceState(null, '', '#/enable?id=' + x.id); }} style={{ outline: p && x.id === p.id ? '2px solid var(--acc)' : 'none', outlineOffset: -2 }}><td><b>{S.MERCH[x.merchantId].name}</b><div className="mute sm">{x.instruments.map(i => S.INST[i]).join(', ')}</div></td><td><span className={'pill ' + (x.status === 'live' ? 'ok' : 'warn')}>{x.status === 'live' ? 'Live' : d + '/' + STEPS.length}</span></td></tr>; })}</tbody></table></section>
          {p && <section className="card fade"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Checklist</span><h2 style={{ fontSize: 20, letterSpacing: '-.02em' }}>{S.MERCH[p.merchantId].name} · {p.instruments.map(i => S.INST[i]).join(', ')}</h2></div><b className="num sm">{done.length}/{STEPS.length}</b></div><Bar v={done.length} max={STEPS.length} />
            <div>{STEPS.map(([s, owner], i) => <label key={i} className="check"><input type="checkbox" disabled={!canEdit || p.status === 'live'} checked={done.includes(i)} onChange={() => toggle(i)} /><span className="col" style={{ gap: 0 }}><span>{s}</span><span className="mute sm">Owner: {owner}</span></span></label>)}</div>
            {p.status !== 'live' ? <button className="btn pri" style={{ alignSelf: 'flex-start' }} disabled={done.length < STEPS.length || !canEdit} onClick={live}>Mark as live</button> : <span className="pill ok" style={{ alignSelf: 'flex-start' }}>Live. Eligible for the pilot cohort.</span>}
            <span className="mute sm">Created automatically when the merchant replied “interested”.</span></section>}
        </div>}
    </>
  );
}
