// sw.js - Service Worker for offline PWA support

const CACHE_NAME = 'prajapati-ekta-v10';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './logo.png'
];

// Install Service Worker and cache resources
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Force active immediately
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of all pages immediately
        })
    );
});

// Fetch assets using Network First strategy (always fetch fresh if online, fallback to cache)
self.addEventListener('fetch', (e) => {
    // Only cache GET requests
    if (e.request.method !== 'GET') return;
    
    // Bypass for API calls (so they always query the network)
    if (e.request.url.includes('api.php')) {
        return;
    }

    e.respondWith(
        fetch(e.request).then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return networkResponse;
            }
            
            // Clone response and update cache
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, responseToCache);
            });
            
            return networkResponse;
        }).catch(() => {
            // Offline fallback to cache
            return caches.match(e.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                // If it's a page navigation request, return index.html fallback
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
