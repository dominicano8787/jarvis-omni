// J.A.R.V.I.S. service worker — caches the app shell so the HUD opens offline.
// Cache version: bump CACHE_NAME whenever index.html or an asset filename changes.
const CACHE_NAME = 'jarvis-shell-v1';
const SHELL = [
  './',
  './index.html',
  './assets/index-CRhZ5DKE.js',
  './assets/index-BU5osPZe.css',
  './manifest.json',
  './config.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Navigation requests: network first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Same-origin app files: cache first, fall back to network.
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req))
    );
  }
});
