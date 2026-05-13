// OrdenYa — Service Worker
// Estrategia:
//  - HTML / navegaciones → network-first (siempre fresco, así nuevos deploys se cargan)
//  - Assets hasheados (/assets/*) → cache-first (inmutables)
//  - API → red directa
const CACHE = 'ordenya-v3';
const SHELL = ['/logo_ordenya_pro.svg', '/manifest.webmanifest'];

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

  // Cross-origin o API: red directa
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Navegación (HTML): network-first → siempre versión fresca
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Assets hasheados: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        return res;
      });
    })
  );
});
