// GET /api/podcast[?debug=1]
// Geeft de nieuwste aflevering van "De 7" en "DS Vandaag" terug.

import { fetchFeed } from "./_rss.js";

const SHOWS = [
  {
    url: "https://www.omnycontent.com/d/playlist/5978613f-cd11-4352-8f26-adb900fa9a58/3c1222e5-288f-4047-a2f0-ae1b00d0d95a/podcast.rss",
    name: "De 7",
    publisher: "De Tijd"
  },
  {
    url: "https://www.omnycontent.com/d/playlist/fdd7ab40-270d-4a1e-a257-acd200da1324/71125754-bd8a-43e1-9a89-ad86013d0307/podcast.rss",
    name: "DS Vandaag",
    publisher: "De Standaard"
  }
];

async function fetchLatest(show, diag) {
  try {
    const { items, image, via } = await fetchFeed(show.url);
    diag.push({ show: show.name, ok: true, via, count: items.length });
    // nieuwste eerst, ook als de feed niet netjes gesorteerd is
    const sorted = [...items].sort((a, b) => (new Date(b.pubDate) || 0) - (new Date(a.pubDate) || 0));
    const ep = sorted[0];
    return {
      show: show.name,
      publisher: show.publisher,
      title: ep.title,
      pubDate: ep.pubDate,
      cover: ep.thumbnail || image || null,
      audioUrl: ep.enclosure?.link || null,
      duration: ep.enclosure?.duration || null,
      link: ep.link
    };
  } catch (err) {
    diag.push({ show: show.name, ok: false, error: String(err.message || err) });
    return null;
  }
}

export default async function handler(req, res) {
  const debug = req.query?.debug === "1";
  res.setHeader("Cache-Control", debug ? "no-store" : "s-maxage=900, stale-while-revalidate=3600");
  const diag = [];
  const episodes = (await Promise.all(SHOWS.map((s) => fetchLatest(s, diag)))).filter(Boolean);
  res.status(200).json(debug ? { episodes, feeds: diag } : { episodes });
}
