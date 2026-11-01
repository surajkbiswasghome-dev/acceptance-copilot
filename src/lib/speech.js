// Speaks in a female voice. The browser's own voices are used (instant, no network); the best female voice for each language is chosen.
// Hindi, Bengali and Marathi use that language's voice where the device has one.
import { callApi, conn } from './db.js';
let audio = null;
export const stopSpeech = () => { try { audio && audio.pause(); } catch (e) {} audio = null; try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };
const voices = () => new Promise(res => { if (!('speechSynthesis' in window)) return res([]); const v = speechSynthesis.getVoices(); if (v.length) return res(v); const t = setTimeout(() => res(speechSynthesis.getVoices()), 900); speechSynthesis.onvoiceschanged = () => { clearTimeout(t); res(speechSynthesis.getVoices()); }; });
const FEMALE = /(female|swara|heera|neerja|tanishaa|aarohi|kalpana|lekha|veena|shruti|priya|samantha|zira|aria|jenny|sonia|libby|karen|moira|tessa|fiona|natasha|google हिन्दी|google hindi|google বাংলা|google मराठी)/i;
const MALE = /(\bmale\b|david|mark\b|ravi|james|george|daniel|\balex\b|fred|rishi|prabhat|hemant|\bguy\b|ryan|bashkar|sagar|manohar|thomas|oliver|arthur|eric|gordon)/i;
const NATURAL = /(natural|online|neural|premium|enhanced)/i;
const notMale = v => !MALE.test(v.name) || /female/i.test(v.name);
const best = pool => pool.find(v => FEMALE.test(v.name) && NATURAL.test(v.name)) || pool.find(v => FEMALE.test(v.name)) || pool.find(v => NATURAL.test(v.name) && notMale(v)) || pool.find(notMale) || null;
const forLang = (vs, lang) => { const base = lang.slice(0, 2).toLowerCase(); const exact = vs.filter(v => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()); const near = vs.filter(v => v.lang.toLowerCase().startsWith(base)); return best(exact) || best(near); };
async function pick(lang) {
  const vs = await voices(); let v = forLang(vs, lang); if (v) return v;
  if (lang.startsWith('mr')) return forLang(vs, 'hi-IN');            // Marathi is written in Devanagari, so a Hindi voice reads it acceptably
  if (lang.startsWith('en')) return forLang(vs, 'hi-IN');            // no female English voice on this device: the Hindi female voice reads English clearly
  return null;
}
const sentences = t => t.split(/(?<=[.!?।])\s+/).map(x => x.trim()).filter(Boolean);
export async function canSpeak(lang) { return !!(await pick(lang)); }
export const voiceInfo = { via: '', name: '', reason: '' };
const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + t.length; };
const mem = new Map();
// Audio is kept on this device once made, so repeat sign-ins start instantly and use no server calls.
async function cached(key) { if (mem.has(key)) return mem.get(key); try { const c = await caches.open('ac-tts-v1'); const r = await c.match('/__tts/' + key); if (r) { const u = URL.createObjectURL(await r.blob()); mem.set(key, u); return u; } } catch (e) {} return null; }
async function store(key, wavB64) { const bin = atob(wavB64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); const blob = new Blob([arr], { type: 'audio/wav' }); const u = URL.createObjectURL(blob); mem.set(key, u); try { const c = await caches.open('ac-tts-v1'); await c.put('/__tts/' + key, new Response(blob)); } catch (e) {} return u; }
// Makes (or finds) Gemini speech for a text. Returns { url } or { reason }.
export async function prepareVoice(text, lang = 'en-IN', timeoutMs = 20000) {
  const key = lang + '-' + hash(text); const hit = await cached(key); if (hit) return { url: hit, cached: true };
  if (conn.mode() !== 'server') return { reason: 'the server voice is not connected' };
  try {
    const r = await Promise.race([callApi('/api/speak', { text: text.slice(0, 900), lang }), new Promise((_, rej) => setTimeout(() => rej(new Error('took longer than ' + Math.round(timeoutMs / 1000) + ' seconds')), timeoutMs))]);
    if (r && r.wav) return { url: await store(key, r.wav) }; return { reason: (r && r.error) || 'no audio returned' };
  } catch (e) { return { reason: String(e.message || e).slice(0, 140) }; }
}
// Order: Gemini female voice (most natural), then a female voice on this device in the SAME language. It never switches language and never uses a male or unknown default.
export async function speak(parts, onend, _unused, onStatus) {
  stopSpeech(); voiceInfo.via = ''; voiceInfo.name = ''; voiceInfo.reason = '';
  const say = m => onStatus && onStatus(m); const lang = parts[0].lang || 'en-IN';
  say('Preparing the voice…');
  const chunks = []; { let cur = ''; for (const sn of sentences(parts.map(p => p.text).join(' '))) { if ((cur + ' ' + sn).length > 800 && cur) { chunks.push(cur); cur = sn; } else cur = (cur ? cur + ' ' : '') + sn; } if (cur) chunks.push(cur); }
  const gs = await Promise.all(chunks.map(c => prepareVoice(c, lang))); const bad = gs.find(x => !x.url);
  if (!bad) {
    let k = 0; const play = async () => { if (k >= gs.length) { onend && onend(); return; } audio = new Audio(gs[k++].url); audio.onended = play; await audio.play(); };
    try { await play(); voiceInfo.via = 'gemini'; say('Voice: Gemini (female)' + (gs.every(x => x.cached) ? ', ready from this device' : '')); return 'gemini'; } catch (e) { voiceInfo.reason = 'the browser blocked autoplay. Press Play voice again'; stopSpeech(); }
  } else voiceInfo.reason = 'Gemini voice unavailable: ' + bad.reason;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { say(voiceInfo.reason); onend && onend(); return 'none'; }
  const picks = await Promise.all(parts.map(p => pick(p.lang || 'en-IN')));
  if (picks.some(v => !v)) { say(voiceInfo.reason + '. This device has no female voice for the selected language, so it stays silent rather than switch language. The text is shown above.'); onend && onend(); return 'none'; }
  const queue = []; parts.forEach((p, i) => sentences(p.text).forEach(t => queue.push({ t, lang: p.lang || 'en-IN', v: picks[i] })));
  voiceInfo.via = 'browser'; voiceInfo.name = picks[0].name; say((voiceInfo.reason ? voiceInfo.reason + '. ' : '') + 'Voice: ' + picks[0].name + ' (this device)');
  let i = 0; const next = () => { if (i >= queue.length) { onend && onend(); return; } const q = queue[i++]; const u = new SpeechSynthesisUtterance(q.t); u.lang = q.lang; u.voice = q.v; u.rate = 0.95; u.pitch = 1.0; u.onend = next; u.onerror = next; speechSynthesis.speak(u); };
  next(); return 'browser';
}
