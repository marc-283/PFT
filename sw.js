/* PFT offline cache. Any change gives a new cache name, so the app updates itself the next time it is online.
   Files are fetched past the browser cache, and versioned files (?v=…) are matched exactly, so old and new never mix. */
const CACHE = "pft-1.4.1-c861f1d9";
const FILES = ["./", "index.html", "style.css?v=a4de8257", "data.js?v=3ee7da90", "foods.js?v=e4966534", "views.js?v=9096a172", "app.js?v=89e14107", "manifest.webmanifest", "splash.jpg", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "fonts/barlow-latin-400-normal.woff2", "fonts/barlow-latin-500-normal.woff2", "fonts/barlow-latin-600-normal.woff2", "fonts/barlow-latin-700-normal.woff2", "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2", "fonts/barlow-condensed-latin-800-normal.woff2"];
const LAZY = ["zxing.min.js"]; /* loaded on first use (barcode scanner) and then kept offline */
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin) return;
  if (req.mode === "navigate") { e.respondWith(fetch(req).catch(() => caches.match("index.html"))); return; }
  const lazy = LAZY.some((f) => u.pathname.endsWith("/" + f));
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (lazy && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }))));
});
