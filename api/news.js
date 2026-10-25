// api/news.js — Vercel serverless function.
// Fetches configured RSS feeds (via RSS2JSON, per spec §5), picks one article per
// category (politiek / economie / overige) published in the last 12h, dedupes by
// URL and near-identical titles, and degrades gracefully per source.
//
// IMPORTANT: set RSS2JSON_API_KEY as a Vercel environment variable rather than
// hard-coding it — the key found in the original spec document should be rotated
// before this goes live, since it was shared in a plain-text build spec.

const { fetchWithTimeout, isSafeHttpUrl, stripHtml, truncate, titlesAreSimilar } = require('./_lib/http');

const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json';
const TIME_WINDOW_HOURS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min explicit cache policy, see spec §2/§7

// categoryHint: 'politiek' | 'economie' | null (null = infer from title/summary, default 'overige')
const FEEDS = [
  { source: 'De Tijd', url: 'https://www.tijd.be/rss/nieuws.xml', categoryHint: null },
  { source: 'De Tijd', url: 'https://www.tijd.be/rss/politiek.xml', categoryHint: 'politiek' },
  { source: 'De Tijd', url: 'https://www.tijd.be/rss/ondernemen.xml', categoryHint: 'economie' },
  { source: 'De Standaard', url: 'https://www.standaard.be/binnenland/rss/', categoryHint: null },
  { source: 'De Standaard', url: 'https://www.standaard.be/buitenland/rss/', categoryHint: null },
  { source: 'De Standaard', url: 'https://www.standaard.be/economie/rss/', categoryHint: 'economie' },
  { source: 'De Standaard', url: 'https://www.standaard.be/economie/beurs/rss/', categoryHint: 'economie' },
  { source: 'De Standaard', url: 'https://www.standaard.be/opinies/rss/', categoryHint: null },
  { source: 'HLN', url: 'https://www.hln.be/home/rss.xml', categoryHint: null }
];

const POLITIEK_KEYWORDS = [
  'regering', 'parlement', 'verkiezing', 'minister', 'kamer van volksvertegenwoordigers',
  'coalitie', 'premier', 'kabinet', 'senaat', 'wetsvoorstel', 'referendum', 'burgemeester',
  'gemeenteraad', 'vlaams parlement', 'n-va', 'vooruit', 'cd&v', 'open vld', 'pvda',
  'vlaams belang', 'ecolo', 'regeringsonderhandelingen', 'coalitieakkoord', 'staatshervorming',
  'politiek', 'politieke partij', 'federale regering'
];
const ECONOMIE_KEYWORDS = [
  'economie', 'economisch', 'beurs', 'aandelen', 'inflatie', 'rente', 'begroting', 'belasting',
  'bedrijf', 'omzet', 'winst', 'export', 'bbp', 'werkloosheid', 'ondernemer', 'ondernemen',
  'faillissement', 'beursgenoteerd', 'fusie', 'overname', 'arbeidsmarkt', 'koopkracht'
];

let cache = { data: null, at: 0 };

function categorize(hint, title, summary) {
  if (hint) return hint;
  const haystack = `${title} ${summary}`.toLowerCase();
  if (POLITIEK_KEYWORDS.some(k => haystack.includes(k))) return 'politiek';
  if (ECONOMIE_KEYWORDS.some(k => haystack.includes(k))) return 'economie';
  return 'overige';
}

function parsePubDate(raw) {
  if (!raw) return null;
  // RSS2JSON normalizes pubDate to "YYYY-MM-DD HH:MM:SS" in GMT.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? raw.replace(' ', 'T') + 'Z'
    : raw;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchFeed(feed) {
  const apiKey = process.env.RSS2JSON_API_KEY || 'goxrkjvrqv2dqaaj0mybmnl0vyjxhqccxlh906cv';
  const endpoint = `${RSS2JSON_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}&count=50&rss_url=${encodeURIComponent(feed.url)}`;
  const res = await fetchWithTimeout(endpoint, { timeoutMs: 8000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok' || !Array.isArray(json.items)) {
    throw new Error(json.message || 'ongeldige respons');
  }
  return json.items.map(item => ({
    source: feed.source,
    url: item.link,
    title: stripHtml(item.title),
    summary: truncate(stripHtml(item.description || item.content || '')),
    publishedAt: parsePubDate(item.pubDate),
    categoryHint: feed.categoryHint
  }));
}

function dedupe(articles) {
  const seenUrls = new Set();
  const kept = [];
  for (const a of articles) {
    if (!a.url || !isSafeHttpUrl(a.url)) continue;
    const normalizedUrl = a.url.split('#')[0].replace(/\/$/, '');
    if (seenUrls.has(normalizedUrl)) continue;
    if (kept.some(k => titlesAreSimilar(k.title, a.title))) continue;
    seenUrls.add(normalizedUrl);
    kept.push(a);
  }
  return kept;
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(cache.status).json(cache.data);
  }

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const errors = [];
  let allArticles = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      allArticles = allArticles.concat(r.value);
    } else {
      errors.push({ source: FEEDS[i].source, message: String(r.reason?.message || r.reason) });
    }
  });

  const cutoff = Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = allArticles.filter(a => a.publishedAt && a.publishedAt.getTime() >= cutoff);
  const deduped = dedupe(recent).sort((a, b) => b.publishedAt - a.publishedAt);

  const categories = { politiek: { article: null }, economie: { article: null }, overige: { article: null } };
  const used = new Set();
  for (const article of deduped) {
    const cat = categorize(article.categoryHint, article.title, article.summary);
    if (categories[cat].article || used.has(article.url)) continue;
    categories[cat].article = {
      title: article.title,
      source: article.source,
      url: article.url,
      summary: article.summary,
      publishedAt: article.publishedAt.toISOString(),
      category: cat
    };
    used.add(article.url);
  }

  const payload = { generatedAt: new Date().toISOString(), categories, errors };

  const allFailed = errors.length === FEEDS.length;
  const partial = errors.length > 0 && errors.length < FEEDS.length;
  const status = allFailed ? 502 : (partial ? 207 : 200);

  cache = { data: payload, at: Date.now(), status };
  if (!allFailed) res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  return res.status(status).json(payload);
}

module.exports = handler;
// exported for unit tests — see /test/news.test.js
module.exports.categorize = categorize;
module.exports.parsePubDate = parsePubDate;
module.exports.dedupe = dedupe;
module.exports.FEEDS = FEEDS;
