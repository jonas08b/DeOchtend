// Gedeelde RSS-helper (bestanden met "_" als prefix worden door Vercel niet als route gebruikt).
// Haalt de feed rechtstreeks op en parsed de XML zelf. rss2json is enkel nog een fallback,
// omdat die gratis dienst vanaf Vercel-IP's vaak geblokkeerd/gelimiteerd wordt (en dan stil faalde).

const UA = "Mozilla/5.0 (compatible; DeOchtendBot/1.0; +https://vercel.com)";
const PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(str = "") {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function clean(raw = "") {
  let s = raw.trim();
  const cdata = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  s = cdata ? cdata[1] : decode(s);
  return s.trim();
}

function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? clean(m[1]) : "";
}

function attr(block, name, attribute) {
  const re = new RegExp(`<${name}\\b([^>]*?)/?>`, "i");
  const m = block.match(re);
  if (!m) return "";
  const a = m[1].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"));
  return a ? decode(a[1]) : "";
}

function parseXml(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  const channelHead = xml.split(/<(?:item|entry)[\s>]/i)[0];
  const feedImage = attr(channelHead, "itunes:image", "href") || tag(channelHead.match(/<image>[\s\S]*?<\/image>/i)?.[0] || "", "url");
  const items = blocks.map((b) => {
    const link = tag(b, "link") || attr(b, "link", "href");
    const pubDate = tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "published") || tag(b, "updated");
    const enclosureTag = b.match(/<enclosure\b[^>]*>/i)?.[0] || "";
    const thumb =
      attr(b, "media:thumbnail", "url") ||
      attr(b, "media:content", "url") ||
      (/image/i.test(attr(enclosureTag, "enclosure", "type")) ? attr(enclosureTag, "enclosure", "url") : "") ||
      attr(b, "itunes:image", "href");
    return {
      title: tag(b, "title"),
      link,
      pubDate,
      description: tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded"),
      thumbnail: thumb || null,
      enclosure: enclosureTag
        ? {
            link: attr(enclosureTag, "enclosure", "url"),
            type: attr(enclosureTag, "enclosure", "type"),
            duration: tag(b, "itunes:duration") || null
          }
        : null
    };
  });
  return { items, image: feedImage || null };
}

async function viaDirect(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    redirect: "follow",
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const parsed = parseXml(await res.text());
  if (!parsed.items.length) throw new Error("geen items in feed");
  return parsed;
}

async function viaProxy(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error("rss2json HTTP " + res.status);
  const data = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.items) || !data.items.length) throw new Error("rss2json: " + (data.message || "leeg"));
  return { items: data.items, image: data.feed?.image || null };
}

// Geeft { items, image, via } of gooit een fout met beide oorzaken.
export async function fetchFeed(url) {
  let directErr;
  try {
    return { ...(await viaDirect(url)), via: "direct" };
  } catch (e) {
    directErr = e;
  }
  try {
    return { ...(await viaProxy(url)), via: "rss2json" };
  } catch (e) {
    throw new Error(`direct: ${directErr.message}; proxy: ${e.message}`);
  }
}
