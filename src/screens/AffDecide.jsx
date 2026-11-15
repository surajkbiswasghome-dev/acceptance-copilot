import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import { useActivePolicy } from '../lib/policy.js';
import { Head } from '../ui.jsx';
import { ProductSeg, Ticket, DecisionPill, Reasons, ScoreBars, Synthetic, Illustrative, money } from '../AffParts.jsx';

const start = () => { try { const id = sessionStorage.getItem('aff_customer'); if (id) { sessionStorage.removeItem('aff_customer'); return id; } } catch {} return A.personas()[0].id; };
export default function AffDecide() {
  const policy = useActivePolicy(); const [id, setId] = useState(start); const [code, setCode] = useState(0); const [ticket, setTicket] = useState(35000); const [mandate, setMandate] = useState(null); const [ed, setEd] = useState({});
  const base = A.CUSTOMERS.find(c => c.id === id) || A.CUSTOMERS[0]; const c = { ...base, ...ed }; if (ed.cardUtil != null) c.hasCard = base.hasCard; const m = mandate ?? c.mandate;
  const d = useMemo(() => A.decide(c, ticket, code, policy, { mandate: m }), [id, code, ticket, m, ed, policy]);
  const pick = v => { setId(v); setEd({}); setMandate(null); };
  const set = (k, v) => setEd({ ...ed, [k]: v });
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Eligibility and limit decision" sub="One customer, one ticket, one product. The decision, the score and the reason codes are always shown." right={<Synthetic />} />
    <section className="card"><div className="grid2e" style={{ alignItems: 'start' }}>
      <div className="col" style={{ gap: 12 }}><label className="col" style={{ gap: 4 }}><span className="sm mute">Customer</span><select value={id} onChange={e => pick(e.target.value)}>{A.personas().map(p => <option key={p.id} value={p.id}>{p.id} · {p.cohortName} (example)</option>)}{A.CUSTOMERS.slice(0, 120).filter(x => !A.personas().some(p => p.id === x.id)).map(x => <option key={x.id} value={x.id}>{x.id} · {x.cohortName}</option>)}</select></label>
        <ProductSeg value={code} onChange={setCode} /><Ticket value={ticket} onChange={setTicket} />
        <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={m} onChange={e => setMandate(e.target.checked)} style={{ accentColor: 'var(--acc)' }} /><span className="sm">UPI AutoPay mandate set up for repayment</span></label>
        <details><summary className="sm" style={{ cursor: 'pointer' }}>Change this customer (what-if)</summary><div className="col" style={{ gap: 10, marginTop: 10 }}>
          <label className="slider"><span className="sm">Monthly income: <b>{money(c.income)}</b></span><input type="range" min="12000" max="250000" step="1000" value={c.income} onChange={e => set('income', +e.target.value)} /></label>
          <label className="slider"><span className="sm">Existing monthly obligations: <b>{money(c.obligations)}</b></span><input type="range" min="0" max={Math.round(c.income * 0.7)} step="500" value={Math.min(c.obligations, Math.round(c.income * 0.7))} onChange={e => set('obligations', +e.target.value)} /></label>
          <label className="slider"><span className="sm">Limit used: <b>{code === 1 ? c.lineUtil : c.cardUtil}%</b></span><input type="range" min="0" max="95" value={code === 1 ? c.lineUtil : c.cardUtil} onChange={e => set(code === 1 ? 'lineUtil' : 'cardUtil', +e.target.value)} /></label>
          <label className="slider"><span className="sm">Paid on time: <b>{c.onTime}%</b></span><input type="range" min="55" max="100" value={c.onTime} onChange={e => set('onTime', +e.target.value)} /></label></div></details></div>
      <div className="col" style={{ gap: 12 }}><div className="row between wrap"><DecisionPill d={d.decision} /><span className="pill">{d.product.short}</span></div>
        <div className="kpis"><div className="kt"><small>EMI offered on</small><b>{d.amount ? money(d.amount) : '–'}</b><small>{d.amount && d.amount < ticket ? 'pay ' + money(ticket - d.amount) + ' now' : 'the full ticket'}</small></div><div className="kt"><small>Affordable monthly EMI</small><b>{money(d.maxEmi)}</b><small>{policy.maxFoir}% of income less obligations</small></div><div className="kt"><small>Available limit</small><b>{money(d.available)}</b><small>{c.cohortName}</small></div></div>
        <div className="insight col" style={{ gap: 6 }}><b>Reason codes</b><Reasons codes={d.reasons} />{d.unlock && <span className="sm" style={{ color: 'var(--acc)' }}><b>Unlock:</b> {d.unlock}</span>}</div></div></div></section>
    <div className="grid2e"><section className="card"><span className="eyebrow">Scorecard</span><ScoreBars d={d} /><span className="mute sm">Cut-off: approve from {policy.minScore + policy.stepUpBand}, step-up from {policy.minScore}, decline below.</span></section>
      <section className="card"><span className="eyebrow">Instalment options this customer can afford</span>{d.tenures.length ? <table><thead><tr><th>Tenure</th><th>Monthly EMI</th><th>Share of capacity</th><th>Total repaid</th></tr></thead><tbody>{d.tenures.map(t => <tr key={t.tenure}><td><b>{t.tenure} months</b></td><td className="num">{money(t.emi)}</td><td className="num">{t.share}%</td><td className="num">{money(t.total)}</td></tr>)}</tbody></table> : <span className="sm mute">None. No instalment option is shown that the customer cannot carry.</span>}
        <div className="insight col" style={{ gap: 4 }}><b>Repayment mode</b><span className="sm">{d.repayment}. Collecting by AutoPay lowers the chance of a missed instalment, so it counts towards the score. Mandate set-up and retries are handled by the lender and are not built here.</span></div></section></div>
    <Illustrative />
  </div>);
}
