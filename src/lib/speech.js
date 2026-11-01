// Speaks text in a natural female voice. Tries Gemini speech through the server, then the best female voice the browser has.
import { callApi, conn } from './db.js';
let audio = null;
export const stopSpeech = () => { try { audio && audio.pause(); } catch (e) {} audio = null; try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };
const voices = () => new Promise(res => { const v = speechSynthesis.getVoices(); if (v.length) return res(v); const t = setTimeout(() => res(speechSynthesis.getVoices()), 800); speechSynthesis.onvoiceschanged = () => { clearTimeout(t); res(speechSynthesis.getVoices()); }; });
const FEMALE = /(female|heera|neerja|swara|veena|kalpana|lekha|samantha|zira|aria|jenny|sonia|libby|karen|moira|tessa|fiona|natasha|priya|google uk english female|google हिन्दी|google hindi)/i;
async function pick(lang) { const vs = await voices(); const base = lang.slice(0, 2); const same = vs.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase())); const near = vs.filter(v => v.lang.toLowerCase().startsWith(base)); const pool = same.length ? same : near; return pool.find(v => FEMALE.test(v.name) && /(natural|online|neural)/i.test(v.name)) || pool.find(v => FEMALE.test(v.name)) || pool.find(v => /(natural|online|neural)/i.test(v.name)) || pool[0] || null; }
function browserSpeak(parts, onend) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onend && onend(); return false; }
  speechSynthesis.cancel(); let i = 0;
  const next = async () => { if (i >= parts.length) { onend && onend(); return; } const p = parts[i++]; const u = new SpeechSynthesisUtterance(p.text); u.lang = p.lang || 'en-IN'; const v = await pick(u.lang); if (v) u.voice = v; u.rate = 0.94; u.pitch = 1.08; u.onend = next; u.onerror = next; speechSynthesis.speak(u); };
  next(); return true;
}
export async function speak(parts, onend) {
  stopSpeech(); const text = parts.map(p => p.text).join(' ');
  if (conn.mode() === 'server' && text.length <= 700) {
    try { const r = await Promise.race([callApi('/api/speak', { text }), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 9000))]);
      if (r && r.wav) { audio = new Audio('data:audio/wav;base64,' + r.wav); audio.onended = () => onend && onend(); await audio.play(); return 'gemini'; } } catch (e) { /* fall back to the browser voice */ }
  }
  return browserSpeak(parts, onend) ? 'browser' : 'none';
}
