const CACHE_VERSION = "cash-calendar-v2";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_ROUTES = ["/", "/add", "/calendar", "/settings"];
const CORE_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

async function precacheAppShell() {
  const pageCache = await caches.open(PAGE_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);
  const discoveredAssets = new Set(CORE_ASSETS);

  await Promise.allSettled(
    OFFLINE_ROUTES.map(async (route) => {
      const response = await fetch(route, { cache: "no-cache" });
      if (!response.ok) return;
      await pageCache.put(route, response.clone());

      const html = await response.text();
      for (const match of html.matchAll(/\/_next\/static\/[^"'\\s<]+/g)) {
        discoveredAssets.add(match[0]);
      }
    })
  );

  await Promise.allSettled(
    [...discoveredAssets].map(async (url) => {
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) await assetCache.put(url, response);
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("cash-calendar-") && ![PAGE_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("/"));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    ["style", "script", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
