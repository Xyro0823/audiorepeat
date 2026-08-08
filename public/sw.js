/* AudioRepeat service worker — offline app shell + audio caching.
 * Registered only in production builds (see src/components/pwa/SwRegister.tsx).
 */
const CACHE = "audiorepeat-v2";
const SHELL = [
  "/",
  "/player",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.png",
  // Small manifests — precached so the library can list languages/levels
  // offline and imported packs are known to exist.
  "/data/vocab/manifest.json",
  "/data/topics/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== "tts-audio") // keep pre-generated TTS blobs
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The app asks us to pre-cache specific URLs (e.g. a vocabulary bank or topic
// pack it just downloaded) so they play back offline immediately.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && url.protocol === "http:";
    } catch {
      return false;
    }
  });
  if (urls.length === 0) return;
  // Cache each URL independently so a single 404 can't drop the whole batch.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        urls.map((u) =>
          fetch(u).then((res) => {
            if (res.ok) cache.put(u, res);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pre-generated TTS audio → cache first (written by lib/audio/cache.ts)
  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Hashed build assets are immutable → cache first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Vocabulary word banks (JSON) → network first, cached for offline
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Navigations → network first, fall back to the cached shell when offline
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
  }
});
