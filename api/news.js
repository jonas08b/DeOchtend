// GET /api/news
// Haalt RSS-feeds op via rss2json, dedupeert, en geeft max 1 artikel
// per categorie terug (politiek, economie, overige), gepubliceerd < 12u geleden.

const FEEDS = [
  { url: "https://www.tijd.be/rss/nieuws.xml", source: "De Tijd", category: "overige" },
  { url: "https://www.tijd.be/rss/politiek.xml", source: "De Tijd", category: "politiek" },
  { url: "https://www.tijd.be/rss/ondernemen.xml", source: "De Tijd", category: "economie" },
  { url: "https://www.standaard.be/binnenland/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.standaard.be/buitenland/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.standaard.be/economie/rss/", source: "De Standaard", category: "economie" },
  { url: "https://www.standaard.be/economie/beurs/rss/", source: "De Standaard", category: "economie" },
  { url: "https://www.standaard.be/opinies/rss/", source: "De Standaard", category: "overige" },
  { url: "https://www.hln.be/home/rss.xml", source: "HLN", category: "overige" }
];

const PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(PROXY + encodeURIComponent(feed.url), {
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.items)) return [];
    return data.items.map((item) => ({
      title: item.title,
      url: item.link,
      source: feed.source,
      category: feed.category,
      pubDate: item.pubDate,
      image: item.thumbnail || item.enclosure?.link || null,
      description: (item.description || "").replace(/<[^>]*>/g, "").slice(0, 180)
    }));
  } catch (err) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    let items = results.flat();

    const now = Date.now();
    items = items.filter((it) => {
      const t = new Date(it.pubDate).getTime();
      return !isNaN(t) && now - t <= TWELVE_HOURS_MS;
    });

    // Dedupe op URL of bijna-identieke titel
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

    res.status(200).json({ items: picked, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Kon nieuws niet ophalen", items: [] });
  }
}
