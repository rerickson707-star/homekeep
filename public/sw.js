// Steadwell service worker.
// Bump CACHE whenever this file changes. On activate, every other cache is deleted, which also clears
// any bad entries an older version of this file may have stored.
const CACHE = "steadwell-v3";

// Only keep a response if it is a normal, successful answer from our own site.
// Never store a 404, a 5xx, a redirect or an opaque cross-site response.
function worthCaching(resp) {
  return resp && resp.ok && resp.status === 200 && resp.type === "basic" && !resp.redirected;
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    fetch(new Request("/", { cache: "reload" }))
      .then((resp) => (worthCaching(resp) ? caches.open(CACHE).then((c) => c.put("/", resp)) : null))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, APIs, fonts and analytics go straight to the network

  // Built files have a hash in their name, so a given URL never changes. Use the cache, but only ever store good answers.
  if (url.pathname.startsWith("/assets/") && ["script", "style", "font"].includes(req.destination)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((resp) => {
          if (worthCaching(resp)) { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return resp;
        });
      })
    );
    return;
  }

  // Pages: always ask the network first. Use the saved home page only if the network is unreachable.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
  }
});
