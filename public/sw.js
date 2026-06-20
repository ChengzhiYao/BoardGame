const VERSION = 'mystnight-v1';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
// Empty fetch handler: required for installability, but lets the browser handle requests
// normally (no offline cache → always fresh after a new deploy).
self.addEventListener('fetch', () => {});
