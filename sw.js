const CACHE_NAME = "alfred-enterprise-v4";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest?v=2",
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

  // Network-first for HTML pages, manifest, and icons so updates always load cleanly
  const isHtmlRequest =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html");

  if (isHtmlRequest || url.pathname.includes("manifest") || url.pathname.startsWith("/icons/")) {
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

  // Cache-first with background refresh for other static assets
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

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "Alfred Enterprise — New Drop!";
  const options = {
    body: data.body || "New items are now available at IDA, Kenema City.",
    icon: data.icon || "/icons/icon-192.jpg?v=2",
    badge: data.badge || "/icons/icon-192.jpg?v=2",
    image: data.image || undefined,
    tag: data.tag || "alfred-enterprise-alert",
    renotify: true,
    data: {
      url: data.url || "/#store-section"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/#store-section";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
