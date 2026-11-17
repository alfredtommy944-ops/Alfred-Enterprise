const CACHE_NAME = "alfred-enterprise-v3";
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

// Background Web Push Listener (pops up on home screen even when browser/app is closed)
self.addEventListener("push", (event) => {
  let payload = {
    title: "Alfred Enterprise — New Alert!",
    body: "New products and offers are now available at IDA, Kenema City.",
    url: "/#store-section",
    tag: "alfred-enterprise-push"
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const options = {
    body: payload.body,
    icon: "/icons/icon-192.jpg?v=2",
    badge: "/icons/icon-192.jpg?v=2",
    tag: payload.tag || "alfred-enterprise-push",
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 120, 250, 120, 350],
    data: {
      url: payload.url || "/#store-section"
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Tap Notification -> Focus existing window or open store
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/#store-section";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
