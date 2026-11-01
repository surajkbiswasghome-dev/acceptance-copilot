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
// Order: Gemini speech from the server (a female voice, most natural, takes a few seconds), then a female voice on this device. Never a male or unknown default.
export async function speak(parts, onend, fallbackParts, onStatus) {
  stopSpeech(); voiceInfo.via = ''; voiceInfo.name = ''; voiceInfo.reason = '';
  const say = m => onStatus && onStatus(m);
  if (conn.mode() === 'server') {
    say('Preparing the voice…'); const g = await speakGemini(parts.map(p => p.text).join(' '), onend);
    if (g === true) { voiceInfo.via = 'gemini'; voiceInfo.name = 'Gemini, female voice'; say('Voice: Gemini (female)'); return 'gemini'; }
    voiceInfo.reason = 'Server voice unavailable (' + g + ')';
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { voiceInfo.reason += ' No speech support in this browser.'; say(voiceInfo.reason); onend && onend(); return 'none'; }
  let use = parts; const picks = await Promise.all(use.map(p => pick(p.lang || 'en-IN')));
  if (picks.some(v => !v) && fallbackParts) { use = fallbackParts; picks.length = 0; for (const p of use) picks.push(await pick(p.lang || 'en-IN')); }
  if (picks.some(v => !v)) { voiceInfo.reason = 'No female voice found on this device, so nothing was spoken. The text is shown. ' + voiceInfo.reason; say(voiceInfo.reason); onend && onend(); return 'none'; }
  const queue = []; use.forEach((p, i) => sentences(p.text).forEach(t => queue.push({ t, lang: p.lang || 'en-IN', v: picks[i] })));
  voiceInfo.via = 'browser'; voiceInfo.name = picks[0].name; say('Voice: ' + picks[0].name + (use === fallbackParts ? ' (English, no ' + parts[0].lang + ' voice on this device)' : ''));
  let i = 0; const next = () => { if (i >= queue.length) { onend && onend(); return; } const q = queue[i++]; const u = new SpeechSynthesisUtterance(q.t); u.lang = q.lang; u.voice = q.v; u.rate = 0.95; u.pitch = 1.0; u.onend = next; u.onerror = next; speechSynthesis.speak(u); };
  next(); return use === fallbackParts ? 'fallback' : 'browser';
}
// Gemini speech through the server. Returns true when it plays, otherwise the reason.
export async function speakGemini(text, onend) {
  try {
    const r = await Promise.race([callApi('/api/speak', { text: text.slice(0, 700) }), new Promise((_, rej) => setTimeout(() => rej(new Error('took longer than 20 seconds')), 20000))]);
    if (r && r.wav) { audio = new Audio('data:audio/wav;base64,' + r.wav); audio.onended = () => onend && onend(); await audio.play(); return true; }
    return (r && r.error) || 'no audio returned';
  } catch (e) { return String(e.message || e).slice(0, 120); }
}
