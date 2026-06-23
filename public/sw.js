// sw.js - Service Worker for offline PWA support

// __BUILD_ID__ build ke samay (copy-api.js dwara) unique timestamp se replace hota hai.
// Isse har deploy par CACHE_NAME badalta hai -> activate event purana cache delete kar deta hai.
const CACHE_NAME = 'prajapati-ekta-__BUILD_ID__';
const ASSETS = [
    './',
    './index.html',
    './assets/index.css',
    './assets/index.js',
    './manifest.json',
    './logo.png',
    './pwa-icon.png'
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

// Fetch assets: Fonts, images, icons, and scripts are cached. API data is always live.
self.addEventListener('fetch', (e) => {
    // Only handle GET requests
    if (e.request.method !== 'GET') return;
    
    const url = new URL(e.request.url);
    
    // 1. API Data calls MUST be live (Network Only)
    if (url.pathname.includes('api.php') || url.searchParams.has('action')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // 2. For static assets (fonts, images, icons, local CSS/JS), use Stale-While-Revalidate
    const isStaticAsset = 
        ASSETS.includes(url.pathname) ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.pathname.match(/\.(html|css|js|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf)$/);

    if (isStaticAsset) {
        e.respondWith(
            caches.match(e.request).then((cachedResponse) => {
                const fetchPromise = fetch(e.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(e.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback to cached response if network fails
                    return cachedResponse;
                });
                
                // Return cached response instantly if available, otherwise wait for network
                return cachedResponse || fetchPromise;
            })
        );
    } else {
        // Default Network First for other requests
        e.respondWith(
            fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(e.request);
            })
        );
    }
});
