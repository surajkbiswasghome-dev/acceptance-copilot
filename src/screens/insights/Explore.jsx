import { Info, Reveal } from '../../ui.jsx';
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import * as S from '../../lib/stats.js';
import * as A from '../../lib/analytics.js';
import { AX, GRID, colorOf, Tip, Donut, Legend2, Table } from '../../charts.jsx';
import { drillSections } from './Overview.jsx';

const PRESETS = [
  { n: 'Success by acquirer and network', s: { x: 'acquirer', y: 'success', split: 'network', type: 'bar' } },
  { n: 'Daily success by acquirer', s: { x: 'day', y: 'success', split: 'acquirer', type: 'line', smooth: 3 } },
  { n: 'Latency by network and acquirer', s: { x: 'network', y: 'p95', split: 'acquirer', type: 'bar' } },
  { n: 'Cost by payment mode', s: { x: 'mode', y: 'cost', split: 'acquirer', type: 'bar' } },
  { n: 'Failures by ticket size', s: { x: 'ticket', y: 'failed', split: '', type: 'bar' } },
  { n: 'Share of payments by network', s: { x: 'network', y: 'volume', split: '', type: 'pie' } }
];
const heatColor = v => { if (v == null) return 'var(--s2)'; const t = Math.max(0, Math.min(1, (v - 80) / 20)); const bad = [255, 107, 122], mid = [245, 184, 61], good = [45, 212, 167]; const m = t < .5 ? [bad, mid, t * 2] : [mid, good, (t - .5) * 2]; return `rgb(${m[0].map((c, i) => Math.round(c + (m[1][i] - c) * m[2])).join(',')})`; };
const Sel = ({ label, value, onChange, opts }) => (<label>{label}<select value={value} onChange={e => onChange(e.target.value)}>{opts.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>);
const dimOpts = (none) => [...(none ? [['', 'None']] : []), ...Object.entries(A.DIMS).map(([k, d]) => [k, d.label])];
const metOpts = Object.entries(A.METRICS).map(([k, m]) => [k, m.label]);
const uniq = (get) => [...new Set(S.TX.map(get))].sort();
const FILT = [['acquirer', 'Acquirer', S.ACQ], ['mode', 'Payment mode', ['Cards', 'UPI', 'Net banking', 'Wallets']], ['network', 'Network', uniq(t => A.NETWORK(t.inst))], ['issuer', 'Issuer', S.ISS], ['category', 'Category', uniq(t => t.cat)]];

export default function Explore({ lensFilters, preset, goto }) {
  const [cfg, setCfg] = useState({ x: 'acquirer', y: 'success', split: 'network', type: 'bar', smooth: 3, ...(preset?.cfg || {}) });
  const [fl, setFl] = useState({ ...(preset?.filters || {}) }); const [pick, setPick] = useState(null);
  const [hm, setHm] = useState({ r: 'acquirer', c: 'network', y: 'success', third: 'issuer', thirdVal: '' }); const [cell, setCell] = useState(null);
  const filters = { ...lensFilters, ...Object.fromEntries(Object.entries(fl).filter(([, v]) => v)) };
  const res = useMemo(() => A.aggregate({ ...cfg, filters }), [cfg, JSON.stringify(filters)]);
  const COUNT = ['volume', 'gmv', 'failed'];
  const set = (k, v) => { setPick(null); setCfg(c => { const n = { ...c, [k]: v }; if (k === 'type' && v === 'pie') { n.split = ''; if (!COUNT.includes(n.y)) n.y = 'volume'; } else if (n.type === 'pie' && (n.split || !COUNT.includes(n.y))) n.type = 'bar'; return n; }); };
  const M = res.metric; const isPct = M.unit === '%';
  const canPie = !cfg.split && ['volume', 'gmv', 'failed'].includes(cfg.y);
  const pieData = res.data.map((d, i) => ({ name: d.x, value: d.All ?? 0, color: colorOf(i), share: null }));
  const click = x => setPick(p => (p === x ? null : x));
  // heatmap
  const hmFilters = { ...filters, ...(hm.thirdVal ? { [hm.third]: hm.thirdVal } : {}) };
  const rows = useMemo(() => A.filterRows(hmFilters), [JSON.stringify(hmFilters)]);
  const rk = useMemo(() => [...new Set(rows.map(A.DIMS[hm.r].get))].sort(), [rows, hm.r]); const ck = useMemo(() => [...new Set(rows.map(A.DIMS[hm.c].get))].sort(), [rows, hm.c]);
  const val = (r, c) => { const sub = rows.filter(t => A.DIMS[hm.r].get(t) === r && A.DIMS[hm.c].get(t) === c); return { n: sub.length, v: sub.length >= 12 ? A.METRICS[hm.y].fn(sub) : null }; };
  const thirdOpts = Object.keys(A.DIMS).filter(d => d !== hm.r && d !== hm.c && d !== 'day' && d !== 'ticket'); const thirdVals = hm.third ? [...new Set(S.TX.map(A.DIMS[hm.third].get))].sort() : [];
  const filterKeyOf = d => (['acquirer', 'mode', 'network', 'issuer', 'category'].includes(d) ? d : null);
  const dr = pick && filterKeyOf(cfg.x) ? drillSections(cfg.x, pick, filters) : null;
  return (<div className="col gap16">
    <section className="card"><span className="eyebrow">Start from a view, then change anything<Info k="explore" /></span>
      <div className="row wrap">{PRESETS.map(p => <button key={p.n} className="btn" style={{ minHeight: 36, fontSize: 13 }} onClick={() => { setPick(null); setCfg({ smooth: 1, ...p.s }); }}>{p.n}</button>)}</div>
      <div className="ctrls"><Sel label="X axis" value={cfg.x} onChange={v => set('x', v)} opts={dimOpts()} /><Sel label="Y axis (metric)" value={cfg.y} onChange={v => set('y', v)} opts={metOpts} /><Sel label="Split by" value={cfg.split} onChange={v => set('split', v)} opts={dimOpts(true).filter(o => o[0] !== cfg.x)} />
        {cfg.x === 'day' && <Sel label="Smoothing" value={String(cfg.smooth)} onChange={v => set('smooth', Number(v))} opts={[['1', 'None'], ['3', '3-day rolling'], ['7', '7-day rolling']]} />}<label>Chart<div className="seg">{[['line', 'Line'], ['bar', 'Bars'], ['area', 'Area'], ['pie', 'Pie']].map(([k, l]) => <button key={k} className={cfg.type === k ? 'on' : ''} onClick={() => set('type', k)} title={k === 'pie' ? 'Pie shows the share of a count (payments, value or failures), so it clears the split' : ''}>{l}</button>)}</div></label></div>
      <div className="ctrls">{FILT.map(([k, l, opts]) => <Sel key={k} label={'Filter: ' + l} value={fl[k] || ''} onChange={v => { setPick(null); setFl(f => ({ ...f, [k]: v })); }} opts={[['', 'All'], ...opts.map(o => [o, o])]} />)}{Object.values(fl).some(Boolean) && <button className="btn" style={{ minHeight: 40 }} onClick={() => setFl({})}>Clear filters</button>}</div></section>
    <section className="card"><div className="row between wrap"><span className="eyebrow">{M.label} by {res.xLabel.toLowerCase()}{cfg.split ? ', split by ' + A.DIMS[cfg.split].label.toLowerCase() : ''}</span><span className="mute sm">{res.rows.toLocaleString('en-IN')} payments · click to break down</span></div>
      {res.data.length === 0 ? <div className="insight mute">No payments match these filters.</div> : cfg.type === 'pie' ? (<div className="grid-ins" style={{ alignItems: 'center' }}><Reveal h={260}><Donut data={pieData} centre={res.rows.toLocaleString('en-IN')} sub={M.label} onPick={n => click(n)} selected={pick} /></Reveal><Legend2 data={pieData.map(d => ({ ...d, share: Math.round((1000 * d.value) / (pieData.reduce((a, b) => a + b.value, 0) || 1)) / 10 }))} onPick={click} selected={pick} /></div>)
        : (<Reveal h={340}><div style={{ height: 340 }}><ResponsiveContainer width="100%" height="100%">{cfg.type === 'line' ? (
          <LineChart data={res.data} margin={{ left: -6, right: 8, top: 8 }}><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="x" tick={AX} stroke={GRID} interval="preserveStartEnd" /><YAxis tick={AX} stroke={GRID} domain={isPct && cfg.y === 'success' ? [80, 100] : ['auto', 'auto']} /><Tooltip content={<Tip unit={M.unit} />} /><Legend wrapperStyle={{ fontSize: 12 }} />
            {res.series.map((s, i) => <Line key={s} type="monotone" dataKey={s} stroke={colorOf(i)} strokeWidth={2.4} dot={false} activeDot={{ r: 6, onClick: (_, e) => click(e.payload.x) }} connectNulls animationDuration={1000} />)}</LineChart>)
          : cfg.type === 'area' ? (<AreaChart data={res.data} margin={{ left: -6, right: 8, top: 8 }}><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="x" tick={AX} stroke={GRID} interval="preserveStartEnd" /><YAxis tick={AX} stroke={GRID} domain={isPct && cfg.y === 'success' ? [80, 100] : ['auto', 'auto']} /><Tooltip content={<Tip unit={M.unit} />} /><Legend wrapperStyle={{ fontSize: 12 }} />
            {res.series.map((s, i) => <Area key={s} type="monotone" dataKey={s} stroke={colorOf(i)} fill={colorOf(i)} fillOpacity={0.18} strokeWidth={2.2} connectNulls animationDuration={1000} />)}</AreaChart>)
          : (<BarChart data={res.data} margin={{ left: -6, right: 8, top: 8 }}><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="x" tick={AX} stroke={GRID} interval={0} angle={res.data.length > 8 ? -30 : 0} textAnchor={res.data.length > 8 ? 'end' : 'middle'} height={res.data.length > 8 ? 60 : 30} /><YAxis tick={AX} stroke={GRID} domain={isPct ? [0, 100] : [0, 'auto']} /><Tooltip content={<Tip unit={M.unit} />} cursor={{ fill: 'var(--s2)', opacity: 0.6 }} /><Legend wrapperStyle={{ fontSize: 12 }} />
            {res.series.map((s, i) => <Bar key={s} dataKey={s} fill={colorOf(i)} radius={[6, 6, 0, 0]} onClick={d => click(d.x)} cursor="pointer" animationDuration={900}>{res.data.map(d => <Cell key={d.x} fill={colorOf(i)} opacity={pick && pick !== d.x ? 0.35 : 1} />)}</Bar>)}</BarChart>)}</ResponsiveContainer></div></Reveal>)}
      {res.data.length > 0 && cfg.type !== 'pie' && <details><summary className="mute sm" style={{ cursor: 'pointer' }}>Show the numbers</summary><Table cols={[{ k: 'x', h: res.xLabel }, ...res.series.map(s => ({ k: s, h: s, right: true, f: r => (r[s] == null ? '–' : r[s] + M.unit) }))]} rows={res.data} /></details>}</section>
    {dr && <div className="drill"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Drill-down</span><b style={{ fontSize: 18 }}>{pick}</b></div><button className="btn" style={{ minHeight: 36 }} onClick={() => setPick(null)}>Close</button></div>
      {dr.map(sec => <div key={sec.title} className="col"><span className="eyebrow">{sec.title}</span><Table cols={[{ k: 'key', h: 'Segment' }, { k: 'n', h: 'Payments', right: true }, { k: 'success', h: 'Success', right: true, f: r => (r.success == null ? '–' : r.success + '%') }, { k: 'timeout', h: 'Timeouts', right: true, f: r => (r.timeout == null ? '–' : r.timeout + '%') }, { k: 'latency', h: 'Median ms', right: true }, { k: 'cost', h: 'Cost idx', right: true }]} rows={sec.rows} /></div>)}</div>}
    <section className="card"><div className="row between wrap"><span className="eyebrow">Combinations: any two on the grid, a third as a filter<Info k="ex-grid" /></span><span className="mute sm">Cells with fewer than 12 payments are left blank. Click a cell for detail.</span></div>
      <div className="ctrls"><Sel label="Rows" value={hm.r} onChange={v => { setCell(null); setHm(h => ({ ...h, r: v, third: h.third === v ? 'issuer' : h.third, thirdVal: '' })); }} opts={dimOpts().filter(o => !['day', 'ticket'].includes(o[0]))} /><Sel label="Columns" value={hm.c} onChange={v => { setCell(null); setHm(h => ({ ...h, c: v, third: h.third === v ? 'issuer' : h.third, thirdVal: '' })); }} opts={dimOpts().filter(o => !['day', 'ticket'].includes(o[0]))} />
        <Sel label="Measure" value={hm.y} onChange={v => setHm(h => ({ ...h, y: v }))} opts={[['success', 'Success rate'], ['timeout', 'Timeout rate'], ['latency', 'Median latency'], ['cost', 'Cost index']]} />
        <Sel label="Third dimension" value={hm.third} onChange={v => setHm(h => ({ ...h, third: v, thirdVal: '' }))} opts={thirdOpts.map(d => [d, A.DIMS[d].label])} /><Sel label="Show only" value={hm.thirdVal} onChange={v => setHm(h => ({ ...h, thirdVal: v }))} opts={[['', 'All'], ...thirdVals.map(v => [v, v])]} /></div>
      <div style={{ overflowX: 'auto' }}><div className="hgrid" style={{ gridTemplateColumns: `minmax(110px,auto) repeat(${ck.length},minmax(74px,1fr))` }}><span />{ck.map(c => <span key={c} className="hl" style={{ justifyContent: 'center', textAlign: 'center' }}>{c}</span>)}
        {rk.map(r => (<React.Fragment key={r}><span className="hl">{r}</span>{ck.map(c => { const x = val(r, c); const good = hm.y === 'success'; const colorV = hm.y === 'success' ? x.v : hm.y === 'timeout' ? (x.v == null ? null : 100 - x.v * 4) : null; return <div key={c} className="hc" onClick={() => setCell({ r, c })} title={x.n + ' payments'} style={{ background: hm.y === 'success' || hm.y === 'timeout' ? heatColor(colorV) : 'var(--s2)', color: (hm.y === 'success' || hm.y === 'timeout') && x.v != null ? '#0A1020' : 'var(--ink)', outline: cell && cell.r === r && cell.c === c ? '2px solid var(--ink)' : 'none' }}>{x.v == null ? '·' : x.v}</div>; })}</React.Fragment>))}</div></div>
      {cell && (() => { const f2 = { ...hmFilters }; const kr = filterKeyOf(hm.r), kc = filterKeyOf(hm.c); if (kr) f2[kr] = cell.r; if (kc) f2[kc] = cell.c; const rowsC = A.filterRows(f2); const left = ['acquirer', 'mode', 'network', 'issuer'].find(d => d !== hm.r && d !== hm.c && d !== hm.third) || 'issuer';
        return (<div className="drill"><div className="row between wrap"><b>{cell.r} × {cell.c}{hm.thirdVal ? ' × ' + hm.thirdVal : ''}</b><button className="btn" style={{ minHeight: 34 }} onClick={() => setCell(null)}>Close</button></div>
          <span className="mute sm">{rowsC.length} payments · success {A.METRICS.success.fn(rowsC) ?? '–'}% · timeouts {A.METRICS.timeout.fn(rowsC) ?? '–'}% · median {A.METRICS.latency.fn(rowsC) ?? '–'} ms</span>
          <Table cols={[{ k: 'key', h: A.DIMS[left].label }, { k: 'n', h: 'Payments', right: true }, { k: 'success', h: 'Success', right: true, f: r => (r.success == null ? '–' : r.success + '%') }, { k: 'timeout', h: 'Timeouts', right: true, f: r => (r.timeout == null ? '–' : r.timeout + '%') }]} rows={A.breakdown(left, f2, ['volume', 'success', 'timeout']).filter(r => r.n >= 8)} /></div>); })()}</section>
    <div className="next"><button className="btn" onClick={() => goto('overview')}>Back</button><button className="btn pri" onClick={() => goto('routing')}>Next: Routing</button></div>
  </div>);
}
