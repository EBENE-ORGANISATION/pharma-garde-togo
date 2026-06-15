// PharmaGarde service worker — cache-first for the app shell, static assets
// and map tiles, so the app can open and show the last-known data offline.
//
// Bump CACHE_VERSION on every deploy that changes cached assets so old
// caches get cleaned up on activate.
const CACHE_VERSION = "v1";
const CACHE_NAME = `pharmagarde-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Hosts whose responses are safe to cache-first at runtime (map tiles,
// fonts, etc). Supabase API calls are intentionally NOT cached here —
// the app already handles offline data via IndexedDB (see src/lib/db.ts).
const RUNTIME_CACHE_HOSTS = ["tile.openstreetmap.org"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("pharmagarde-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigations (HTML pages): cache-first, falling back to the cached app
  // shell ("/") for client-side routing, then to a static offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          return await cacheFirst(request, cache);
        } catch {
          return (
            (await cache.match("/")) ||
            (await cache.match("/offline.html")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isStaticAsset = sameOrigin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"));
  const isRuntimeHost = RUNTIME_CACHE_HOSTS.includes(url.hostname);

  if (isStaticAsset || isRuntimeHost) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          return await cacheFirst(request, cache);
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error("offline and not cached");
        }
      })(),
    );
  }
  // Everything else (Supabase API, etc.) goes straight to the network.
});
