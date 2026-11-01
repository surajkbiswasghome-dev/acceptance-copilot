import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ComposedChart, Bar, Cell, AreaChart, Area } from 'recharts';
import * as S from '../../lib/stats.js';
import * as A from '../../lib/analytics.js';
import { AX, GRID, PALETTE, colorOf, Count, Arrow, Tip, Donut, Legend2, Table } from '../../charts.jsx';

const MODE_COLORS = { Cards: PALETTE[0], UPI: PALETTE[1], 'Net banking': PALETTE[2], Wallets: PALETTE[4] };
const REASON_COLORS = [PALETTE[3], PALETTE[2], PALETTE[6], PALETTE[4], PALETTE[5], PALETTE[7]];

function Kpi({ label, value, dec = 0, suffix = '', prev, good = 'up', spark }) {
  const d = value != null && prev != null ? Math.round((value - prev) * 10) / 10 : null; const up = d != null && d > 0; const better = d == null ? null : good === 'up' ? up : !up;
  return (<div className="kt"><small>{label}</small><b><Count value={value} decimals={dec} suffix={suffix} /></b>
    {d != null && d !== 0 && <span className={'delta ' + (better ? 'up' : 'down')}><Arrow dir={up ? 'up' : 'down'} size={12} />{Math.abs(d)}{suffix === '%' ? ' pts' : suffix} vs previous 7 days</span>}
    {d === 0 && <span className="mute sm">No change vs previous 7 days</span>}
    {spark && <div style={{ height: 34, marginTop: 4 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}><Area type="monotone" dataKey="v" stroke="var(--acc)" fill="var(--acc)" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive /></AreaChart></ResponsiveContainer></div>}
  </div>);
}

export function drillSections(dim, name, f) {
  const base = { ...f, [dim]: name }; const others = ['acquirer', 'mode', 'network', 'issuer'].filter(d => d !== dim && !(dim === 'network' && d === 'mode') && !(dim === 'mode' && d === 'network')).slice(0, 2);
  return others.map(by => { let rows = A.breakdown(by, base); if (by === 'issuer') rows = rows.filter(r => r.n >= 30).sort((a, b) => a.success - b.success).slice(0, 5); return { by, title: (by === 'issuer' ? 'Weakest issuers' : 'By ' + A.DIMS[by].label.toLowerCase()), rows }; });
}
const cols = [{ k: 'key', h: 'Segment' }, { k: 'n', h: 'Payments', right: true, f: r => r.n.toLocaleString('en-IN') }, { k: 'success', h: 'Success', right: true, f: r => (r.success == null ? '–' : r.success + '%') }, { k: 'timeout', h: 'Timeouts', right: true, f: r => (r.timeout == null ? '–' : r.timeout + '%') }, { k: 'latency', h: 'Median ms', right: true }, { k: 'cost', h: 'Cost idx', right: true }];

export default function Overview({ filters, goto }) {
  const [end, setEnd] = useState(29); const [play, setPlay] = useState(false); const [drill, setDrill] = useState(null);
  useEffect(() => { if (!play) return; const t = setInterval(() => setEnd(e => { if (e >= 29) { setPlay(false); return 29; } return e + 1; }), 650); return () => clearInterval(t); }, [play]);
  const cur = useMemo(() => A.kpiWindow(end - 6, end, filters), [end, filters]); const prev = useMemo(() => A.kpiWindow(end - 13, end - 7, filters), [end, filters]);
  const trend = useMemo(() => A.aggregate({ x: 'day', y: 'success', split: 'mode', filters, smooth: 3 }), [filters]);
  const overall = useMemo(() => A.aggregate({ x: 'day', y: 'success', filters }).data.map(d => ({ v: d.All })), [filters]);
  const ins = useMemo(() => A.insights(end, 7, filters), [end, filters]);
  const modes = useMemo(() => A.shareOf('mode', filters).map(d => ({ ...d, color: MODE_COLORS[d.name] })), [filters]);
  const acqs = useMemo(() => A.breakdown('acquirer', filters, ['volume', 'success']).map((r, i) => ({ name: r.key, x: r.key, volume: r.volume, success: r.success, fill: colorOf(i) })), [filters]);
  const reasons = useMemo(() => { const rows = A.filterRows(filters).filter(t => !t.ok); const c = {}; rows.forEach(t => { c[t.st] = (c[t.st] || 0) + 1; }); return Object.entries(c).map(([st, v], i) => ({ name: S.DECLINE_LABEL[S.DEC[st - 1]], value: v, st: Number(st), color: REASON_COLORS[(st - 1) % 6], share: Math.round((1000 * v) / rows.length) / 10 })).sort((a, b) => b.value - a.value); }, [filters]);
  const rs = drill?.kind === 'reason' ? drillReason(drill.st, filters) : drill ? drillSections(drill.dim, drill.name, filters) : null;
  const pick = (dim, name) => setDrill(d => (d && d.dim === dim && d.name === name ? null : { kind: 'slice', dim, name }));
  return (<div className="col gap16">
    <div className="player"><button className="btn" style={{ minHeight: 38 }} onClick={() => { if (end >= 29) setEnd(13); setPlay(p => !p); }}>{play ? 'Pause' : end >= 29 ? 'Replay the month' : 'Play'}</button>
      <input type="range" min={13} max={29} value={end} onChange={e => { setPlay(false); setEnd(Number(e.target.value)); }} aria-label="Window end day" />
      <span className="mono sm" style={{ whiteSpace: 'nowrap' }}>7 days ending D{String(end + 1).padStart(2, '0')}</span></div>
    <div className="kpis">
      <Kpi label="Success rate" value={cur.success} prev={prev.success} dec={1} suffix="%" spark={overall} />
      <Kpi label="Payments (7 days)" value={cur.n} prev={prev.n} />
      <Kpi label="Successful value (₹ lakh)" value={cur.gmv} prev={prev.gmv} dec={1} />
      <Kpi label="Median latency" value={cur.latency} prev={prev.latency} suffix=" ms" good="down" />
      <Kpi label="Cost index (synthetic)" value={cur.cost} prev={prev.cost} dec={1} good="down" />
    </div>
    <section className="col"><div className="row between wrap"><span className="eyebrow">What changed in this window</span><span className="mute sm">Compared with the 7 days before. Press play to watch it move through the month.</span></div>
      {ins.length === 0 ? <div className="insight mute">No change large enough to be worth flagging in this window.</div> : <div className="ictiles">{ins.map((i, k) => (
        <button key={i.id + end} className={'ic ' + i.dir} style={{ animationDelay: k * 70 + 'ms' }} onClick={() => pick(i.dim, i.who)}><span className="badge"><Arrow dir={i.dir} size={18} /></span><span className="col" style={{ gap: 2 }}><b>{i.text}</b><small>{i.n.toLocaleString('en-IN')} payments in window · click to break down</small></span></button>))}</div>}</section>
    <div className="grid-ins">
      <section className="card span2"><div className="row between wrap"><span className="eyebrow">Success rate by payment mode, 30 days (3-day rolling)</span><span className="mute sm">Shaded band is the 7-day window above. Hover for values.</span></div>
        <div style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend.data} margin={{ left: -10, right: 8, top: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="x" tick={AX} interval={2} stroke={GRID} /><YAxis domain={[80, 100]} ticks={[80, 85, 90, 95, 100]} allowDataOverflow tick={AX} stroke={GRID} unit="%" />
          <ReferenceArea x1={'D' + String(end - 5).padStart(2, '0')} x2={'D' + String(end + 1).padStart(2, '0')} fill="var(--acc)" fillOpacity={0.1} />
          <Tooltip content={<Tip unit="%" />} />{trend.series.map(s => <Line key={s} type="monotone" dataKey={s} stroke={MODE_COLORS[s]} strokeWidth={2.4} dot={false} activeDot={{ r: 6 }} connectNulls animationDuration={1100} />)}</LineChart></ResponsiveContainer></div>
        <Legend2 data={trend.series.map(s => ({ name: s, color: MODE_COLORS[s] }))} onPick={n => pick('mode', n)} selected={drill?.dim === 'mode' ? drill.name : null} /></section>
      <section className="card"><span className="eyebrow">Share of payments by mode</span><Donut data={modes} centre={cur.n ? A.filterRows(filters).length.toLocaleString('en-IN') : '0'} sub="payments, 30 days" onPick={n => pick('mode', n)} selected={drill?.dim === 'mode' ? drill.name : null} /><Legend2 data={modes} onPick={n => pick('mode', n)} selected={drill?.dim === 'mode' ? drill.name : null} /></section>
      <section className="card"><span className="eyebrow">Why payments fail</span><Donut data={reasons} centre={reasons.reduce((a, r) => a + r.value, 0).toLocaleString('en-IN')} sub="failed payments" valueLabel="failures" onPick={(n) => { const r = reasons.find(x => x.name === n); setDrill(d => (d?.kind === 'reason' && d.st === r.st ? null : { kind: 'reason', st: r.st, name: n })); }} selected={drill?.kind === 'reason' ? drill.name : null} /><Legend2 data={reasons} onPick={n => { const r = reasons.find(x => x.name === n); setDrill({ kind: 'reason', st: r.st, name: n }); }} selected={drill?.kind === 'reason' ? drill.name : null} /></section>
      <section className="card"><div className="row between wrap"><span className="eyebrow">Volume and success by acquirer</span><span className="mute sm">Bars: payments. Line: success. Click a bar.</span></div>
        <div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={acqs} margin={{ left: -6, right: 6, top: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="x" tick={AX} stroke={GRID} /><YAxis yAxisId="l" tick={AX} stroke={GRID} /><YAxis yAxisId="r" orientation="right" domain={[80, 100]} tick={AX} stroke={GRID} unit="%" />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--s2)', opacity: 0.6 }} />
          <Bar yAxisId="l" dataKey="volume" name="Payments" radius={[8, 8, 0, 0]} onClick={d => pick('acquirer', d.x)} cursor="pointer" animationDuration={900}>{acqs.map((a, i) => <Cell key={a.x} fill={a.fill} opacity={drill?.dim === 'acquirer' && drill.name !== a.x ? 0.35 : 1} />)}</Bar>
          <Line yAxisId="r" dataKey="success" name="Success %" stroke="var(--ink)" strokeWidth={2.4} dot={{ r: 5 }} activeDot={{ r: 8 }} animationDuration={1200} /></ComposedChart></ResponsiveContainer></div></section>
    </div>
    {rs && <div className="drill"><div className="row between wrap"><div className="col" style={{ gap: 2 }}><span className="eyebrow">Drill-down</span><b style={{ fontSize: 18 }}>{drill.kind === 'reason' ? drill.name : drill.name}</b></div>
      <div className="row wrap"><button className="btn" style={{ minHeight: 36 }} onClick={() => goto('explore', drill.kind === 'reason' ? {} : { filters: { [drill.dim]: drill.name } })}>Open in Explore</button><button className="btn" style={{ minHeight: 36 }} onClick={() => setDrill(null)}>Close</button></div></div>
      {rs.map(sec => (<div key={sec.title} className="col"><span className="eyebrow">{sec.title}</span><Table cols={sec.cols || cols} rows={sec.rows} /></div>))}</div>}
    <div className="next"><span className="mute sm">Overview shows what is happening. Explore lets you cut it any way you like.</span><button className="btn pri" onClick={() => goto('explore')}>Next: Explore the data</button></div>
  </div>);
}
function drillReason(st, f) {
  const rows = A.filterRows(f); const failed = rows.filter(t => !t.ok); const mk = (by, label) => { const keys = [...new Set(rows.map(A.DIMS[by].get))]; return { title: label, cols: [{ k: 'key', h: 'Segment' }, { k: 'c', h: 'This reason', right: true, f: r => r.c.toLocaleString('en-IN') }, { k: 'share', h: 'Share of its payments', right: true, f: r => r.share + '%' }, { k: 'sf', h: 'Share of all failures', right: true, f: r => r.sf + '%' }], rows: keys.map(k => { const sub = rows.filter(t => A.DIMS[by].get(t) === k); const c = sub.filter(t => t.st === st).length; return { key: k, c, share: Math.round((1000 * c) / (sub.length || 1)) / 10, sf: Math.round((1000 * c) / (failed.length || 1)) / 10 }; }).filter(r => r.c > 0).sort((a, b) => b.share - a.share).slice(0, 6) }; };
  return [mk('acquirer', 'By acquirer'), mk('network', 'By network'), mk('issuer', 'Top issuers')];
}
