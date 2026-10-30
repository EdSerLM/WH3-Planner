// Service worker de la web estática: guarda lo que se descarga para usar la app sin conexión.
// Datos e imágenes: primero lo guardado (se refresca en segundo plano). Página y código: primero la red.
const CACHE = 'wh3-planner-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// La primera visita se carga antes de que el service worker controle la página: la app le manda la lista
// de lo que ya descargó (página, código, datos) para guardarlo y poder abrirla sin conexión
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname) || /\.(js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/data/version.txt');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isPage) {
      try {
        const r = await fetch(req);
        if (r.ok) cache.put(req, r.clone());
        return r;
      } catch {
        return (await cache.match(req)) ?? Response.error();
      }
    }
    const hit = await cache.match(req);
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    return hit ?? (await net) ?? Response.error();
  })());
});
