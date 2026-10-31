// Vercel serverless function. Holds GEMINI_API_KEY (set in Vercel, never in code). Tools run here, in code.
import { TOOL_DEFS, runTool, offlineAgent, offlineAnswer } from '../src/lib/agent.js';
import * as S from '../src/lib/stats.js';

const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
let good = null; // remember the model that worked on this warm instance
const URL_ = (key, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const SYSTEM = 'You are an acceptance analyst for a payments network. You may only state numbers returned by your tools. Call tools to gather evidence, then answer in JSON with keys cause, confidence (Low|Medium|High), action. Keep each to one or two plain sentences. Never claim proven uplift or invent figures. If the sample is small, say so and lower confidence.';

async function discover(key) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/(image|tts|live|audio|thinking-exp|embedding|robotics|computer)/.test(m.name))
      .map(m => m.name.replace('models/', '')).sort((x, y) => (/lite/.test(x) ? 1 : 0) - (/lite/.test(y) ? 1 : 0) || y.localeCompare(x, undefined, { numeric: true }));
  } catch { return []; }
}
async function tryModel(key, model, body, tries, log) {
  for (let i = 0; i < tries; i++) {
    let res;
    try { res = await fetch(URL_(key, model), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(14000) }); }
    catch { log.push(model + ': no answer'); return null; }
    if (res.ok) return res.json();
    let m = ''; try { m = (await res.json()).error?.message || ''; } catch {}
    log.push(model + ': ' + res.status);
    if (res.status === 401 || res.status === 403) throw new Error('Gemini returned ' + res.status + ' ' + m.slice(0, 140));
    if (res.status === 503 || res.status === 429) { await new Promise(r => setTimeout(r, 1500)); continue; }
    return null;
  }
  return null;
}
async function gemini(key, contents) {
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools: [{ functionDeclarations: TOOL_DEFS }] });
  const log = []; const seen = new Set();
  const order = good ? [good] : MODELS.slice(0, 2);
  for (const m of order) { seen.add(m); const out = await tryModel(key, m, body, 3, log); if (out) { good = m; return out; } }
  const found = await discover(key);
  for (const m of found.filter(x => !seen.has(x)).slice(0, 4)) { seen.add(m); const out = await tryModel(key, m, body, 2, log); if (out) { good = m; return out; } }
  good = null; throw new Error('No Gemini model answered. Tried: ' + log.join(', ') + (found.length ? '. Available: ' + found.slice(0, 5).join(', ') : ''));
}

async function liveAgent(key, prompt) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }]; const steps = [];
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) {
    if (Date.now() - t0 > 40000) throw new Error('Gemini was too slow');
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
