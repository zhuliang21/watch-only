// Basic service worker for Bitcoin Watch-Only Wallet PWA
// Bump cache name to invalidate old bundles
const CACHE_NAME = 'btc-wallet-cache-v6';
const OFFLINE_URLS = [
  '/index.html',
  '/manifest.json',
  '/dist/generate.bundle.js',
  '/dist/check.bundle.js',
  '/dist/history.bundle.js',
  '/dist/gate.bundle.js',
  '/dist/update.bundle.js',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll but catch individual failures
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.error('Cache addAll failed:', err);
        // Try adding individually to see which ones succeed
        return Promise.all(
          OFFLINE_URLS.map((url) => {
            return cache.add(url).catch((e) => {
              console.warn('Failed to cache:', url, e);
              return null;
            });
          })
        );
      });
    })
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
  const url = new URL(event.request.url);
  
  // For bundle.js files, use network-first strategy to ensure fresh code
  if (url.pathname.includes('.bundle.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  } else {
    // For other resources, use cache-first
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
}); 