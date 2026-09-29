// QuizArena Service Worker
const CACHE_NAME = "quizarena-v11";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./ranking.html",
  "./ranking.js",
  "./visual.css",
  "./content.js",
  "./favicon.png",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  ...["bandeiras","capitais","lingua-paises","linguas-frases","animais","arte","monumentos","comidas","instrumentos","anime","super-herois","mapa","linha-do-tempo","associacoes","audio-instrumentos"].map(id=>`./category-icons/${id}.png`)
];

// Install: pre-cache the core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigations: network-first with offline fallback, so login returns to the current page.
// - Static assets: cache-first until the cache version changes.
// - External images and API responses stay under the provider's cache policy.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  if (isSameOrigin && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/auth/')) {
    // Cache-first for our own app shell files
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});
