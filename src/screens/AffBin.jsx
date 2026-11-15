import React, { useMemo, useState } from 'react';
import * as A from '../lib/afford.js';
import { useActivePolicy } from '../lib/policy.js';
import { BINS, ALL_PRODUCTS, binInfo, ISSUER_CAPS } from '../lib/ext.js';
import { Head } from '../ui.jsx';
import { Ticket, Synthetic, Illustrative, money } from '../AffParts.jsx';

const yes = v => <span className={'pill ' + (v ? 'ok' : '')}>{v ? 'Enabled' : 'Off'}</span>;
export default function AffBin() {
  const policy = useActivePolicy(); const [bin, setBin] = useState('901001'); const [ticket, setTicket] = useState(30000); const b = binInfo(bin) || BINS[0];
  const rows = useMemo(() => ALL_PRODUCTS.map(p => ({ p, n: A.CUSTOMERS.filter(c => A.productAvailable(c, p.code)).length, on: p.code < 3 ? A.portfolio(policy, ticket, p.code, () => true, {}).approvalRate : A.portfolio(policy, ticket, p.code).approvalRate, bin: p.code < 3 ? A.portfolio(policy, ticket, p.code, () => true, { binAware: true }).approvalRate : A.portfolio(policy, ticket, p.code, () => true, { binAware: true }).approvalRate })), [policy, ticket]);
  const cover = useMemo(() => BINS.filter(x => x.network === 'RuPay' && x.type === 'Credit').map(x => ({ ...x, n: A.CUSTOMERS.filter(c => c.bin === x.bin).length })), []);
  return (<div className="col" style={{ gap: 18 }}>
    <Head title="BINs and networks" sub="Extended scope. Which cards and instruments the engine can decide on, and what a BIN being switched off does to approvals." right={<><Synthetic /><span className="pill">Extended scope</span></>} />
    <section className="card"><span className="eyebrow">Instrument coverage across 600 synthetic customers</span><Ticket value={ticket} onChange={setTicket} />
      <table><thead><tr><th>Product</th><th>Customers holding the instrument</th><th>Approved, issuer check only</th><th>Approved, issuer and BIN check</th></tr></thead><tbody>{rows.map(r => <tr key={r.p.id}><td><b>{r.p.short}</b>{r.p.code > 2 && <span className="mute sm"> · extended</span>}</td><td className="num">{r.n}</td><td className="num">{r.on}%</td><td className="num">{r.bin}%</td></tr>)}</tbody></table>
      <span className="mute sm">RuPay credit card and credit line on UPI are the core. Visa and Mastercard credit cards exist only on card rails: other networks cannot be used on UPI. Debit EMI, cardless EMI and pay later are shown for comparison and are lender or bank funded.</span></section>
    <div className="grid2e" style={{ alignItems: 'start' }}>
      <section className="card"><span className="eyebrow">BIN checker (fictional BINs)</span><label className="col" style={{ gap: 4 }}><span className="sm mute">BIN</span><select value={bin} onChange={e => setBin(e.target.value)}>{BINS.map(x => <option key={x.bin} value={x.bin}>{x.bin} · {x.issuerName} · {x.network} {x.type.toLowerCase()}</option>)}</select></label>
        <div className="grid3t"><div className="kt"><small>Issuer</small><b>{b.issuerName}</b><small>Synthetic</small></div><div className="kt"><small>Network</small><b>{b.network}</b><small>{b.type} card</small></div><div className="kt"><small>Issuer switch</small><b>{ISSUER_CAPS[b.issuer].upiEmi ? 'On' : 'Off'}</b><small>EMI on UPI, RuPay</small></div></div>
        <table><tbody><tr><td>EMI on RuPay credit card on UPI</td><td>{yes(b.upiEmi)}</td></tr><tr><td>Credit line on UPI</td><td>{yes(b.line)}</td></tr><tr><td>Card EMI on card rails</td><td>{yes(b.cardEmi)}</td></tr></tbody></table>
        <span className="mute sm">Only RuPay credit BINs can carry EMI on UPI. A BIN can be off even when its issuer is on, which is why BIN-level data matters.</span></section>
      <section className="card"><span className="eyebrow">RuPay credit BINs and customers</span><table><thead><tr><th>BIN</th><th>Issuer</th><th>Customers</th><th>EMI on UPI</th></tr></thead><tbody>{cover.map(x => <tr key={x.bin}><td className="num">{x.bin}</td><td>{x.issuerName}</td><td className="num">{x.n}</td><td>{yes(x.upiEmi)}</td></tr>)}</tbody></table></section></div>
    <Illustrative />
  </div>);
}
