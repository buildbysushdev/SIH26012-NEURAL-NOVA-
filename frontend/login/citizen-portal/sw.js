/**
 * sw.js — Service Worker for MPLAD Citizen Portal
 * SIH26102, Team Neural Nova
 *
 * Caching Strategy:
 *  - Static Assets (HTML, CSS, JS, manifest, icons): Cache-first with background update
 *  - API Requests (/search-projects, /flagged-projects, /citizen-reports): Network-first with cache fallback
 *  - Report Submissions (/citizen-report): Handled via IndexedDB queue and background sync
 */

const CACHE_VERSION = 'mplad-v9';
const API_CACHE     = 'mplad-api-v1';
const DB_NAME       = 'mplad-citizen-portal';
const STORE         = 'pending-reports';

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './manifest.json',
  './assets/emblem_cleaned.png',
  './assets/india_flag.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache minimal app shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches to prevent bloat ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non-GET requests (e.g. POST report) pass through directly
  if (event.request.method !== 'GET') return;
  if (url.pathname === '/citizen-report') return;

  // 1. API Requests: Network-first, fallback to cached data if offline
  if (
    url.pathname.includes('/search-projects') ||
    url.pathname.includes('/flagged-projects') ||
    url.pathname.includes('/citizen-reports')
  ) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE));
    return;
  }

  // 2. Static files (App shell): Cache-first (instant response, background revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.origin === self.location.origin ||
              url.hostname === 'fonts.googleapis.com' ||
              url.hostname === 'fonts.gstatic.com' ||
              url.hostname === 'unpkg.com')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise || caches.match('./index.html');
    })
  );
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    return new Response(JSON.stringify({ results: [], total: 0, offline: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Background Sync: retry queued reports ─────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(flushQueuedReports());
  }
});

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function flushQueuedReports() {
  try {
    const db = await openDb();
    const records = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });

    let flushedCount = 0;
    for (const record of records) {
      try {
        const fd = buildFormData(record);
        const response = await fetch('http://localhost:8000/citizen-report', {
          method: 'POST',
          body: fd,
        });
        if (response.ok) {
          await new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).delete(record.localId);
            req.onsuccess = resolve;
            req.onerror   = reject;
          });
          flushedCount++;
        }
      } catch (err) {
        console.warn('[SW] Could not flush report', record.localId, err);
      }
    }

    if (flushedCount > 0) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) =>
        c.postMessage({ type: 'REPORTS_SYNCED', count: flushedCount })
      );
    }
  } catch (err) {
    console.warn('[SW] flushQueuedReports error', err);
  }
}

/** Reconstruct FormData from stored plain-object record */
function buildFormData(record) {
  const fd = new FormData();
  fd.append('work_id',            record.work_id);
  fd.append('description',        record.description);
  fd.append('category',           record.category || '');
  if (record.captured_lat != null) fd.append('captured_lat',       String(record.captured_lat));
  if (record.captured_lng != null) fd.append('captured_lng',       String(record.captured_lng));
  if (record.captured_timestamp)   fd.append('captured_timestamp', record.captured_timestamp);
  if (record.photoBuffer) {
    const blob = new Blob([record.photoBuffer], { type: record.photoType || 'image/jpeg' });
    fd.append('photo', blob, record.photoName || 'photo.jpg');
  }
  return fd;
}
