// sw.js — caches the static app shell only. News/podcast/puzzle API calls are
// deliberately left to the network (network-first with no SW caching) because
// freshness there matters more than offline availability (see spec §2 and §7).
const CACHE_VERSION = 'deochtend-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/news.js',
  '/js/chess.js',
  '/js/vendor/chess.esm.js',
  '/js/podcast.js',
  '/js/mentalmath.js',
  '/js/braintest.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or cross-origin requests (Lichess, fonts, etc.) —
  // let the page's own fetch() handle timeouts, errors and soft caching.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // App shell: cache-first, falling back to network, so the dashboard shell
  // (minus live data) still opens offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
