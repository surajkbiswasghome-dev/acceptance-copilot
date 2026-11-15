import React from 'react';
import { useScope, setScope } from './lib/scope.js';
// Workspace switch (demo admin only) and the network scope switch. Default scope is RuPay only.
export default function ScopeBar({ role, ws, setWs }) {
  const scope = useScope();
  return (
    <div className="scopebar" role="group" aria-label="Workspace and scope">
      {role.id === 'admin' ? <div className="seg" role="radiogroup" aria-label="Workspace">{[['acc', 'Acceptance Copilot'], ['aff', 'Affordability Engine']].map(([k, l]) => <button key={k} role="radio" aria-checked={ws === k} className={ws === k ? 'on' : ''} onClick={() => { setWs(k); location.hash = k === 'aff' ? '#/aoverview' : '#/insights'; }}>{l}</button>)}</div> : <span className="mute sm">{role.id === 'aff' ? 'Affordability Engine' : ''}</span>}
      <div className="scope">
        <span className="sm mute hide-sm">Scope</span>
        <div className="seg" role="radiogroup" aria-label="Network scope">
          <button role="radio" aria-checked={scope === 'rupay'} className={scope === 'rupay' ? 'on' : ''} onClick={() => setScope('rupay')} title="The NPCI view: RuPay credit card and credit line on UPI, and RuPay card EMI as the baseline">RuPay only</button>
          <button role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')} title="Adds other networks, debit EMI, cardless EMI, pay later, BIN logic and lender routing">Extended</button>
        </div>
      </div>
    </div>
  );
}
