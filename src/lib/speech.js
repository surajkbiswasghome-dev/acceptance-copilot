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
export async function speak(parts, onend, fallbackParts) {
  stopSpeech(); if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onend && onend(); return 'none'; }
  let use = parts; const picks = await Promise.all(use.map(p => pick(p.lang || 'en-IN')));
  if (picks.some(v => !v) && fallbackParts) { use = fallbackParts; picks.length = 0; for (const p of use) picks.push(await pick(p.lang || 'en-IN')); }
  const queue = []; use.forEach((p, i) => sentences(p.text).forEach(t => queue.push({ t, lang: p.lang || 'en-IN', v: picks[i] })));
  let i = 0; const next = () => { if (i >= queue.length) { onend && onend(); return; } const q = queue[i++]; const u = new SpeechSynthesisUtterance(q.t); u.lang = q.lang; if (q.v) u.voice = q.v; u.rate = 0.95; u.pitch = 1.0; u.onend = next; u.onerror = next; speechSynthesis.speak(u); };
  next(); return fallbackParts && use === fallbackParts ? 'fallback' : 'browser';
}
// Optional: Gemini speech, only when switched on (localStorage ac_voice=gemini). Slower to start, so it is not the default.
export async function speakGemini(text, onend) {
  if (conn.mode() !== 'server') return false;
  try { const r = await callApi('/api/speak', { text: text.slice(0, 700) }); if (r && r.wav) { audio = new Audio('data:audio/wav;base64,' + r.wav); audio.onended = () => onend && onend(); await audio.play(); return true; } } catch (e) {}
  return false;
}
