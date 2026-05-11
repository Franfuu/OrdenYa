// OrdenYa — Service Worker básico (offline shell + network-first para API)
const CACHE = 'ordenya-v1';
const SHELL = ['/', '/index.html', '/logo_ordenya_pro.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API y peticiones a otros orígenes: network-first sin cachear
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Estáticos: cache-first con fallback a red
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
