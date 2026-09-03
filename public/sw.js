// Minimal PWA service worker — installability + a bare offline fallback,
// deliberately not a full offline-data strategy. Network-first for
// everything: live data (Supabase reads/writes) must never be served
// stale, so only GET requests are touched at all, and only the app shell
// (this origin) is ever cached — Supabase API responses are explicitly
// excluded so a cache bug here can never surface stale patient data.
const CACHE_NAME = 'netra-hims-shell-v1';
const SHELL_URLS = ['/', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or any cross-origin call

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
