import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as A from '../lib/afford.js';
import { useActivePolicy, policyChanges } from '../lib/policy.js';
import { useColl, put, audit, uid } from '../lib/db.js';
import { Head } from '../ui.jsx';
import { ProductSeg, Ticket, Stack, Synthetic, Illustrative, money } from '../AffParts.jsx';
import { EMI_PRODUCTS } from '../lib/emi.js';

const toast = t => dispatchEvent(new CustomEvent('ac-toast', { detail: t }));
export default function AffPolicy({ role }) {
  const active = useActivePolicy(); const tix = useColl('tickets'); const [draft, setDraft] = useState(active); const [code, setCode] = useState(0); const [ticket, setTicket] = useState(30000); const [busy, setBusy] = useState(false);
  const key = JSON.stringify(active), seen = useRef(key); useEffect(() => { if (seen.current !== key) { seen.current = key; setDraft(active); } }, [key]);
  const a = useMemo(() => A.portfolio(active, ticket, code), [active, ticket, code]); const b = useMemo(() => A.portfolio(draft, ticket, code), [draft, ticket, code]);
  const changes = policyChanges(active, draft); const pending = tix.find(t => t.kind === 'Policy change' && t.status === 'Pending approval');
  const num = (k, v) => setDraft({ ...draft, [k]: v === '' ? '' : Number(v) });
  const submit = async () => {
    setBusy(true); const now = new Date().toISOString(); const sum = `Changes: ${changes.join('; ')}. At ${money(ticket)} on ${EMI_PRODUCTS[code].short.toLowerCase()}: approval ${a.approvalRate}% to ${b.approvalRate}%, thin-margin approvals ${a.thinShare}% to ${b.thinShare}%, average amount ${money(a.avgExposure)} to ${money(b.avgExposure)}. Synthetic customers, not a forecast.`;
    const t = { id: uid('TCK'), kind: 'Policy change', findingId: null, title: 'Affordability policy change (' + changes.length + ' edit' + (changes.length > 1 ? 's' : '') + ')', summary: sum, priority: 'Medium', assignee: 'Head of Acceptance', requester: role.name, requesterId: role.id, status: 'Pending approval', recipients: [], channels: { email: false, telegram: false }, policy: draft, created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Policy change submitted for approval' }] };
    await put('tickets', t); await audit(role.name, 'Submitted affordability policy change', t.title, t.id); toast('Submitted as ' + t.id + '. A second person has to approve it.'); setBusy(false);
  };
  const delta = (x, y, unit = '') => { const d = Math.round((y - x) * 10) / 10; return <b className="num" style={{ color: d === 0 ? undefined : 'var(--acc)' }}>{y}{unit} <span className="mute sm">({d > 0 ? '+' : ''}{d})</span></b>; };
  const field = (k, label, min, max, step = 1) => <label className="slider" key={k}><span className="sm">{label}: <b>{draft[k]}</b></span><input type="range" min={min} max={max} step={step} value={draft[k]} onChange={e => num(k, e.target.value)} /></label>;
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Policy and what-if" sub="Change a threshold, see what it does to approvals and risk across all customers, then submit it. A second person approves before it takes effect." right={<Synthetic />} />
    {pending && <div className="insight"><b>Awaiting approval:</b> <span className="sm">{pending.id} was submitted by {pending.requester}. It goes live when the Head of Acceptance approves it in Tickets.</span></div>}
    <div className="grid2e" style={{ alignItems: 'start' }}>
      <section className="card"><span className="eyebrow">Proposed policy</span>{field('maxFoir', A.POLICY_LABEL.maxFoir, 20, 70)}{field('minScore', A.POLICY_LABEL.minScore, 20, 80)}{field('stepUpBand', A.POLICY_LABEL.stepUpBand, 0, 30)}{field('mandateBonus', A.POLICY_LABEL.mandateBonus, 0, 15)}{field('minTicket', A.POLICY_LABEL.minTicket, 1000, 10000, 500)}
        <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={draft.issuerAware !== false} onChange={e => setDraft({ ...draft, issuerAware: e.target.checked })} style={{ accentColor: 'var(--acc)' }} /><span className="sm">Respect issuer enablement (an issuer must switch EMI on for its cards)</span></label>
        <details><summary className="sm" style={{ cursor: 'pointer' }}>Rates, fee and no-cost rules (illustrative inputs)</summary><div className="col" style={{ gap: 10, marginTop: 10 }}>{EMI_PRODUCTS.map(p => <label key={p.id} className="slider"><span className="sm">Illustrative annual rate, {p.short}: <b>{draft.rates[p.id]}%</b></span><input type="range" min="0" max="30" step="0.5" value={draft.rates[p.id]} onChange={e => setDraft({ ...draft, rates: { ...draft.rates, [p.id]: +e.target.value } })} /></label>)}<label className="slider"><span className="sm">Processing fee: <b>{draft.feePct}%</b></span><input type="range" min="0" max="3" step="0.25" value={draft.feePct} onChange={e => num('feePct', e.target.value)} /></label>
          <span className="sm mute">No-cost EMI, longest tenure the merchant funds (months)</span><div className="grid2e" style={{ gap: 8 }}>{Object.keys(draft.noCostMax).map(k => <label key={k} className="row between sm"><span>{k}</span><select value={draft.noCostMax[k]} onChange={e => setDraft({ ...draft, noCostMax: { ...draft.noCostMax, [k]: +e.target.value } })} style={{ width: 90 }}>{[0, 3, 6, 9, 12].map(v => <option key={v} value={v}>{v === 0 ? 'none' : v}</option>)}</select></label>)}</div></div></details>
        <div className="row wrap"><button className="btn" onClick={() => setDraft(active)} disabled={!changes.length}>Reset to policy in force</button></div></section>
      <section className="card"><span className="eyebrow">Effect on {A.CUSTOMERS.length} synthetic customers</span><ProductSeg value={code} onChange={setCode} /><Ticket value={ticket} onChange={setTicket} />
        <table><thead><tr><th></th><th>In force</th><th>Proposed</th></tr></thead><tbody><tr><td>Approved</td><td className="num">{a.approvalRate}%</td><td>{delta(a.approvalRate, b.approvalRate, '%')}</td></tr><tr><td>Thin-margin approvals</td><td className="num">{a.thinShare}%</td><td>{delta(a.thinShare, b.thinShare, '%')}</td></tr><tr><td>Average amount converted</td><td className="num">{money(a.avgExposure)}</td><td className="num"><b>{money(b.avgExposure)}</b></td></tr></tbody></table>
        <div className="col" style={{ gap: 6 }}><span className="sm mute">Proposed decision mix</span><Stack tally={b.tally} n={b.n} /></div>
        <div className="insight col" style={{ gap: 4 }}><b>Read this as a trade-off</b><span className="sm">A higher approval rate converts more sales and also lets in more customers near the cut-off. Thin-margin approvals is a proxy for that risk. It is not a default prediction. Real loss data would calibrate it.</span></div></section></div>
    <section className="card"><span className="eyebrow">Submit for approval</span>{changes.length ? <><ul className="sm" style={{ margin: 0, paddingLeft: 18 }}>{changes.map(c => <li key={c}>{c}</li>)}</ul><div className="row wrap"><button className="btn pri" disabled={busy || !!pending} onClick={submit}>{pending ? 'A change is already awaiting approval' : 'Submit policy change'}</button></div><span className="mute sm">Four-eyes control: the person who submits cannot approve (the demo admin can, as a recorded override). Approval is recorded in the audit log.</span></> : <span className="sm mute">No changes yet. Move a slider above.</span>}</section>
    <Illustrative />
  </div>);
}
