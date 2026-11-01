import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { Head, Gate } from '../ui.jsx';

const presets = ['Electronics', 'Travel', 'Grocery'].map(c => S.MERCH.findIndex(m => m.category === c));
export default function Recommend() {
  const [mi, setMi] = useState(presets[0]);
  const r = useMemo(() => S.recommend(mi), [mi]); const p = r.profile; const m = p.merchant;
  const [price, setPrice] = useState(null); const P = price ?? Math.max(5000, p.avgTicket);
  const [months, setMonths] = useState(6); const [rate, setRate] = useState(14);
  const [fm, setFm] = useState(40); const [fi, setFi] = useState(30); const [fn, setFn] = useState(0);
  const [shift, setShift] = useState(5);
  const e = S.emi(P, rate, months), interest = e * months - P, cust = Math.max(0, 100 - fm - fi - fn), over = fm + fi + fn > 100;
  const sim = S.simulateShift(mi, shift); const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') ;
  const money = v => '₹' + Math.round(v).toLocaleString('en-IN');
  return (
    <>
      <Head title="Recommend" sub="Pick a merchant profile. Rules decide what to enable and which offer fits. Nothing here is a forecast." />
      <div className="row wrap"><span className="sm mute">Profile</span>{presets.map(i => <button key={i} className={'btn' + (mi === i ? ' pri' : '')} style={{ minHeight: 38 }} onClick={() => { setMi(i); setPrice(null); }}>{S.MERCH[i].category}</button>)}
        <select style={{ width: 'auto', minHeight: 38 }} value={mi} onChange={e => { setMi(+e.target.value); setPrice(null); }} aria-label="Merchant">{S.MERCH.map((x, i) => <option key={i} value={i}>{x.name} · {x.category}</option>)}</select></div>
      <section className="card"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><b style={{ fontSize: 20 }}>{m.name}</b><span className="mute sm">{m.category} · {m.segment} · {m.acquirer} · average ticket {money(p.avgTicket)} · {p.n} payments in 30 days · success {p.success}%</span></div></div>
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Instrument</th><th>Enabled</th><th>Share</th><th>Success</th></tr></thead><tbody>{p.mix.map(x => <tr key={x.instrument}><td>{x.instrument}</td><td><span className={'pill ' + (x.enabled ? 'ok' : 'bad')}>{x.enabled ? 'Enabled' : 'Not enabled'}</span></td><td className="num">{x.share ?? '–'}%</td><td className="num">{x.success ?? '–'}%</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="row between"><span className="eyebrow">What to enable or offer next</span><span className="pill">Rules-based</span></div>
        {r.recs.length === 0 && <p className="mute">This merchant already covers the instruments its profile suggests.</p>}
        <div className="list">{r.recs.map((x, i) => <div key={i} className="row between wrap"><div className="col" style={{ gap: 2, flex: 1, minWidth: 220 }}><b>{x.instrument}</b><span className="mute sm">{x.why}</span></div><Gate g={x.gate} /></div>)}</div>
        {r.recs.length > 0 && <a className="btn pri" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center' }} href={'#/enable?m=' + mi}>Prepare enablement</a>}</section>
      <section className="grid2e">
        <div className="card"><span className="eyebrow">Installment offer and funding split</span>
          <label className="col" style={{ gap: 4 }}><span className="row between sm"><span>Ticket</span><b className="num">{money(P)}</b></span><input type="range" min="1000" max="100000" step="500" value={P} onChange={e => setPrice(+e.target.value)} /></label>
          <label className="col" style={{ gap: 4 }}><span className="row between sm"><span>Tenure</span><b>{months} months</b></span><input type="range" min="3" max="24" step="3" value={months} onChange={e => setMonths(+e.target.value)} /></label>
          <label className="col" style={{ gap: 4 }}><span className="row between sm"><span>Interest rate (input, per year)</span><b className="num">{rate}%</b></span><input type="range" min="0" max="24" step="1" value={rate} onChange={e => setRate(+e.target.value)} /></label>
          <div className="insight row between wrap"><span className="col" style={{ gap: 0 }}><span className="eyebrow" style={{ fontSize: 11 }}>Monthly installment</span><b className="num" style={{ fontSize: 22 }}>{money(e)}</b></span><span className="col" style={{ gap: 0 }}><span className="eyebrow" style={{ fontSize: 11 }}>Total interest</span><b className="num" style={{ fontSize: 22 }}>{money(interest)}</b></span></div>
          <span className="eyebrow">Who funds the interest</span>
          {[['Merchant', fm, setFm], ['Issuer', fi, setFi], ['Network', fn, setFn]].map(([n, v, set]) => <label key={n} className="col" style={{ gap: 2 }}><span className="row between sm"><span>{n}</span><b className="num">{v}% · {money(interest * v / 100)}</b></span><input type="range" min="0" max="100" step="5" value={v} onChange={e => set(+e.target.value)} /></label>)}
          <div className="row between sm"><span>Customer pays</span><b className="num">{cust}% · {money(interest * cust / 100)}</b></div>
          {over ? <div className="err sm">Funding shares add up to more than 100%. Reduce one.</div> : cust === 0 ? <span className="pill ok">No-cost for the customer</span> : null}
          <span className="mute sm">Rates and splits are inputs to explore. They are not commercial terms.</span></div>
        <div className="card"><span className="eyebrow">Simulation</span><div className="banner">Simulation, not a forecast. Change the assumption to see what it implies.</div>
          <label className="col" style={{ gap: 4 }}><span className="row between sm"><span>Share of payments that move to UPI + RuPay credit</span><b className="num">{shift}%</b></span><input type="range" min="0" max="20" value={shift} onChange={e => setShift(+e.target.value)} /></label>
          <div className="insight col" style={{ gap: 8 }}>
            <div className="row between sm"><span>Merchant payments in 30 days (data)</span><b className="num">{sim.n}</b></div>
            <div className="row between"><span>Payments shifted to this instrument</span><b className="num">{sim.moved}</b></div>
            <div className="row between sm"><span>Success on this instrument (network data)</span><b className="num">{sim.instRate}%</b></div>
            <div className="row between sm"><span>Success at this merchant today (data)</span><b className="num">{sim.base}%</b></div>
            <div className="row between"><span>Implied change in successful payments</span><b className="num">{sgn(sim.delta)}{Math.abs(sim.delta).toFixed(1)}</b></div>
            <div className="row between"><span>Implied change in value at average ticket</span><b className="num">{sgn(sim.value)}{money(Math.abs(sim.value))}</b></div></div>
          <span className="mute sm">Change = (success on this instrument − success today) × payments shifted. These customers would have paid another way and often succeeded, so the change can be near zero or negative. Reach, affordability and basket size are what a pilot would test. Only a pilot can show a real effect.</span></div>
      </section>
    </>
  );
}
