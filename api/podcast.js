// api/podcast.js — Vercel serverless function.
// Fetches the configured podcast RSS feeds directly (not via RSS2JSON, since we need
// enclosure/duration/image data that a generic RSS→JSON proxy often drops) and returns
// the newest episode per source.
//
// NOTE per spec §3.3/§5: "Verifieer de exacte feed-URL's en de bedoelde dagelijkse
// podcast voordat de module wordt afgerond" — the spec itself flags these URLs as
// possibly wrong ("Kan fout zijn"). Confirm both URLs resolve to the intended daily
// news podcast (De Tijd: "De 7"; De Standaard: "DS Vandaag") before relying on this
// in production. A third feed ("De 7 extra") is defined but disabled by default —
// enable it only once you've confirmed the module should show more than one De Tijd
// episode, since the spec names exactly one source per publisher.

const { XMLParser } = require('fast-xml-parser');
const { fetchWithTimeout, isSafeHttpUrl, stripHtml } = require('./_lib/http');

const CACHE_TTL_MS = 15 * 60 * 1000;

const FEEDS = [
  {
    sourceLabel: 'De Tijd — De 7',
    url: 'https://www.omnycontent.com/d/playlist/5978613f-cd11-4352-8f26-adb900fa9a58/3c1222e5-288f-4047-a2f0-ae1b00d0d95a/podcast.rss'
  },
  // Disabled by default — see note above. Uncomment if "De 7 extra" should also appear.
  // { sourceLabel: 'De Tijd — De 7 extra', url: 'https://omny.fm/shows/de-7/playlists/de-7-extra.rss' },
  {
    sourceLabel: 'De Standaard — DS Vandaag',
    url: 'https://www.omnycontent.com/d/playlist/fdd7ab40-270d-4a1e-a257-acd200da1324/71125754-bd8a-43e1-9a89-ad86013d0307/podcast.rss'
  }
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true });

function parseDurationToSeconds(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (/^\d+$/.test(str)) return Number(str); // already seconds
  const parts = str.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function firstItem(channel) {
  const items = channel?.item;
  if (!items) return null;
  return Array.isArray(items) ? items[0] : items;
}

async function fetchEpisode(feed) {
  const res = await fetchWithTimeout(feed.url, {
    timeoutMs: 8000,
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  if (!channel) throw new Error('onverwacht RSS-formaat');
  const item = firstItem(channel);
  if (!item) throw new Error('geen afleveringen gevonden');

  const enclosureUrl = item.enclosure?.['@_url'] || null;
  const image = item['itunes:image']?.['@_href'] || channel['itunes:image']?.['@_href'] || channel.image?.url || null;
  const durationRaw = item['itunes:duration'];
  const pubDate = item.pubDate ? new Date(item.pubDate) : null;

  return {
    sourceLabel: feed.sourceLabel,
    title: stripHtml(item.title),
    publishedAt: pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : null,
    coverUrl: image && isSafeHttpUrl(image) ? image : null,
    durationSeconds: parseDurationToSeconds(durationRaw),
    audioUrl: enclosureUrl && isSafeHttpUrl(enclosureUrl) ? enclosureUrl : null,
    pageUrl: item.link && isSafeHttpUrl(item.link) ? item.link : null
  };
}

let cache = { data: null, at: 0, status: 200 };

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(cache.status).json(cache.data);
  }

  const results = await Promise.allSettled(FEEDS.map(fetchEpisode));
  const errors = [];
  const episodes = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') episodes.push(r.value);
    else errors.push({ source: FEEDS[i].sourceLabel, message: String(r.reason?.message || r.reason) });
  });

  episodes.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  const payload = { generatedAt: new Date().toISOString(), episodes, errors };
  const allFailed = errors.length === FEEDS.length;
  const partial = errors.length > 0 && errors.length < FEEDS.length;
  const status = allFailed ? 502 : (partial ? 207 : 200);

  cache = { data: payload, at: Date.now(), status };
  if (!allFailed) res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  return res.status(status).json(payload);
}

module.exports = handler;
// exported for unit tests — see /test/podcast.test.js
module.exports.parseDurationToSeconds = parseDurationToSeconds;
module.exports.FEEDS = FEEDS;
