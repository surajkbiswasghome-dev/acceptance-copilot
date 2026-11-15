import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import * as E from '../lib/emi.js';
import { useActivePolicy } from '../lib/policy.js';
import { Head } from '../ui.jsx';
import { useExtended } from '../lib/scope.js';
import { ALL_PRODUCTS } from '../lib/ext.js';
import { Lifecycle } from '../Lifecycle.jsx';
import { ProductSeg, Ticket, Stack, Synthetic, Illustrative, money } from '../AffParts.jsx';

export default function AffOverview({ role }) {
  const ext = useExtended();
  const policy = useActivePolicy(); const [code, setCode] = useState(0); const [ticket, setTicket] = useState(30000);
  const pf = useMemo(() => A.portfolio(policy, ticket, code), [policy, ticket, code]);
  const unlock = useMemo(() => A.CUSTOMERS.filter(c => !c.mandate && A.productAvailable(c, code)).filter(c => { const d = A.decide(c, ticket, code, policy); return d.decision === 'Step-up' && d.unlock; }).length, [policy, ticket, code]);
  const top = Object.entries(pf.reasons).sort((a, b) => b[1] - a[1]); const noInst = pf.reasons.R07 || 0;
  const cohortTotals = A.cohortShare();
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Affordability Engine" sub="Who can afford what, at checkout. It decides eligibility and limits, builds the offer, and always says why." right={<Synthetic />} />
    <Lifecycle active={['1', '3', '4']} />
    <section className="card"><div className="row between wrap"><span className="eyebrow">Decisions across {pf.n} synthetic customers</span><span className="pill">Policy in force: {policy === A.DEFAULT_POLICY ? 'defaults' : 'approved change'}</span></div>
      <ProductSeg value={code} onChange={setCode} /><Ticket value={ticket} onChange={setTicket} />
      <div className="kpis"><div className="kt"><small>Approved, with or without a condition</small><b>{pf.approvalRate}%</b><small>{pf.approved} of {pf.n} customers</small></div><div className="kt"><small>Average amount converted</small><b>{money(pf.avgExposure)}</b><small>per approved customer</small></div><div className="kt"><small>Thin-margin approvals</small><b>{pf.thinShare}%</b><small>close to the score cut-off</small></div><div className="kt"><small>No eligible instrument</small><b>{Math.round(1000 * noInst / pf.n) / 10}%</b><small>engine cannot create credit</small></div></div>
      <Stack tally={pf.tally} n={pf.n} /></section>
    <div className="grid2e"><section className="card"><span className="eyebrow">Why customers are declined or conditioned</span><table><thead><tr><th>Code</th><th>Reason</th><th>Customers</th></tr></thead><tbody>{top.map(([c, n]) => <tr key={c}><td><span className="pill">{c}</span></td><td className="sm">{A.REASONS[c]}</td><td className="num">{n}</td></tr>)}</tbody></table></section>
      <section className="card"><span className="eyebrow">Approval by customer cohort</span><div className="funnel">{pf.byCohort.map((c, i) => <div key={c.cohort} className="frow"><span className="sm">{c.cohort}</span><div className="fbar"><i style={{ width: c.rate + '%' }} /></div><b className="num">{c.rate}% <span className="mute sm">of {c.n}</span></b></div>)}</div></section></div>
    <section className="card"><span className="eyebrow">What the engine suggests · AI suggestion</span><div className="col" style={{ gap: 10 }}>
      <div className="insight col" style={{ gap: 4 }}><b>{unlock} customers move from Step-up to Approve if they set up a UPI AutoPay mandate</b><span className="sm">Repayment mode is part of the decision. A mandate raises the score by {policy.mandateBonus} points. Offer the mandate at checkout rather than declining.</span></div>
      {top[0] && <div className="insight col" style={{ gap: 4 }}><b>Largest single reason at this ticket: {top[0][0]}, {A.REASONS[top[0][0]].toLowerCase()}</b><span className="sm">{top[0][0] === 'R07' ? 'These customers hold no eligible card or credit line for this product. Credit origination by issuers and lenders is the lever, not policy.' : 'Review the policy thresholds under Policy, and compare the effect before changing anything.'}</span></div>}
      <div className="insight col" style={{ gap: 4 }}><b>{pf.tally['Approve a smaller amount']} customers are offered EMI on a smaller amount</b><span className="sm">At {money(ticket)}, their limit or income cannot carry the full ticket. The rest is paid now, so the sale is kept instead of lost.</span></div></div></section>
    {ext && <section className="card"><span className="eyebrow">All products at {money(ticket)} · extended scope</span><table><thead><tr><th>Product</th><th>Customers holding it</th><th>Approved</th><th>Repayment</th></tr></thead><tbody>{ALL_PRODUCTS.map(p => { const pf = A.portfolio(policy, ticket, p.code); return <tr key={p.id}><td><b>{p.short}</b></td><td className="num">{A.CUSTOMERS.filter(c => A.productAvailable(c, p.code)).length}</td><td className="num">{pf.approvalRate}%</td><td className="sm">{p.repay || (p.code === 1 ? 'UPI AutoPay mandate' : 'Card bill, paid by any rail')}</td></tr>; })}</tbody></table><span className="mute sm">The first three rows are the RuPay core. The rest are extra instruments shown for comparison.</span></section>}
    <Illustrative />
  </div>);
}
