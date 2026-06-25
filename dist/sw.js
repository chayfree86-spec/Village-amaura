// sw.js - Service Worker for unregistering and clearing old caches

self.addEventListener('install', (e) => {
    // Force active immediately
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            // Delete all caches
            return Promise.all(keys.map(key => caches.delete(key)));
        }).then(() => {
            // Get all controlled window clients
            return self.clients.matchAll({ type: 'window' });
        }).then((clients) => {
            // Reload all window clients to load fresh content from the server
            for (let client of clients) {
                if (client.url) {
                    client.navigate(client.url).catch(err => console.error('Failed to navigate client:', err));
                }
            }
        }).then(() => {
            // Unregister this service worker
            return self.registration.unregister();
        }).then(() => {
            console.log('Service Worker successfully unregistered and caches cleared.');
        }).catch((err) => {
            console.error('Error during SW activation/unregistration:', err);
        })
    );
});

