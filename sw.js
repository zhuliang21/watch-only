// Basic service worker for Bitcoin Watch-Only Wallet PWA
const CACHE_NAME = 'btc-wallet-cache-v1';
const OFFLINE_URLS = [
  '/',
  '/test.html',
  '/manifest.json',
  '/dist/generate.bundle.js',
  '/dist/check.bundle.js',
  '/dist/history.bundle.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
}); 