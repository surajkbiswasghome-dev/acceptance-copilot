import React, { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts';
export const PALETTE = ['#5B8CFF', '#2DD4A7', '#F5B83D', '#FF6B7A', '#A78BFA', '#38BDF8', '#FB923C', '#94A3B8', '#E879F9', '#84CC16', '#F472B6'];
export const AX = { fill: 'var(--mute)', fontSize: 12 };
export const GRID = 'var(--line)';
export const colorOf = i => PALETTE[i % PALETTE.length];

// Number that counts up to its value, so charts feel alive when they load or change.
export function Count({ value, decimals = 0, suffix = '', prefix = '' }) {
  const [v, setV] = useState(value ?? 0); const from = useRef(value ?? 0);
  useEffect(() => { if (value == null) return; const a = from.current, b = value, t0 = performance.now(); let raf; const step = t => { const k = Math.min(1, (t - t0) / 700); const e = 1 - Math.pow(1 - k, 3); setV(a + (b - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [value]);
  return <span className="num">{value == null ? '–' : prefix + v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix}</span>;
}
export const Arrow = ({ dir, size = 14 }) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dir === 'up' ? <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /> : <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" />}</svg>);

// Tooltip styled as a small infographic card.
export function Tip({ active, payload, label, unit = '', extra }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter(p => p.value != null);
  return (<div className="ctip"><b>{label ?? payload[0]?.payload?.name}</b>{rows.map((p, i) => (<div key={i} className="row between" style={{ gap: 14 }}><span className="row" style={{ gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: p.color || p.payload?.fill }} />{p.name}</span><b className="num">{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{unit}</b></div>))}{extra && extra(payload[0]?.payload)}</div>);
}
// Donut with an expanding slice on hover, a centre label, and a click handler for drill-down.
export function Donut({ data, onPick, selected, centre, sub, height = 260, valueLabel = 'payments' }) {
  const [ai, setAi] = useState(-1); const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const hot = ai >= 0 ? data[ai] : null;
  return (<div style={{ position: 'relative', height }}>
    <ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none" animationDuration={900} activeIndex={ai} onMouseLeave={() => setAi(-1)}
        activeShape={p => <Sector {...p} outerRadius={p.outerRadius + 9} />} onMouseEnter={(_, i) => setAi(i)} onClick={(d, i) => onPick && onPick(d.name, i)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
        {data.map((d, i) => <Cell key={d.name} fill={d.color || colorOf(i)} opacity={selected && selected !== d.name ? 0.35 : 1} />)}
      </Pie></PieChart></ResponsiveContainer>
    <div className="donutc"><b className="num">{hot ? Math.round((100 * hot.value) / total * 10) / 10 + '%' : centre}</b><span>{hot ? hot.name : sub}</span>{hot && <small className="num">{hot.value.toLocaleString('en-IN')} {valueLabel}{hot.success != null ? ' · ' + hot.success + '% success' : ''}</small>}</div>
  </div>);
}
export const Legend2 = ({ data, onPick, selected }) => (<div className="legend2">{data.map((d, i) => <button key={d.name} className={selected === d.name ? 'on' : ''} onClick={() => onPick && onPick(d.name)}><i style={{ background: d.color || colorOf(i) }} />{d.name}<small className="num">{d.share != null ? d.share + '%' : ''}</small></button>)}</div>);
export const Help = ({ children }) => <span className="mute sm" style={{ lineHeight: 1.5 }}>{children}</span>;
export const Table = ({ cols, rows, onRow, active }) => (<div style={{ overflowX: 'auto' }}><table><thead><tr>{cols.map(c => <th key={c.k} style={c.right ? { textAlign: 'right' } : null}>{c.h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : 'default', background: active && active === r.key ? 'var(--s2)' : 'none' }}>{cols.map(c => <td key={c.k} className={c.right ? 'num' : ''} style={c.right ? { textAlign: 'right' } : null}>{c.f ? c.f(r) : r[c.k] ?? '–'}</td>)}</tr>)}</tbody></table></div>);
