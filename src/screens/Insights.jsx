import React, { useState } from 'react';
import * as S from '../lib/stats.js';
import { Head } from '../ui.jsx';
import Overview from './insights/Overview.jsx';
import Explore from './insights/Explore.jsx';
import Routing from './insights/Routing.jsx';
import Grow from './insights/Grow.jsx';

const STEPS = [['overview', 'Overview', 'What is happening'], ['explore', 'Explore', 'Cut it any way'], ['routing', 'Routing', 'Which acquirer, and why'], ['grow', 'Grow', 'Where acceptance can rise']];
export default function Insights() {
  const [step, setStep] = useState('overview'); const [preset, setPreset] = useState(null); const [merchant, setMerchant] = useState('');
  const lensFilters = merchant === '' ? {} : { merchant: Number(merchant) }; const lens = { merchant: merchant === '' ? null : Number(merchant) };
  const goto = (s, p) => { setPreset(p || null); setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (<>
    <Head title="Insights" sub="From what is happening, to why, to what to do about it. Synthetic data; every figure is computed from it." right={<span className="pill">Synthetic data</span>} />
    <div className="lens"><span className="eyebrow">View as</span><select value={merchant} onChange={e => setMerchant(e.target.value)} aria-label="View as" style={{ maxWidth: 320, minHeight: 40 }}><option value="">Payment aggregator: whole portfolio</option>{S.MERCH.map((m, i) => <option key={i} value={i}>Merchant: {m.name} ({m.category})</option>)}</select></div>
    <div className="stepper" role="tablist">{STEPS.map(([k, l, d], i) => <button key={k} role="tab" aria-selected={step === k} className={step === k ? 'on' : ''} onClick={() => goto(k)}><b>{i + 1}</b><span>{l}<small>{d}</small></span></button>)}</div>
    {step === 'overview' && <Overview key={merchant} filters={lensFilters} goto={goto} />}
    {step === 'explore' && <Explore key={merchant + JSON.stringify(preset)} lensFilters={lensFilters} preset={preset} goto={goto} />}
    {step === 'routing' && <Routing lens={lens} goto={goto} />}
    {step === 'grow' && <Grow key={merchant} filters={lensFilters} lens={lens} />}
  </>);
}
