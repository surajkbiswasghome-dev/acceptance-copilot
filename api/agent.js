// Vercel serverless function. Holds GEMINI_API_KEY (set in Vercel, never in code).
// All evidence is computed by the tools in code first; Gemini only writes the explanation from that evidence.
import { offlineAgent, offlineAnswer } from '../src/lib/agent.js';
import * as S from '../src/lib/stats.js';
import { dataAnswer, snapshot } from '../src/lib/qa.js';
import { inScope, OFF_TOPIC } from '../src/lib/guard.js';
import { HELP } from '../src/lib/help.js';

const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean);
const URL_ = (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const SYSTEM = 'You are an acceptance analyst for a payments network. Use ONLY the numbers in the evidence given. Never invent figures or claim proven uplift. If a sample is small, say so and lower confidence. Be plain and brief.';
let good = null;

async function discover(key) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/(image|tts|live|audio|embedding|robotics|computer|exp)/.test(m.name))
      .map(m => m.name.replace('models/', '')).sort((x, y) => (/lite/.test(y) ? 1 : 0) - (/lite/.test(x) ? 1 : 0) || y.localeCompare(x, undefined, { numeric: true }));
  } catch { return []; }
}
async function ask(key, prompt, schema) {
  const started = Date.now(); const log = []; const BUDGET = 45000;
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: schema ? { responseMimeType: 'application/json' } : {} });
  const tried = new Set(); let queue = good ? [good] : [...MODELS]; let discovered = false;
  while (queue.length || !discovered) {
    if (!queue.length) { discovered = true; queue = (await discover(key)).filter(m => !tried.has(m)).slice(0, 4); if (!queue.length) break; }
    const model = queue.shift(); tried.add(model);
    for (let i = 0; i < 2; i++) {
      const left = BUDGET - (Date.now() - started); if (left < 4000) throw new Error('Ran out of time. Tried: ' + log.join(', '));
      let res;
      try { res = await fetch(URL_(key, model), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(Math.min(tried.size === 1 ? 22000 : 12000, left)) }); }
      catch { log.push(model + ': no answer'); break; }
      if (res.ok) { const j = await res.json(); const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''); if (text) { good = model; return text; } log.push(model + ': empty'); break; }
      let m = ''; try { m = (await res.json()).error?.message || ''; } catch {}
      log.push(model + ': ' + res.status);
      if (res.status === 401 || res.status === 403) throw new Error('Gemini returned ' + res.status + ' ' + m.slice(0, 140));
      if (res.status === 503 || res.status === 429) { await new Promise(r => setTimeout(r, 800)); continue; }
      break;
    }
  }
  good = null; throw new Error('No Gemini model answered. Tried: ' + log.join(', '));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const key = process.env.GEMINI_API_KEY;
  const fallback = reason => res.status(200).json({ ...(body.question ? (dataAnswer(String(body.question)) || offlineAnswer(body.question)) : offlineAgent(body.id)), mode: 'offline', reason });
  if (!key) return fallback('GEMINI_API_KEY is not set on the server (add it in Vercel and redeploy)');
  try {
    if (body.question) {
      const q = String(body.question).slice(0, 400); const scr = { screen: body.screen, findingId: body.findingId };
      if (!inScope(q, scr)) return res.status(200).json({ tool: 'guardrail', answer: OFF_TOPIC, mode: 'guardrail' });
      const d = dataAnswer(q); const evidence = d ? d.evidence || d.answer : 'No figure could be computed directly from the question.';
      const help = Object.entries(HELP).filter(([k]) => k === body.screen).map(([, v]) => v).join(' ');
      const text = await ask(key, `The user is a ${body.role || 'payments acceptance analyst'} using the Acceptance Copilot platform${body.screen ? ', currently on the ' + body.screen + ' screen' + (body.findingId ? ' looking at finding ' + body.findingId : '') : ''}. ${help ? 'This screen: ' + help : ''}\nQuestion: ${q}\nFigures computed in code for this question: ${evidence}\nData snapshot (synthetic, 30 days): ${snapshot()}\nAnswer in two to four plain sentences. Use ONLY the figures above; never invent numbers, never claim proven uplift, and mention a small sample if n is under 30. If the question asks what to do next, say the practical next step on this platform (approve or reject a finding, raise a ticket, request a routing change, create or send a proposal). If the question is clearly unrelated to payment acceptance or this platform, say you can only help with those topics.`);
      return res.status(200).json({ mode: 'live', tool: d ? d.tool : 'snapshot', answer: text.trim() });
    }
    const f = S.findings().find(x => x.id === body.id);
    if (!f) return res.status(400).json({ error: 'unknown finding' });
    const base = offlineAgent(body.id);
    const evidence = base.steps.map(s => `- ${s.tool}: ${s.result}`).join('\n');
    const text = await ask(key, `Finding: ${f.title}. ${f.subtitle}\nEvidence computed by code:\n${evidence}\nReturn JSON with keys "cause" (one or two sentences), "confidence" ("Low", "Medium" or "High"), "action" (one or two sentences, a recommended next step for a human to approve).`, true);
    let finding; try { finding = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { throw new Error('Gemini answer was not readable'); }
    if (!finding.cause || !finding.action) throw new Error('Gemini answer was incomplete');
    if (!['Low', 'Medium', 'High'].includes(finding.confidence)) finding.confidence = base.finding.confidence;
    return res.status(200).json({ mode: 'live', steps: base.steps, finding: { cause: finding.cause, confidence: finding.confidence, action: finding.action, gate: f.gate } });
  } catch (e) {
    return fallback(String(e.message || e).replace(/key=[^&\s]+/g, 'key=***'));
  }
}
