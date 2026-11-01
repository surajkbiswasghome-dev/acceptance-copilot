import React, { useMemo, useState } from 'react';
import * as S from '../../lib/stats.js';
import * as A from '../../lib/analytics.js';
import { useColl, put, audit, uid } from '../../lib/db.js';
import { notify, statusPill, statusText } from '../../lib/notify.js';
import { ChipInput, isEmail, MerchantPicker } from '../../ui.jsx';

// Creates a routing change request (a ticket that a second person must approve). Used for agent recommendations and custom requests.
export default function RoutingRequest({ role, preset, onDone, onCancel }) {
  const settings = useColl('settings').find(x => x.id === 'main') || {};
  const [inst, setInst] = useState(preset.inst ?? ''); const [from, setFrom] = useState(preset.from ?? 2); const [to, setTo] = useState(preset.to ?? 1); const [share, setShare] = useState(preset.share ?? 30);
  const [merchant, setMerchant] = useState(preset.merchant ?? ''); const [priority, setPriority] = useState('P2');
  const [useDev, setUseDev] = useState(true); const [extra, setExtra] = useState([]); const [email, setEmail] = useState(true); const [tg, setTg] = useState(false); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null);
  const instLabel = inst === '' ? 'all instruments' : S.INST[inst]; const scope = merchant === '' ? 'all merchants' : S.MERCH[merchant].name;
  const obs = useMemo(() => {
    const f = merchant === '' ? {} : {}; const rows = a => A.filterRows(f).filter(t => t.acq === a && (inst === '' || t.inst === inst));
    const ra = rows(from), rb = rows(to); if (ra.length < 20 || rb.length < 20) return null;
    return { sa: A.METRICS.success.fn(ra), sb: A.METRICS.success.fn(rb), ca: A.METRICS.cost.fn(ra), cb: A.METRICS.cost.fn(rb), pa: A.METRICS.p95.fn(ra), pb: A.METRICS.p95.fn(rb), na: ra.length, nb: rb.length };
  }, [inst, from, to, merchant]);
  const summary = useMemo(() => [`Routing change request`, `Instrument: ${instLabel}`, `Move ${share}% of volume from ${S.ACQ[from]} to ${S.ACQ[to]} for ${scope}.`, '',
    obs ? `Observed over 30 days (portfolio level): success ${obs.sa}% on ${S.ACQ[from]} (n = ${obs.na}) against ${obs.sb}% on ${S.ACQ[to]} (n = ${obs.nb}). Cost index ${obs.ca} to ${obs.cb}. P95 latency ${obs.pa} to ${obs.pb} ms.` : 'Not enough payments at one of the two acquirers for a fair comparison.',
    ...(preset.benefits ? ['', 'Benefits (agent):', ...preset.benefits.map(x => '• ' + x)] : []), ...(preset.tradeoffs ? ['', 'Trade-offs (agent):', ...preset.tradeoffs.map(x => '• ' + x)] : []),
    '', 'Arithmetic on past results, not a forecast. Needs approval by a second person before DevOps applies it.', preset.source === 'agent' ? 'Raised from the routing agent recommendation.' : 'Raised manually from Insights, Routing.'].join('\n'), [instLabel, share, from, to, scope, obs, preset]);
  const recips = [...(useDev && settings.devopsEmail ? [settings.devopsEmail] : []), ...extra.filter(isEmail)];
  const submit = async () => {
    setBusy(true); const now = new Date().toISOString();
    const t = { id: uid('TCK'), kind: 'Routing change', findingId: null, title: `Routing change: ${S.ACQ[from]} to ${S.ACQ[to]} (${instLabel}, ${scope})`, summary, priority, assignee: 'DevOps team', requester: role.name, requesterId: role.id, status: 'Pending approval', recipients: recips, channels: { email, telegram: tg },
      route: { from: S.ACQ[from], to: S.ACQ[to], instrument: instLabel, share, scope }, created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Routing change raised' + (preset.source === 'agent' ? ' from the agent recommendation' : '') }] };
    await put('tickets', t); await audit(role.name, 'Raised routing change ticket', t.title, t.id);
    const r = await notify({ kind: 'ticket', id: t.id, to: recips, channels: { email, telegram: tg }, refId: t.id });
    setRes({ id: t.id, r }); setBusy(false); onDone && onDone(t);
  };
  if (res) return (<div className="insight col"><b>{res.id} created and waiting for a second person to approve</b>{res.r.map((x, i) => <div key={i} className="row wrap sm"><span className={'pill ' + statusPill(x.status)}>{statusText(x.status)}</span><span>{x.channel}{x.to ? ' to ' + x.to : ''}</span>{x.note && <span className="mute">{x.note}</span>}</div>)}<div className="row wrap"><a className="btn pri" href={'#/tickets?id=' + res.id}>Open the ticket</a><button className="btn" onClick={onCancel}>Done</button></div></div>);
  return (<div className="col" style={{ gap: 12 }}>
    <div className="ctrls"><label>Instrument<select value={inst} onChange={e => setInst(e.target.value === '' ? '' : Number(e.target.value))}><option value="">All instruments</option>{S.INST.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
      <label>Move from<select value={from} onChange={e => setFrom(Number(e.target.value))}>{S.ACQ.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label><label>to<select value={to} onChange={e => setTo(Number(e.target.value))}>{S.ACQ.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
      <label>Share moved: {share}%<input type="range" min={5} max={100} step={5} value={share} onChange={e => setShare(Number(e.target.value))} style={{ accentColor: 'var(--acc)', minHeight: 24, padding: 0 }} /></label>
      <label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}><option>P1</option><option>P2</option><option>P3</option></select></label></div>
    <div className="col" style={{ gap: 4 }}><span className="eyebrow">For which merchants</span><MerchantPicker merchants={S.MERCH} value={merchant} onChange={setMerchant} allLabel="All merchants" /></div>
    {from === to && <div className="banner">Choose two different acquirers.</div>}
    <div className="field"><span>Notify</span><label className="row sm"><input type="checkbox" checked={useDev} onChange={e => setUseDev(e.target.checked)} /> DevOps team{settings.devopsEmail ? ' (' + settings.devopsEmail + ')' : ' (no address set. Add one in Account)'}</label>
      <ChipInput label="Also email these addresses" value={extra} onChange={setExtra} placeholder="Type or paste addresses, then comma or Enter" />
      <div className="row wrap"><label className="row sm"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email</label><label className="row sm"><input type="checkbox" checked={tg} onChange={e => setTg(e.target.checked)} /> Telegram</label></div></div>
    <label className="field"><span>Details sent with the request</span><textarea value={summary} readOnly style={{ minHeight: 200 }} /></label>
    <div className="row wrap"><button className="btn pri" disabled={busy || from === to} onClick={submit}>{busy ? 'Creating…' : 'Create routing request'}</button><button className="btn" onClick={onCancel}>Cancel</button></div>
  </div>);
}
