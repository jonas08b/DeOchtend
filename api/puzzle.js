// GET /api/puzzle
// Haalt een schaakpuzzel op bij Lichess. Dit bestand ontbrak volledig in het project —
// js/chess.js roept wel /api/puzzle aan, maar zonder deze function kreeg dat altijd een
// 404 terug, vandaar "Kon puzzel niet laden. Probeer opnieuw." in de UI.
//
// Geeft { puzzle: <lichess PuzzleAndGame>, source: "next" | "daily" } terug — dat is
// precies de vorm die js/chess.js verwacht: puzzle.game.pgn en puzzle.puzzle.solution.

const UA = "Mozilla/5.0 (compatible; DeOchtendBot/1.0; +https://vercel.com)";

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Lichess HTTP ${res.status} voor ${url}`);
  const data = await res.json();
  if (!data?.game?.pgn || !data?.puzzle?.solution) {
    throw new Error("onverwacht Lichess-antwoord (geen game.pgn/puzzle.solution)");
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store"); // elke puzzel moet nieuw zijn
  const debug = req.query?.debug === "1";
  const diag = [];

  try {
    try {
      const puzzle = await getJson("https://lichess.org/api/puzzle/next");
      diag.push({ step: "next", ok: true });
      const body = { puzzle, source: "next" };
      if (debug) body.diag = diag;
      return res.status(200).json(body);
    } catch (err) {
      diag.push({ step: "next", ok: false, error: String(err.message || err) });
    }

    // Fallback: de dagpuzzel. Minder variatie, maar faalt zelden.
    const puzzle = await getJson("https://lichess.org/api/puzzle/daily");
    diag.push({ step: "daily", ok: true });
    const body = { puzzle, source: "daily" };
    if (debug) body.diag = diag;
    return res.status(200).json(body);
  } catch (err) {
    diag.push({ step: "daily", ok: false, error: String(err.message || err) });
    const body = { error: "Kon puzzel niet ophalen bij Lichess" };
    if (debug) body.diag = diag;
    return res.status(502).json(body);
  }
}
