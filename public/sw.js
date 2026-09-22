// OmpathStudy Service Worker - v9. Supabase reads are network-first so an
// empty response captured during a database migration cannot blank the site.
const CACHE_NAME = "ompath-v9";
const API_CACHE = "ompath-api-v4";
// This cache belongs to offlineImageStore. It contains the student's downloaded
// medical diagrams and must survive service-worker upgrades and app restarts.
const OFFLINE_IMAGE_CACHE = "ompath-offline-images-v1";
const PRESERVED_CACHES = new Set([CACHE_NAME, API_CACHE, OFFLINE_IMAGE_CACHE]);
const BASE_PATH = new URL("./", self.location).pathname;\nconst withBase = (path) => `${BASE_PATH}${path}`;\nconst STATIC_ASSETS = [withBase(""), withBase("index.html"), withBase("manifest.json")];

// Install: cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !PRESERVED_CACHES.has(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/~oauth")) return;

  // Supabase REST API: prefer current database state, then fall back offline.
  if (url.hostname.includes("supabase") && url.pathname.includes("/rest/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        try {
          const response = await fetch(event.request);
          if (response.ok) await cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response("[]", { headers: { "Content-Type": "application/json" } });
        }
      })
    );
    return;
  }

  // Skip other supabase calls (auth, functions)
  if (url.hostname.includes("supabase")) return;

  // Navigation: network-first with offline fallback to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((r) => r || caches.match(withBase("")))
        )
    );
    return;
  }

  // JS/CSS chunks: network-first to avoid serving stale hashed bundles after deploy.
  // Falls back to cache only when offline.
  const isHashedBundle = url.pathname.startsWith("/assets/") || /\.(js|css)$/.test(url.pathname);
  if (isHashedBundle) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || new Response("", { status: 503 })))
    );
    return;
  }

  // Images / fonts: cache-first (safe to keep stale)
  if (/\.(png|jpg|jpeg|svg|ico|woff2?|webp|gif)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
