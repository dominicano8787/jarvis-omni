/**
 * J.A.R.V.I.S. v4.3.0 — Offline-First PWA Service Worker
 * ======================================================
 * Caches the entire application shell (HTML, JS, CSS, config.json, manifest.json, icons)
 * so J.A.R.V.I.S. opens and operates with zero internet connection on PC and Android.
 */

const CACHE_NAME = 'jarvis-omni-cache-v4.3.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './config.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of APP_SHELL) {
        try {
          await cache.add(asset);
        } catch (e) {
          // Ignore optional missing assets during install
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NAME) {
              return caches.delete(k);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Let API requests be handled by the app's cloud -> localAgent -> offlineMode fetch router
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Handle Google Fonts gracefully when offline (return empty CSS instead of failing)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            return res;
          })
          .catch(() => new Response('/* offline font fallback */', { headers: { 'Content-Type': 'text/css' } }));
      })
    );
    return;
  }

  // App shell & static bundle assets: Stale-While-Revalidate with guaranteed offline fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            const shell = await caches.match('./index.html');
            if (shell) return shell;
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });

      return cached || networkFetch;
    })
  );
});

