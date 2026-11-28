const CACHE_NAME = "monitor-db-cache-2026-11-28";
const PRECACHE_URLS = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strict Network-First with cache:'no-cache' for HTML/JS so stale app.js never mixes with fresh index.html
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const req = event.request;
  const url = req.url || "";
  const isCode = req.mode === "navigate" || /\.(html|js)(\?|$)/i.test(url);
  event.respondWith(
    fetch(req, isCode ? { cache: "no-cache" } : undefined)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("./index.html") || caches.match("./monitor_full_database.html")))
  );
});
