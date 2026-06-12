// Steadwell Service Worker — keeps the app alive and caches assets
const CACHE = "steadwell-v1";
const STATIC = ["/", "/index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

// Network-first for API calls, cache-first for static assets
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Always network for API/auth calls
  if (url.hostname.includes("supabase") || url.hostname.includes("anthropic") || url.hostname.includes("googleapis")) {
    return;
  }
  // Cache-first for static assets (JS, CSS, fonts)
  if (e.request.destination === "script" || e.request.destination === "style" || e.request.destination === "font") {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }
  // Network-first with offline fallback for navigation
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
  }
});
