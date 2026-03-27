// GS Executive Search — Service Worker
// Strategy: Network-first for ALL files. Cache is only a fallback for offline.
// No pre-caching of versioned assets — eliminates stale cache issues entirely.

const CACHE_NAME = 'gs-search-v19';

self.addEventListener('install', event => {
  // Skip waiting immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clear ALL old caches on activation
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip CDN/external requests — let the browser handle them normally
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for everything: try network, cache the response, fall back to cache
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then(response => {
        // Only cache valid responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache (offline fallback)
        return caches.match(request);
      })
  );
});

// Listen for manual refresh messages
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'REFRESH_DATA') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(key => {
          if (key.url.includes('data.js')) cache.delete(key);
        });
      });
    });
  }
});
