// ── SERVICE WORKER — LPB Droit à l'image ──────────────────────────
const CACHE_NAME = 'lpb-v1';
const OFFLINE_URLS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On cache ce qu'on peut, on ignore les erreurs réseau
      return Promise.allSettled(OFFLINE_URLS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : Cache-first pour les ressources statiques, network-first pour Supabase
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase : toujours réseau (données dynamiques)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify([]), {
      headers: {'Content-Type': 'application/json'}
    })));
    return;
  }

  // Tout le reste : cache en priorité, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Mettre en cache les nouvelles ressources statiques
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback sur index.html pour la navigation
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
