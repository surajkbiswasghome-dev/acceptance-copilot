import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import { useActivePolicy } from '../lib/policy.js';
import { LENDERS, ROUTED, routePortfolio, routeOne } from '../lib/lenders.js';
import { ALL_PRODUCTS } from '../lib/ext.js';
import { Head } from '../ui.jsx';
import { Ticket, Synthetic, Illustrative, money, DecisionPill } from '../AffParts.jsx';

export default function AffLenders() {
  const policy = useActivePolicy(); const [code, setCode] = useState(1); const [ticket, setTicket] = useState(30000); const [fb, setFb] = useState(true); const [cuts, setCuts] = useState(LENDERS.map(l => l.cutoff)); const [cid, setCid] = useState('C-0007');
  const lenders = LENDERS.map((l, i) => ({ ...l, cutoff: cuts[i] }));
  const r = useMemo(() => routePortfolio(code, ticket, policy, lenders, fb), [code, ticket, policy, fb, cuts]);
  const rb = useMemo(() => routePortfolio(code, ticket, policy, lenders, !fb), [code, ticket, policy, fb, cuts]);
  const c = A.CUSTOMERS.find(x => x.id === cid) || A.CUSTOMERS[0]; const d = A.decide(c, ticket, code, policy); const t = routeOne(d, {}, 1, lenders);
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="Lender routing" sub="Extended scope. A light waterfall for lender-funded products: try the best-priced lender that accepts the customer and has capacity, then fall back." right={<><Synthetic /><span className="pill">Extended scope</span></>} />
    <section className="card"><div className="row wrap" style={{ gap: 8 }}>{ROUTED.map(k => <button key={k} className={'btn' + (code === k ? ' pri' : '')} aria-pressed={code === k} onClick={() => setCode(k)}>{ALL_PRODUCTS[k].short}</button>)}</div>
      <Ticket value={ticket} onChange={setTicket} /><label className="row" style={{ gap: 10 }}><input type="checkbox" checked={fb} onChange={e => setFb(e.target.checked)} style={{ accentColor: 'var(--acc)' }} /><span className="sm">Fall back to the next lender (waterfall)</span></label>
      <div className="kpis"><div className="kt"><small>Eligible customers</small><b>{r.eligible}</b><small>after the affordability decision</small></div><div className="kt"><small>Routed to a lender</small><b>{r.routedRate}%</b><small>{fb ? 'with fallback' : 'cheapest lender only'}</small></div><div className="kt"><small>Compared with {fb ? 'no fallback' : 'fallback'}</small><b>{rb.routedRate}%</b><small>{fb ? 'cheapest lender only' : 'with fallback'}</small></div></div>
      <table><thead><tr><th>Lender (fictional)</th><th>Score cut-off</th><th>Illustrative rate</th><th>Capacity</th><th>Routed</th><th>Average score</th></tr></thead><tbody>{lenders.map((l, i) => <tr key={l.id}><td><b>{l.name}</b></td><td><input type="range" min="30" max="75" value={cuts[i]} onChange={e => setCuts(cuts.map((x, k) => k === i ? +e.target.value : x))} style={{ width: 110 }} /> <b className="num">{cuts[i]}</b></td><td className="num">{l.rate}%</td><td className="num">{l.capacity >= 1 ? 'open' : Math.round(l.capacity * 100) + '% of volume'}</td><td className="num">{r.by[l.id].n}</td><td className="num">{r.by[l.id].avgScore || '–'}</td></tr>)}</tbody></table>
      <span className="mute sm">Not routed: {r.unrouted}. Lender names, cut-offs, rates and capacities are invented inputs. Real routing would use lender approval data and agreements.</span></section>
    <section className="card"><span className="eyebrow">One customer, step by step</span><div className="row wrap" style={{ gap: 12 }}><label className="col" style={{ gap: 4 }}><span className="sm mute">Customer</span><select value={cid} onChange={e => setCid(e.target.value)}>{A.CUSTOMERS.slice(0, 60).map(x => <option key={x.id} value={x.id}>{x.id} · {x.cohortName}</option>)}</select></label><DecisionPill d={d.decision} /><span className="sm">Score {d.score ?? '–'}</span></div>
      <ol className="sm" style={{ margin: 0, paddingLeft: 18 }}>{t.tried.map(x => <li key={x.id}>Lender {x.id}: {x.why}</li>)}<li><b>{t.lender ? 'Routed to ' + t.lender.name + ' at an illustrative ' + t.lender.rate + '%' : t.why}</b></li></ol></section>
    <Illustrative />
  </div>);
}
