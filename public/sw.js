// Minimal service worker for PWA installability.
// Real offline caching will be added later.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler is required for installability on some browsers.
// Pass-through for now (no caching).
self.addEventListener("fetch", (event) => {
  // no-op; let the network handle it
});
