// Latest RBI and NPCI headlines for the sign-in screen. Public, read-only, fixed sources, cached. If a source cannot be reached the screen shows official links instead.
const FEEDS = [
  { tag: 'RBI', url: 'https://news.google.com/rss/search?q=RBI+(payments+OR+UPI+OR+%22payment+aggregator%22+OR+circular)+when:14d&hl=en-IN&gl=IN&ceid=IN:en' },
  { tag: 'NPCI', url: 'https://news.google.com/rss/search?q=(NPCI+OR+RuPay+OR+UPI)+when:14d&hl=en-IN&gl=IN&ceid=IN:en' }
];
const OFFICIAL = [
  { tag: 'RBI', title: 'RBI press releases: payment and settlement systems', url: 'https://website.rbi.org.in/en/web/rbi/payment-and-settlements/press-releases' },
  { tag: 'NPCI', title: 'NPCI press releases', url: 'https://www.npci.org.in/npci-in-news/press-releases/press-releases-archive' },
  { tag: 'NPCI', title: 'UPI monthly product statistics', url: 'https://www.npci.org.in/what-we-do/upi/product-statistics' }
];
let cache = { at: 0, items: [] };
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
function parse(xml, tag) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map(m => { const b = m[1]; const g = k => (b.match(new RegExp('<' + k + '[^>]*>([\\s\\S]*?)</' + k + '>')) || [])[1]; const title = dec(g('title') || ''); const link = dec(g('link') || ''); const src = dec(g('source') || ''); const sUrl = (b.match(/<source[^>]*url="([^"]+)"/) || [])[1] || ''; const d = g('pubDate') ? new Date(dec(g('pubDate'))) : null;
    return { tag, title: src && title.endsWith(' - ' + src) ? title.slice(0, -(src.length + 3)) : title, source: src, sourceUrl: sUrl, url: link, date: d && !isNaN(d) ? d.toISOString() : null }; }).filter(x => x.title && /^https?:\/\//.test(x.url));
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=3600');
  if (Date.now() - cache.at < 20 * 60 * 1000 && cache.items.length) return res.status(200).json({ items: cache.items, official: OFFICIAL, live: true });
  const out = await Promise.all(FEEDS.map(async f => { try { const r = await fetch(f.url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 AcceptanceCopilot' } }); if (!r.ok) return []; return parse(await r.text(), f.tag).slice(0, 4); } catch { return []; } }));
  const items = out.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (items.length) cache = { at: Date.now(), items };
  return res.status(200).json({ items, official: OFFICIAL, live: items.length > 0 });
}
