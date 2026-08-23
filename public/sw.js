/* Evoq service worker — offline app shell + audio caching.
 * Registered only in production builds (see src/components/pwa/SwRegister.tsx).
 */
const CACHE = "audiorepeat-v4";
/* Runtime-cached navigations live in their own bounded cache so FIFO trimming
 * can never evict precached app-shell entries. Bumped to -v4 alongside the
 * navigation-strategy fix; activate() removes older versions. */
const NAV_CACHE = "audiorepeat-nav-v1";
const NAV_CACHE_MAX = 40;

/* Privileged and payment-sensitive surfaces must ALWAYS come from the live
 * server: admin pages/APIs, checkout pages, the checkout API and the payment
 * webhooks are never cached, never precached, and never served from the
 * offline navigation fallback. A network-only fetch failure here (e.g.
 * offline) must fail the request rather than reveal cached or shell content.
 */
function isNetworkOnly(url) {
  return (
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/") ||
    url.pathname === "/api/admin" ||
    url.pathname.startsWith("/api/admin/") ||
    // Payment/billing surfaces: /checkout and /checkout/* (incl. the success
    // page) plus the checkout API and both payment webhooks.
    url.pathname === "/checkout" ||
    url.pathname.startsWith("/checkout/") ||
    url.pathname === "/api/checkout" ||
    url.pathname === "/api/paddle/webhook" ||
    url.pathname === "/api/stripe/webhook"
  );
}

function isPrecacheUrlAllowed(value, origin) {
  try {
    const url = new URL(value, origin);
    return (
      url.origin === origin &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      !isNetworkOnly(url)
    );
  } catch {
    return false;
  }
}

const SHELL = [
  "/",
  "/dashboard",
  "/player",
  "/review",
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
            .filter(
              (k) =>
                k !== CACHE && k !== NAV_CACHE && k !== "tts-audio", // keep pre-generated TTS blobs
            )
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
  if (!data || typeof data !== "object") return;
  if (data.type === "PRECACHE" && Array.isArray(data.urls)) {
    const urls = data.urls.filter((u) => isPrecacheUrlAllowed(u, self.location.origin));
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
    return;
  }
  if (data.type === "SET_REMINDER") {
    event.waitUntil(scheduleReminder(data));
  } else if (data.type === "CLEAR_REMINDER") {
    event.waitUntil(clearReminder());
  }
});

/* ------------------------------------------------------------------ */
/* Daily practice reminder (Notification Triggers when available).     */
/* ------------------------------------------------------------------ */
let reminderTimeout = null;

async function scheduleReminder(data) {
  const timestamp = Number(data.timestamp);
  if (!Number.isFinite(timestamp)) return;
  const title = typeof data.title === "string" ? data.title : "Time to practice!";
  const body = typeof data.body === "string" ? data.body : "A quick AudioRepeat session is waiting.";
  const tag = typeof data.tag === "string" ? data.tag : "daily-reminder";

  // Clear any previously scheduled fallback timer.
  if (reminderTimeout !== null) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }

  const options = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };

  try {
    if ("showTrigger" in Notification.prototype) {
      // Notification Triggers: the OS owns the timing, survives SW restarts.
      options.showTrigger = new TimestampTrigger(timestamp);
      await self.registration.showNotification(title, options);
      return;
    }
  } catch (err) {
    // TimestampTrigger rejected (e.g. too far in the future) — fall back below.
    console.error("[SW] trigger failed", err);
  }

  // Fallback (Safari / non-Trigger browsers): best-effort setTimeout while the
  // SW process stays alive. The app re-arms the reminder on every launch.
  const delay = Math.max(0, timestamp - Date.now());
  reminderTimeout = setTimeout(() => {
    self.registration.showNotification(title, options).catch(() => {});
    reminderTimeout = null;
  }, delay);
}

async function clearReminder() {
  if (reminderTimeout !== null) {
    clearTimeout(reminderTimeout);
    reminderTimeout = null;
  }
  try {
    const notifs = await self.registration.getNotifications({ tag: "daily-reminder" });
    notifs.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}

// Tapping the reminder opens (or focuses) the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("navigate" in client) {
            return client.navigate("/review").then(() => client.focus());
          }
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow("/review");
      }),
  );
});

// Runtime navigation cache stays bounded: FIFO eviction of the oldest pages.
async function trimNavCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= NAV_CACHE_MAX) return;
  await Promise.all(
    keys.slice(0, keys.length - NAV_CACHE_MAX).map((stale) => cache.delete(stale)),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Privileged admin surfaces are ALWAYS network-only. This guard runs before
  // every caching branch below (including the offline navigation fallback), so
  // /admin/* pages and /api/admin/* responses can never be served from cache.
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

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

  // Navigations → network first (online freshness is never stale), while
  // successful same-origin page responses are runtime-cached so every route
  // the user has visited reopens offline. When offline, serve the exact
  // cached page for that URL first (precached shell or last-seen copy), then
  // the cached signed-in app (/dashboard), then the landing page — so an
  // offline launch opens the learning app, not marketing. Privileged
  // network-only surfaces never reach this branch: the guard above already
  // routed them straight to the network.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            event.waitUntil(
              caches.open(NAV_CACHE).then((cache) =>
                cache.put(request, copy).then(() => trimNavCache(cache)),
              ),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match("/dashboard").then(
                (dashboard) => dashboard || caches.match("/")
              )
          ),
        ),
    );
  }
});
