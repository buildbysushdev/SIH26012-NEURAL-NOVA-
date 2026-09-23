/**
 * Service Worker — MPLADS Officer Verification Dashboard
 * SIH26102, Team Neural Nova
 */

const CACHE_NAME = 'mplads-officer-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ORIENTATION.md',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/field-capture.css',
  './js/api.js',
  './js/auth.js',
  './js/db.js',
  './js/views/worklist.js',
  './js/views/detail.js',
  './js/views/field-capture.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let API requests go to network or handled by IndexedDB fallback in client
  if (event.request.url.includes(':8000') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((networkRes) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkRes.clone());
          return networkRes;
        });
      });
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});
