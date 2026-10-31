// Vercel serverless function. Holds GEMINI_API_KEY (set in Vercel, never in code). Tools run here, in code.
import { TOOL_DEFS, runTool, offlineAgent, offlineAnswer } from '../src/lib/agent.js';
import * as S from '../src/lib/stats.js';

const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
let good = null; // remember the model that worked on this warm instance
const URL_ = (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const SYSTEM = 'You are an acceptance analyst for a payments network. You may only state numbers returned by your tools. Call tools to gather evidence, then answer in JSON with keys cause, confidence (Low|Medium|High), action. Keep each to one or two plain sentences. Never claim proven uplift or invent figures. If the sample is small, say so and lower confidence.';

async function gemini(key, contents) {
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools: [{ functionDeclarations: TOOL_DEFS }] });
  let last = '';
  for (const model of good ? [good] : MODELS) {
    const res = await fetch(URL_(key, model), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (res.ok) { good = model; return res.json(); }
    let m = ''; try { m = (await res.json()).error?.message || ''; } catch {}
    last = 'Gemini returned ' + res.status + ' for ' + model + ' ' + m.slice(0, 140);
    if (res.status !== 404 && res.status !== 400) break;
  }
  good = null; throw new Error(last);
}

async function liveAgent(key, prompt) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }]; const steps = [];
  for (let i = 0; i < 5; i++) {
    const out = await gemini(key, contents);
    const parts = out.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) { const text = parts.map(p => p.text || '').join(''); return { steps, text }; }
    contents.push({ role: 'model', parts });
    const responses = calls.map(c => { const result = runTool(c.functionCall.name, c.functionCall.args || {}); steps.push({ tool: c.functionCall.name, args: c.functionCall.args || {}, result: JSON.stringify(result).slice(0, 220) }); return { functionResponse: { name: c.functionCall.name, response: { result } } }; });
    contents.push({ role: 'user', parts: responses });
  }
  throw new Error('too many tool turns');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const key = process.env.GEMINI_API_KEY;
  try {
    if (body.question) {
      if (!key) return res.status(200).json({ mode: 'offline', ...offlineAnswer(body.question), reason: 'GEMINI_API_KEY is not set on the server' });
      const { steps, text } = await liveAgent(key, body.question + ' Answer in two sentences using tool results only.');
      return res.status(200).json({ mode: 'live', steps, answer: text });
    }
    const f = S.findings().find(x => x.id === body.id);
    if (!f) return res.status(400).json({ error: 'unknown finding' });
    if (!key) return res.status(200).json({ ...offlineAgent(body.id), reason: 'GEMINI_API_KEY is not set on the server (add it in Vercel and redeploy)' });
    const { steps, text } = await liveAgent(key, `Investigate this finding and explain it: "${f.title}: ${f.subtitle}". Instrument indexes: ${S.INST.map((n, i) => i + '=' + n).join(', ')}. Acquirer indexes: ${S.ACQ.map((n, i) => i + '=' + n).join(', ')}.`);
    let finding; try { finding = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { throw new Error('unparseable'); }
    return res.status(200).json({ mode: 'live', steps, finding: { ...finding, gate: f.gate } });
  } catch (e) {
    return res.status(200).json({ ...(body.question ? offlineAnswer(body.question) : offlineAgent(body.id)), mode: 'offline', reason: String(e.message || e).replace(/key=[^&\s]+/g, 'key=***'), note: 'Live model unavailable, showing rules-based explanation.' });
  }
}
