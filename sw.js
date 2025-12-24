// Basic service worker for Bitcoin Watch-Only Wallet PWA
// Bump cache name to invalidate old bundles
const CACHE_NAME = 'btc-wallet-cache-v4';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Bundle paths match the script tags in index.html (served from /dist)
  '/dist/generate.bundle.js',
  '/dist/check.bundle.js',
  '/dist/history.bundle.js',
  '/dist/gate.bundle.js',
  '/dist/update.bundle.js',
  // Keep legacy paths for users with older HTML
  '/generate.bundle.js',
  '/check.bundle.js',
  '/history.bundle.js',
  '/gate.bundle.js',
  '/update.bundle.js',
  // WASM if present
  '/dist/28fa7cbe306896ab29dd.module.wasm',
  // Icons for PWA install/offline shell
  '/favicon.ico',
  '/icon/icon-192.png',
  '/icon/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  // 强制新的Service Worker立即激活
  self.skipWaiting();
});

// 清理旧缓存
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
    }).then(() => {
      // 强制所有客户端使用新的Service Worker
      return self.clients.claim();
    })
  );
});

// 监听来自客户端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
}); 