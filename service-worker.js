const CACHE_NAME = 'gemini-translator-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install: cache core files only (not CDN resources - they change too often)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache v2');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Fetch: stale-while-revalidate for CDN resources, cache-first for local
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for API calls
  if (url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('api-free.deepl.com') ||
      url.hostname.includes('api.deepl.com') ||
      url.hostname.includes('libretranslate.com')) {
    return;
  }

  // Stale-while-revalidate for CDN resources
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Cache-first for local resources
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
