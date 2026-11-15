import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import { useActivePolicy } from '../lib/policy.js';
import { Head } from '../ui.jsx';
import { ProductSeg, Ticket, DecisionPill, Synthetic, money } from '../AffParts.jsx';

const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export default function AffCustomers() {
  const policy = useActivePolicy(); const [code, setCode] = useState(0); const [ticket, setTicket] = useState(30000); const [cohort, setCohort] = useState(-1);
  const rows = useMemo(() => A.COHORTS.map((n, i) => { const c = A.CUSTOMERS.filter(x => x.cohort === i); return { n, count: c.length, share: Math.round(1000 * c.length / A.CUSTOMERS.length) / 10, income: med(c.map(x => x.income)), foir: Math.round(100 * avg(c.map(x => x.obligations / x.income))), card: Math.round(100 * c.filter(x => x.hasCard).length / c.length), line: Math.round(100 * c.filter(x => x.hasLine).length / c.length), onTime: Math.round(avg(c.map(x => x.onTime))), mandate: Math.round(100 * c.filter(x => x.mandate).length / c.length) }; }), []);
  const list = useMemo(() => A.CUSTOMERS.filter(c => cohort < 0 || c.cohort === cohort).slice(0, 14).map(c => ({ c, d: A.decide(c, ticket, code, policy) })), [cohort, ticket, code, policy]);
  const open = c => { try { sessionStorage.setItem('aff_customer', c.id); } catch {} location.hash = '#/adecide'; };
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Customers and cohorts" sub="The synthetic customer base the engine decides on. Nobody here is a real person." right={<Synthetic />} />
    <section className="card"><span className="eyebrow">Cohorts</span><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Cohort</th><th>Share</th><th>Median income</th><th>Obligations</th><th>Hold a card</th><th>Hold a line</th><th>On time</th><th>AutoPay</th></tr></thead><tbody>{rows.map(r => <tr key={r.n} className="tr" onClick={() => setCohort(cohort === A.COHORTS.indexOf(r.n) ? -1 : A.COHORTS.indexOf(r.n))} style={cohort === A.COHORTS.indexOf(r.n) ? { outline: '2px solid var(--acc)' } : null}><td><b>{r.n}</b></td><td className="num">{r.share}%</td><td className="num">{money(r.income)}</td><td className="num">{r.foir}% of income</td><td className="num">{r.card}%</td><td className="num">{r.line}%</td><td className="num">{r.onTime}%</td><td className="num">{r.mandate}%</td></tr>)}</tbody></table></div><span className="mute sm">Select a cohort to filter the list below. Obligations are existing monthly EMIs and loan payments.</span></section>
    <section className="card"><span className="eyebrow">Sample customers and what the engine decides</span><ProductSeg value={code} onChange={setCode} /><Ticket value={ticket} onChange={setTicket} />
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Customer</th><th>Cohort</th><th>Income</th><th>Decision</th><th>Score</th><th>Reasons</th></tr></thead><tbody>{list.map(({ c, d }) => <tr key={c.id} className="tr" onClick={() => open(c)}><td><b>{c.id}</b></td><td className="sm">{c.cohortName}</td><td className="num">{money(c.income)}</td><td><DecisionPill d={d.decision} /></td><td className="num">{d.score ?? '–'}</td><td className="sm">{d.reasons.join(', ') || '–'}</td></tr>)}</tbody></table></div><span className="mute sm">Select a customer to open the full decision.</span></section>
  </div>);
}
