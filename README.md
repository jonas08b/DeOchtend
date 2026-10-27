# DeOchtend

Mobile-first PWA-dashboard: nieuws, podcast, schaakpuzzel, hoofdrekenen, braintest.

## Deployen (Vercel)

```bash
npm i -g vercel   # eenmalig
cd deochtend
vercel            # volg de prompts, of: vercel --prod
```

Geen environment variables nodig — `rss2json` en de Lichess/Open-Meteo API's zijn gratis en
key-loos voor dit gebruik. Alle data-ophaling loopt via `/api/news`, `/api/podcast` en
`/api/puzzle` (Vercel serverless functions), zodat er geen CORS-problemen zijn en caching
server-side gebeurt.

## Structuur

```
index.html        hoofdpagina + alle "tabs" (home/schaak/rekenen/test) in één SPA
css/styles.css     styling, licht+donker thema, iPhone safe-area
js/app.js          routing, weerwidget, nieuws/podcast-widgets
js/chess.js        schaakpuzzel-logica (chess.js + Lichess puzzle API)
js/mentalmath.js   hoofdrekenen-oefensessies (Zetamac-stijl)
js/braintest.js    Stroop / reactiesnelheid / reeksgeheugen
api/news.js        proxy + dedupe + 1 artikel per categorie (politiek/economie/overige)
api/podcast.js     laatste aflevering van "De 7" en "DS Vandaag"
api/puzzle.js       lichess "next", fallback op "daily"
manifest.json, sw.js   PWA-installeerbaarheid + offline app-shell caching
```

## Belangrijke keuzes & openstaande punten

- **Schaak-engine (chess.js)**: in de spec staat "lokaal gevendord zodat de module ook zonder
  CDN/offline werkt". Dit sandbox-environment heeft geen internettoegang om het npm-pakket
  effectief te downloaden en lokaal op te slaan. `index.html` laadt het nu via een gepinde
  CDN-versie (cdnjs, chess.js 0.13.4). **Om het echt lokaal te vendoren**: download
  `chess.min.js` van https://cdnjs.com/libraries/chess.js en plaats het in `js/vendor/chess.min.js`,
  en vervang in `index.html` de `<script src="https://cdnjs...">` door
  `<script src="/js/vendor/chess.min.js">`. De rest van de code blijft ongewijzigd.
- **Weer-widget**: gebruikt Open-Meteo (gratis, geen key) voor Mechelen (51.0284, 4.4803),
  rechtstreeks client-side opgevraagd.
- **Offline-gedrag**: de service worker cachet de app-shell (HTML/CSS/JS) zodat de app zonder
  verbinding opstart; `/api/*`-aanroepen (nieuws, podcast, puzzel) vereisen uiteraard wel
  internet. Hoofdrekenen en Braintest werken volledig offline zodra de shell gecached is.
- **App-iconen**: `icons/icon.svg` is een eenvoudige placeholder. Vervang gerust door een
  eigen PNG/SVG-logo.
- **RSS2JSON-limiet**: het gratis `api.rss2json.com`-plan heeft een dagelijkse quotum per
  IP/key. Bij hoog gebruik kan een eigen API-key (als querystring `&api_key=...`) nodig zijn —
  voeg die toe in `api/news.js` en `api/podcast.js` indien je tegen limieten aanloopt.

## Lokaal testen

```bash
vercel dev
```
