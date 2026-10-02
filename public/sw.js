// SocialSpace service worker.
// - Pages (navigations) are network-first, so a new deploy shows up on the next visit; the cached copy is only an offline fallback.
// - Hashed build files under /_next/static/ never change, so they are cache-first.
// - Everything else (the WebSocket relay, API-like requests, other origins) is left alone.
// Bump CACHE when this file's behaviour changes; old caches are deleted on activate.
const CACHE = "socialspace-v2"
const PRECACHE = ["/icon-192x192.png", "/icon-512x512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put("/", copy))
          }
          return res
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
