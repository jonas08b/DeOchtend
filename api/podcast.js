// GET /api/podcast
// Geeft de nieuwste aflevering van "De 7" en "DS Vandaag" terug.

const PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

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

async function fetchLatest(show) {
  try {
    const res = await fetch(PROXY + encodeURIComponent(show.url), {
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "ok" || !data.items?.length) return null;
    const ep = data.items[0];
    return {
      show: show.name,
      publisher: show.publisher,
      title: ep.title,
      pubDate: ep.pubDate,
      cover: ep.thumbnail || data.feed?.image || null,
      audioUrl: ep.enclosure?.link || null,
      duration: ep.enclosure?.duration || null,
      link: ep.link
    };
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  const episodes = (await Promise.all(SHOWS.map(fetchLatest))).filter(Boolean);
  res.status(200).json({ episodes });
}
