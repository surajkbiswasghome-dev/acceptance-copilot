// Vercel serverless function. Holds GEMINI_API_KEY (set in Vercel, never in code).
// All evidence is computed by the tools in code first; Gemini only writes the explanation from that evidence.
import { offlineAgent, offlineAnswer } from '../src/lib/agent.js';
import * as S from '../src/lib/stats.js';

const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean);
const URL_ = (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const SYSTEM = 'You are an acceptance analyst for a payments network. Use ONLY the numbers in the evidence given. Never invent figures or claim proven uplift. If a sample is small, say so and lower confidence. Be plain and brief.';
let good = null;

async function ask(key, prompt, schema) {
  const started = Date.now(); const log = [];
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: schema ? { responseMimeType: 'application/json' } : {} });
  const order = good ? [good, ...MODELS.filter(m => m !== good)] : MODELS;
  for (const model of order) {
    for (let i = 0; i < 2; i++) {
      const left = 22000 - (Date.now() - started); if (left < 3000) throw new Error('Ran out of time. Tried: ' + log.join(', '));
      let res;
      try { res = await fetch(URL_(key, model), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(Math.min(9000, left)) }); }
      catch { log.push(model + ': no answer'); break; }
      if (res.ok) { const j = await res.json(); const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''); if (text) { good = model; return text; } log.push(model + ': empty'); break; }
      let m = ''; try { m = (await res.json()).error?.message || ''; } catch {}
      log.push(model + ': ' + res.status);
      if (res.status === 401 || res.status === 403) throw new Error('Gemini returned ' + res.status + ' ' + m.slice(0, 140));
      if (res.status === 503 || res.status === 429) { await new Promise(r => setTimeout(r, 1000)); continue; }
      break;
    }
  }
  throw new Error('No Gemini model answered. Tried: ' + log.join(', '));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const key = process.env.GEMINI_API_KEY;
  const fallback = reason => res.status(200).json({ ...(body.question ? offlineAnswer(body.question) : offlineAgent(body.id)), mode: 'offline', reason });
  if (!key) return fallback('GEMINI_API_KEY is not set on the server (add it in Vercel and redeploy)');
  try {
    if (body.question) {
      const facts = offlineAnswer(body.question); const all = S.findings().map(f => f.title + ': ' + f.subtitle).join(' | ');
      const text = await ask(key, `Question: ${body.question}\nComputed evidence (tool ${facts.tool}): ${facts.answer}\nAll flagged findings: ${all}\nAnswer in two sentences using only this evidence.`);
      return res.status(200).json({ mode: 'live', tool: facts.tool, answer: text.trim() });
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
