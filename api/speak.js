import { authed, rateLimit, status } from '../server/lib.js';
// Natural voice through Gemini text-to-speech. If anything fails the app falls back to the browser voice.
let cached = null;
async function model(key) {
  if (cached) return cached;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + key); const j = await r.json().catch(() => ({}));
  const ms = (j.models || []).filter(m => /tts/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
  cached = ms.find(m => /flash/.test(m)) || ms[0] || null; return cached;
}
const wav = (pcm, rate = 24000) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!status().server) return res.status(503).json({ error: 'not configured' });
  if (!authed(req)) return res.status(401).json({ error: 'sign in again' });
  const key = process.env.GEMINI_API_KEY; if (!key) return res.status(503).json({ error: 'GEMINI_API_KEY is not set' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); const text = String(b.text || '').slice(0, 700); if (!text) return res.status(400).json({ error: 'no text' });
  if (!(await rateLimit('speak', 30, 3600))) return res.status(429).json({ error: 'too many' });
  try {
    const m = await model(key); if (!m) return res.status(503).json({ error: 'no text-to-speech model is available for this Gemini key' });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Say this warmly, naturally and at a calm pace, like a friendly colleague: ' + text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } } }) });
    const j = await r.json().catch(() => ({})); const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData); if (!part) return res.status(502).json({ error: 'Gemini returned no audio (' + (m) + ', HTTP ' + r.status + (j.error?.message ? ': ' + String(j.error.message).slice(0, 90) : '') + ')' });
    const rate = Number((part.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1] || 24000);
    return res.status(200).json({ wav: wav(Buffer.from(part.inlineData.data, 'base64'), rate).toString('base64'), model: m });
  } catch (e) { return res.status(502).json({ error: 'voice failed' }); }
}
