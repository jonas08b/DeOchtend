// GET /api/news[?debug=1]
// Haalt RSS-feeds rechtstreeks op, dedupeert, en geeft max 1 artikel per categorie
// (politiek, economie, overige) terug, gepubliceerd < 12u geleden.

import { fetchFeed } from "./_rss.js";

const FEEDS = [
  { url: "https://www.tijd.be/rss/nieuws.xml", source: "De Tijd", category: "overige" },
  { url: "https://www.tijd.be/rss/politiek.xml", source: "De Tijd", category: "politiek" },
  { url: "https://www.tijd.be/rss/ondernemen.xml", source: "De Tijd", category: "economie" },
  { url: "https://www.standaard.be/binnenland/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.standaard.be/buitenland/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.standaard.be/economie/rss/", source: "De Standaard", category: "economie" },
  { url: "https://www.standaard.be/economie/beurs/rss/", source: "De Standaard", category: "economie" },
  { url: "https://www.standaard.be/opinies/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.hln.be/home/rss.xml", source: "HLN", category: "overige" },
  // Extra, stabiele bronnen zodat er altijd iets te tonen is
  { url: "https://www.vrt.be/vrtnws/nl.rss.articles.xml", source: "VRT NWS", category: "overige" }
];

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadFeed(feed, diag) {
  try {
    const { items, via } = await fetchFeed(feed.url);
    diag.push({ url: feed.url, ok: true, via, count: items.length });
    return items.map((item) => ({
      title: item.title,
      url: item.link,
      source: feed.source,
      category: feed.category,
      pubDate: item.pubDate,
      image: item.thumbnail || item.enclosure?.link || null,
      description: (item.description || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 180)
    }));
  } catch (err) {
    diag.push({ url: feed.url, ok: false, error: String(err.message || err) });
    return [];
  }
}

export default async function handler(req, res) {
  const debug = req.query?.debug === "1";
  res.setHeader("Cache-Control", debug ? "no-store" : "s-maxage=600, stale-while-revalidate=1800");
  try {
    const diag = [];
    const results = await Promise.all(FEEDS.map((f) => loadFeed(f, diag)));
    let items = results.flat().filter((it) => it.title && it.url);
    const total = items.length;

    const now = Date.now();
    items = items.filter((it) => {
      const t = new Date(it.pubDate).getTime();
      // kleine tolerantie voor klokverschillen (feeds met datum net in de toekomst)
      return !isNaN(t) && now - t <= TWELVE_HOURS_MS && t - now < 15 * 60 * 1000;
    });

    const seenUrls = new Set();
    const seenTitles = new Set();
    items = items.filter((it) => {
      if (seenUrls.has(it.url)) return false;
      const nt = normalizeTitle(it.title);
      if (seenTitles.has(nt)) return false;
      seenUrls.add(it.url);
      seenTitles.add(nt);
      return true;
    });

    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const categories = ["politiek", "economie", "overige"];
    const picked = categories
      .map((cat) => items.find((it) => it.category === cat))
      .filter(Boolean);

    const body = { items: picked, generatedAt: new Date().toISOString() };
    if (debug) Object.assign(body, { totalFetched: total, within12h: items.length, feeds: diag });
    res.status(200).json(body);
  } catch (err) {
    res.status(500).json({ error: "Kon nieuws niet ophalen", items: [] });
  }
}
