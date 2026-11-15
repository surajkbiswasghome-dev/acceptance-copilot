import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import * as E from '../lib/emi.js';
import { useColl, put, audit, uid } from '../lib/db.js';
import { Head, Bar } from '../ui.jsx';
import { Lifecycle } from '../Lifecycle.jsx';
import { EmiTargeting, EmiShowcase, EmiFitMatrix, Assumption } from '../EmiParts.jsx';

const money = v => '₹' + Math.round(v).toLocaleString('en-IN');
const toast = t => dispatchEvent(new CustomEvent('ac-toast', { detail: t }));
function Funnel({ f }) {
  const rows = [['Plans shown', f.shown], ['Plan selected', f.selected], ['Eligible', f.eligible], ['Converted to EMI', f.converted]];
  return (<div className="funnel">{rows.map(([l, v]) => <div key={l} className="frow"><span>{l}</span><div className="fbar"><i style={{ width: (100 * v / (f.shown || 1)) + '%' }} /></div><b className="num">{v.toLocaleString('en-IN')} · {Math.round(100 * v / (f.shown || 1))}%</b></div>)}
    <span className="mute sm">Lost: {f.left} left at plan selection · {f.notEligible} not eligible · {f.declined} issuer declined · {f.technical} technical failure. Approval once eligible: {f.approval}%.</span></div>);
}
export default function Emi({ role }) {
  const k = useMemo(() => E.emiKpis(), []); const findings = useMemo(() => E.emiFindings(), []); const tix = useColl('tickets');
  const [mi, setMi] = useState(S.SHOWCASE[0]); const [a, setA] = useState(E.EMI_ASSUMPTION); const [prod, setProd] = useState(0);
  const canAct = ['pm', 'head', 'en'].includes(role.id); const canPropose = ['pm', 'head', 'en'].includes(role.id);
  const raise = async f => { const now = new Date().toISOString(); const t = { id: uid('TCK'), kind: 'EMI fix', findingId: f.id, title: f.title, summary: f.action, priority: 'Medium', assignee: f.owner === 'DevOps and acquirer' ? 'DevOps team' : f.owner, requester: role.name, requesterId: role.id, status: 'Open', recipients: [], channels: { email: false, telegram: false }, created: now, ts: now, events: [{ ts: now, who: role.name, text: 'Raised from the EMI findings' }] }; await put('tickets', t); await audit(role.name, 'Raised EMI fix ticket', f.title, t.id); toast('Ticket ' + t.id + ' raised. Find it under Tickets.'); };
  const propose = (m, inst) => { try { sessionStorage.setItem('ac_prefill', JSON.stringify({ mi: m, inst })); } catch {} location.hash = '#/proposals'; };
  const iss = useMemo(() => S.ISS.map((n, i) => { const r = E.EV.filter(e => e.p < 2 && e.iss === i); const f = E.funnel(r); return { n, shown: r.length, declined: f.declined, rate: r.length ? Math.round(1000 * f.declined / r.length) / 10 : 0 }; }).sort((x, y) => y.rate - x.rate).slice(0, 5), []);
  const ten = E.tenureMix(E.EV.filter(e => e.p < 2));
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="EMI acceptance" sub="Scale EMI at checkout on UPI. EMI is the repayment structure, UPI is the rail, and the credit comes from a RuPay credit card or a credit line." />
    <Lifecycle active={['3']} />
    <div className="kpis"><div className="kt"><small>Merchants with EMI on UPI</small><b>{k.merchantsUpi} of {S.MERCH.length}</b><small>{k.merchantsCard} offer card EMI</small></div><div className="kt"><small>UPI EMI checkouts (30 days)</small><b>{k.upi.shown.toLocaleString('en-IN')}</b><small>plan shown to customer</small></div><div className="kt"><small>Converted to EMI</small><b>{k.upi.conversion}%</b><small>card EMI baseline {k.byProduct[2].conversion}%</small></div><div className="kt"><small>Approval once eligible</small><b>{k.upi.approval}%</b><small>card EMI baseline {k.byProduct[2].approval}%</small></div><div className="kt"><small>EMI sales on UPI</small><b>{money(k.upi.tpv)}</b><small>synthetic</small></div></div>
    <section className="card"><div className="row between wrap"><span className="eyebrow">Checkout funnel by product</span><span className="pill">Synthetic data</span></div>
      <div className="grid3t" style={{ alignItems: 'start' }}>{k.byProduct.map(p => <div key={p.id} className="insight col" style={{ gap: 8 }}><b>{p.name}</b><span className="mute sm">{p.merchants} merchants · {p.shown} checkouts</span><Funnel f={p} /><span className="sm" style={{ opacity: .8 }}>{p.status}</span></div>)}</div></section>
    <section className="card"><div className="row between wrap"><span className="eyebrow">What the data says · AI suggestion</span><span className="pill">{findings.length} findings</span></div>
      <div className="col" style={{ gap: 12 }}>{findings.map(f => { const raised = tix.find(t => t.findingId === f.id && t.kind === 'EMI fix'); return (<div key={f.id} className="insight col" style={{ gap: 6 }}><div className="row between wrap"><b>{f.title}</b><span className="pill">{f.kind}</span></div>{f.evidence.map((e, i) => <span key={i} className="sm">{e}</span>)}<span className="sm"><b>Likely cause:</b> {f.cause}</span><span className="sm"><b>Suggested action:</b> {f.action}</span>{canAct && (raised ? <span className="pill ok" style={{ width: 'fit-content' }}>Ticket {raised.id} · {raised.status}</span> : <div><button className="btn" onClick={() => raise(f)}>Raise a ticket</button></div>)}</div>); })}</div></section>
    <div className="grid2e"><section className="card"><span className="eyebrow">Issuers declining the conversion (UPI EMI)</span><table><thead><tr><th>Issuer</th><th>Attempts</th><th>Declined</th></tr></thead><tbody>{iss.map(x => <tr key={x.n}><td>{x.n}</td><td className="num">{x.shown}</td><td className="num"><b>{x.rate}%</b></td></tr>)}</tbody></table></section>
      <section className="card"><span className="eyebrow">Tenure chosen on UPI EMI</span><div className="funnel">{ten.map(t => <div key={t.tenure} className="frow"><span>{t.tenure} months</span><div className="fbar"><i style={{ width: t.share * 2.2 + '%' }} /></div><b className="num">{t.share}%</b></div>)}</div></section></div>
    <EmiShowcase onUse={m => { setMi(m); setProd(0); setTimeout(() => document.getElementById('emifit')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }} />
    <EmiTargeting mi={mi} onPick={setMi} />
    <section className="card"><span className="eyebrow">Assumptions behind the range · edit them</span><Assumption a={a} setA={setA} /><div className="row wrap" style={{ gap: 8 }}>{E.EMI_PRODUCTS.filter(p => p.code < 2).map(p => <button key={p.id} className={'btn' + (prod === p.code ? ' pri' : '')} onClick={() => setProd(p.code)}>{p.short}</button>)}</div></section>
    <EmiFitMatrix mi={mi} product={prod} assumption={a} canPropose={canPropose && !S.MERCH[mi].emi[prod]} onPropose={propose} />
  </div>);
}
