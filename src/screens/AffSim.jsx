import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import * as S from '../lib/stats.js';
import { useActivePolicy } from '../lib/policy.js';
import { Head } from '../ui.jsx';
import { Ticket, DecisionPill, Reasons, Synthetic, money } from '../AffParts.jsx';

export default function AffSim() {
  const policy = useActivePolicy(); const per = A.personas(); const [pi, setPi] = useState(0); const [mi, setMi] = useState(S.SHOWCASE[0]); const [ticket, setTicket] = useState(36000); const [mandate, setMandate] = useState(null); const [pick, setPick] = useState(0); const [done, setDone] = useState(false);
  const c = per[pi]; const m = S.MERCH[mi]; const mnd = mandate ?? c.mandate;
  const r = useMemo(() => A.buildOffers(c, ticket, m.category, m.emi, policy, { assumeEnabled: true, mandate: mnd }), [pi, mi, ticket, mnd, policy]);
  const menu = r.menu; const chosen = menu[pick] || menu[0]; const d0 = r.decisions[0];
  const reset = () => { setPick(0); setDone(false); };
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Checkout simulator" sub="What this customer sees at a UPI checkout, and why. A simulation, not a forecast." right={<Synthetic />} />
    <div className="grid2e" style={{ alignItems: 'start' }}>
      <section className="card"><span className="eyebrow">Set the scene</span>
        <label className="col" style={{ gap: 4 }}><span className="sm mute">Customer</span><select value={pi} onChange={e => { setPi(+e.target.value); setMandate(null); reset(); }}>{per.map((p, i) => <option key={p.id} value={i}>{p.cohortName} · {p.id}</option>)}</select></label>
        <label className="col" style={{ gap: 4 }}><span className="sm mute">Merchant</span><select value={mi} onChange={e => { setMi(+e.target.value); reset(); }}>{S.MERCH_ORDER.map(i => <option key={i} value={i}>{(S.MERCH[i].showcase ? '★ ' : '') + S.MERCH[i].name}</option>)}</select></label>
        <Ticket value={ticket} onChange={v => { setTicket(v); reset(); }} />
        <label className="row" style={{ gap: 10 }}><input type="checkbox" checked={mnd} onChange={e => { setMandate(e.target.checked); reset(); }} style={{ accentColor: 'var(--acc)' }} /><span className="sm">Customer has a UPI AutoPay mandate</span></label>
        <div className="insight col" style={{ gap: 6 }}><div className="row between wrap"><b>Engine decision</b>{d0 && <DecisionPill d={d0.decision} />}</div><Reasons codes={r.decisions.flatMap(d => d.reasons).filter((x, i, a) => a.indexOf(x) === i)} />{d0?.unlock && <span className="sm" style={{ color: 'var(--acc)' }}>{d0.unlock}</span>}<span className="sm">{A.explainOffer(chosen, c)}</span></div></section>
      <section className="card"><div className="phone"><div className="row between sm"><b>{m.name}</b><span className="mute">UPI</span></div><div className="col" style={{ gap: 2 }}><span className="mute sm">Amount to pay</span><b style={{ fontSize: 28 }}>{money(ticket)}</b></div>
        <div className="sm mute">Pay with {c.hasCard ? 'RuPay credit card on UPI' : c.hasLine ? 'credit line on UPI' : 'bank account'}</div>
        {done ? <div className="insight col" style={{ gap: 4 }}><b>✓ Paid in instalments</b><span className="sm">{chosen.tenure} months at {money(chosen.emi)} a month{chosen.amount < ticket ? ', and ' + money(ticket - chosen.amount) + ' paid now' : ''}. Repayment by {chosen.repayment}.</span><button className="btn" onClick={reset}>Start again</button></div>
          : menu.length ? <><span className="eyebrow">Pay in instalments</span>{menu.map((o, i) => <button key={i} className={'opt' + (i === pick ? ' on' : '')} onClick={() => setPick(i)}><b>{o.tenure} months · {money(o.emi)} a month</b><span className="sm">{o.product.short}</span><span className="sm mute">{o.noCost ? 'No-cost EMI' : 'Interest applies'}{o.amount < ticket ? ' · on ' + money(o.amount) + ', pay ' + money(ticket - o.amount) + ' now' : ''}</span></button>)}<button className="btn pri" onClick={() => setDone(true)}>Pay in {chosen.tenure} months</button><button className="btn" onClick={() => setDone(true)}>Pay {money(ticket)} now</button></>
          : <div className="insight col" style={{ gap: 4 }}><b>No instalment option shown</b><span className="sm">The customer is not eligible at this ticket, so the checkout stays a normal UPI payment of {money(ticket)}. Nothing is offered that the customer cannot carry.</span></div>}
        <span className="mute sm" style={{ textAlign: 'center' }}>Simulation. Not a real payment.</span></div></section></div>
  </div>);
}
