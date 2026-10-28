// ── SERVICE WORKER — LPB Droit à l'image ──────────────────────────
const CACHE_NAME = 'lpb-v2';
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
      return Promise.allSettled(OFFLINE_URLS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciens caches (dont lpb-v1)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase : toujours réseau, sans interception.
  // Auparavant, une coupure réseau renvoyait une fausse réponse vide « réussie » :
  // un enregistrement pouvait alors être perdu sans message d'erreur.
  // Désormais l'application voit l'échec et garde la saisie sur la tablette.
  if (url.hostname.includes('supabase.co')) return;

  // Page / index.html : RÉSEAU D'ABORD (pour toujours avoir la dernière version),
  // repli sur le cache uniquement si hors ligne.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Reste (librairies React/Supabase, polices — URLs figées) : cache d'abord
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
