import React, { useMemo, useState } from 'react';
import * as S from '../lib/stats.js';
import { useKey, audit } from '../lib/store.js';
import { Head, Bar } from '../ui.jsx';

const STEPS = ['Confirm the acquirer supports the instrument on this merchant’s route', 'Check issuer and BIN coverage for the instrument', 'Enable the instrument in the gateway configuration', 'Run a test transaction in the sandbox', 'Approve checkout prompt and offer wording', 'Go live for the merchant and watch results for 7 days'];
const fromHash = () => { const x = location.hash.split('?m=')[1]; return x ? +x : null; };
export default function Enable({ role }) {
  const withRecs = useMemo(() => S.MERCH.map((m, i) => i).filter(i => S.recommend(i).recs.length), []);
  const [mi, setMi] = useState(fromHash() ?? withRecs[0]);
  const [checks, setChecks] = useKey('ac_checks', {}); const done = checks[mi] || [];
  const r = S.recommend(mi); const m = r.profile.merchant;
  const items = r.recs.map(x => x.instrument).join(', ') || 'your current set';
  const [msg, setMsg] = useState(null);
  const draft = `Hello ${m.name} team,\n\nOver the last 30 days your checkout handled ${r.profile.n} payments with a ${r.profile.success}% success rate. We would like to enable the following for you: ${items}.\n\nWe suggest a small trial of 8 weeks, with results reviewed together before any wider rollout. Could we set up a 20-minute call this week to confirm the technical steps and checkout wording?\n\nRegards,\n${role.name}`;
  const text = msg ?? draft;
  const toggle = i => setChecks(c => { const cur = c[mi] || []; return { ...c, [mi]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] }; });
  return (
    <>
      <Head title="Enable" sub="A checklist and a drafted message for the merchant. Nothing is sent from here." />
      <select style={{ maxWidth: 420 }} value={mi} onChange={e => { setMi(+e.target.value); setMsg(null); }} aria-label="Merchant">{withRecs.map(i => <option key={i} value={i}>{S.MERCH[i].name} · {S.MERCH[i].category}</option>)}</select>
      <div className="grid2e" style={{ alignItems: 'start' }}>
        <section className="card"><div className="row between"><span className="eyebrow">Checklist</span><b className="num sm">{done.length}/{STEPS.length}</b></div><Bar v={done.length} max={STEPS.length} />
          <div>{STEPS.map((s, i) => <label key={i} className="check"><input type="checkbox" checked={done.includes(i)} onChange={() => { toggle(i); audit(role.name, done.includes(i) ? 'Unchecked' : 'Checked', m.name, s); }} /><span>{s}</span></label>)}</div></section>
        <section className="card"><span className="eyebrow">Drafted message</span><textarea value={text} onChange={e => setMsg(e.target.value)} aria-label="Drafted message" />
          <div className="row wrap"><button className="btn pri" onClick={() => { navigator.clipboard?.writeText(text); audit(role.name, 'Copied draft', m.name); }}>Copy message</button><button className="btn" onClick={() => audit(role.name, 'Marked as sent', m.name, 'Message sent outside this tool')}>Mark as sent</button></div>
          <span className="mute sm">You review and send it yourself. “Mark as sent” only writes to the audit log.</span></section>
      </div>
    </>
  );
}
