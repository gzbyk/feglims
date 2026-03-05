const CACHE = 'feglims-v3.4';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/firebase.js',
  '/inventory.js', '/chemicals.js', '/eln.js', '/orders.js', '/calendar.js',
  '/analytics.js', '/admin.js', '/labwork.js', '/protocols.js', '/search.js',
  '/reporting.js', '/flybase.js', '/crossplanner.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('firestore') || e.request.url.includes('netlify/functions')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    })).catch(() => caches.match('/index.html'))
  );
});
