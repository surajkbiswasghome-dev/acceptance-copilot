import * as S from './stats.js';
import { slot } from './lang.js';
// Builds the morning brief from computed numbers and the live ticket/proposal state.
export function buildBrief(tickets = [], proposals = []) {
  const k = S.kpis(); const f = S.findings();
  const open = tickets.filter(t => !['Closed', 'Rejected'].includes(t.status));
  const verify = tickets.filter(t => t.status === 'Fixed, awaiting verification').length;
  const routing = tickets.filter(t => t.kind === 'Routing change' && t.status === 'Pending approval').length;
  const sent = proposals.filter(p => p.status === 'sent').length, interested = proposals.filter(p => p.status === 'interested').length, call = proposals.filter(p => p.status === 'wants_call').length;
  const headline = `Overall success is ${k.success}%, with ${f.length} leaks flagged.`;
  const sections = [
    { title: 'Where payments leak', lines: f.slice(0, 3).map((x, i) => `${i + 1}. ${x.title}: ${x.subtitle}`) },
    { title: 'Needs your decision', lines: [routing ? `${routing} routing change request${routing > 1 ? 's' : ''} waiting for approval` : 'No routing changes waiting', verify ? `${verify} fixed ticket${verify > 1 ? 's' : ''} awaiting verification` : 'No fixes awaiting verification'] },
    { title: 'In flight', lines: [`${open.length} open ticket${open.length === 1 ? '' : 's'}`, `${sent} proposal${sent === 1 ? '' : 's'} sent, awaiting a reply`, `${interested} merchant${interested === 1 ? '' : 's'} interested, ready for enablement`, ...(call ? [`${call} merchant${call > 1 ? 's' : ''} asked for a call`] : [])] }
  ];
  const text = ['Good morning', 'Good afternoon', 'Good evening'][slot()] + '. ' + headline + ' ' + sections.map(s => s.title + '. ' + s.lines.join('. ')).join(' ') + '.';
  return { headline, sections, text };
}
