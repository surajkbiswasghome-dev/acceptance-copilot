// Welcome messages in four languages. Only the welcome and its voice change language; the rest of the platform stays in English.
export const LANGS = [{ id: 'en', label: 'English', tag: 'en-IN' }, { id: 'hi', label: 'हिन्दी', tag: 'hi-IN' }, { id: 'bn', label: 'বাংলা', tag: 'bn-IN' }, { id: 'mr', label: 'मराठी', tag: 'mr-IN' }];
export const DEFAULT_LANG = { pm: 'en', head: 'hi', en: 'bn', dev: 'mr' };
const PACK = {
  en: { hello: (n, g) => `${g} ${n}, welcome to Sadhana Portal.`, g: ['Good morning', 'Good afternoon', 'Good evening'], rate: x => `Success is ${x}% over the last 30 days.`, finds: n => `${n} finding${n === 1 ? '' : 's'} to decide`, route: n => `${n} routing request${n === 1 ? '' : 's'} awaiting approval`, reply: n => `${n} merchant repl${n === 1 ? 'y' : 'ies'} to follow up`, join: b => `You have ${b.join(', ')}.`, none: 'Nothing is waiting on you right now.', top: t => `Biggest leak: ${t}.`, end: 'How may I help you?' },
  hi: { hello: (n, g) => `${g} ${n}, साधना पोर्टल में आपका स्वागत है।`, g: ['सुप्रभात', 'शुभ दोपहर', 'शुभ संध्या'], rate: x => `पिछले तीस दिनों में सफलता दर ${x}% है।`, finds: n => `${n} निष्कर्षों पर निर्णय बाकी है`, route: n => `${n} राउटिंग अनुरोध मंज़ूरी की प्रतीक्षा में हैं`, reply: n => `${n} मर्चेंट के जवाब पर फ़ॉलो-अप बाकी है`, join: b => `आपके पास ${b.join(', ')}।`, none: 'अभी आपके लिए कुछ भी लंबित नहीं है।', top: t => `सबसे बड़ा लीक: ${t}।`, end: 'मैं आपकी कैसे मदद कर सकती हूँ?' },
  bn: { hello: (n, g) => `${g} ${n}, সাধনা পোর্টালে আপনাকে স্বাগতম।`, g: ['শুভ সকাল', 'শুভ অপরাহ্ন', 'শুভ সন্ধ্যা'], rate: x => `গত তিরিশ দিনে সাফল্যের হার ${x}%।`, finds: n => `${n}টি সিদ্ধান্ত বাকি আছে`, route: n => `${n}টি রাউটিং অনুরোধ অনুমোদনের অপেক্ষায়`, reply: n => `${n}জন মার্চেন্টের উত্তরে ফলো-আপ করতে হবে`, join: b => `আপনার কাছে ${b.join(', ')}।`, none: 'এই মুহূর্তে আপনার জন্য কিছু অপেক্ষায় নেই।', top: t => `সবচেয়ে বড় লিক: ${t}।`, end: 'আমি কীভাবে আপনাকে সাহায্য করতে পারি?' },
  mr: { hello: (n, g) => `${g} ${n}, साधना पोर्टलमध्ये तुमचे स्वागत आहे।`, g: ['शुभ प्रभात', 'शुभ दुपार', 'शुभ संध्याकाळ'], rate: x => `गेल्या तीस दिवसांत यश दर ${x}% आहे।`, finds: n => `${n} निष्कर्षांवर निर्णय बाकी आहे`, route: n => `${n} राउटिंग विनंत्या मंजुरीची वाट पाहत आहेत`, reply: n => `${n} मर्चंटच्या उत्तरावर फॉलो-अप करायचा आहे`, join: b => `तुमच्याकडे ${b.join(', ')}।`, none: 'सध्या तुमच्यासाठी काहीही प्रलंबित नाही।', top: t => `सर्वात मोठी गळती: ${t}।`, end: 'मी तुम्हाला कशी मदत करू शकते?' }
};
// Hour in India, so "good evening" is right whatever the server or laptop clock says.
export const istHour = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(d)) % 24;
export const slot = (d = new Date()) => { const h = istHour(d); return h < 12 ? 0 : h < 17 ? 1 : 2; };
export function welcome(lang, name, st, success, d = new Date()) {
  const P = PACK[lang] || PACK.en; const g = P.g[slot(d)]; const bits = [];
  if (st.undecided.length) bits.push(P.finds(st.undecided.length)); if (st.pend.length) bits.push(P.route(st.pend.length));
  const rep = st.interested.length + st.calls.length; if (rep) bits.push(P.reply(rep));
  const l2 = [P.rate(success), bits.length ? P.join(bits) : P.none, st.top ? P.top(st.top.title) : '', P.end].filter(Boolean).join(' ');
  const tag = LANGS.find(x => x.id === lang)?.tag || 'en-IN'; const hello = P.hello(name, g);
  return { l1: hello, l2, parts: [{ text: hello + ' ' + l2, lang: tag }] };
}
