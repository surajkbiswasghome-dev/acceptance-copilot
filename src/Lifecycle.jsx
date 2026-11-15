import React from 'react';
// The four stages of credit-funded purchases on UPI. Shows where each screen sits.
const STAGES = [
  ['1', 'Credit origination', 'Who gets a card or line, and what limit', 'Affordability Engine'],
  ['2', 'Credit utilisation', 'Spending that credit on UPI', 'Acceptance: credit on UPI'],
  ['3', 'EMI conversion', 'Turning the purchase into instalments at checkout', 'EMI acceptance and Offer Engine'],
  ['4', 'EMI repayment', 'Collecting instalments: AutoPay, card bill', 'A factor in every decision']
];
export function Lifecycle({ active = [] }) {
  return (<div className="lifecycle" role="list" aria-label="Four stages: credit origination, utilisation, EMI conversion and repayment">{STAGES.map(s => (<div key={s[0]} role="listitem" className={'lc' + (active.includes(s[0]) ? ' on' : '')}><span className="lcn">{s[0]}</span><b>{s[1]}</b><span className="mute sm">{s[2]}</span><span className="lcw">{s[3]}</span></div>))}</div>);
}
