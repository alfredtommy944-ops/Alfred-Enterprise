const CACHE_NAME = "alfred-enterprise-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.jpg?v=2",
  "/icons/icon-512.jpg?v=2"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Always let Netlify Functions / API requests hit the network directly
  if (url.pathname.startsWith("/.netlify/")) return;

  // Network-first for manifest and icons so new icons always replace old ones
  if (url.pathname.includes("manifest") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkRes;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first with background refresh for page/static assets
  event.respondWith(
    caches.match(request).then((cachedRes) => {
      const fetchPromise = fetch(request)
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkRes;
        })
        .catch(() => cachedRes);
      return cachedRes || fetchPromise;
    })
  );
});