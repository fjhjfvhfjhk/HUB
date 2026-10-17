/* ============================================================================
   ЛЮКС-7 · SERVICE WORKER · v3
   
   СТРАТЕГИЯ:
     • HTML / JS / JSON → network-first (онлайн = всегда свежий файл)
     • CSS / картинки / шрифты → cache-first (меняются редко)
     • Оффлайн → отдаём кэш (в т.ч. версию без ?v= — для cache-busting
       ссылок из хаба, которые приходят с ?v=lm<timestamp>)
   
   ОБНОВЛЕНИЕ:
     Менять BUILD_VERSION не обязательно — network-first всегда подтягивает
     свежий файл. Bump только если хочешь принудительно сбросить кэш
     у всех клиентов одномоментно.
   ============================================================================ */

'use strict';

const BUILD_VERSION = '2026-10-17-3';
const CACHE_NAME = 'lux7-' + BUILD_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './ambient.css',
  './app.js',
  './ambient.js',
  './items.js',
  './roulette-fx.js',
  './games-fx.js',
  './extras.js',
  './plinko.js',
  './bosses-rework.js',
  './manifest.json',
  './icon.svg',
];

const STATIC_RE = /\.(css|svg|png|jpe?g|webp|ico|gif|woff2?|ttf|otf|eot)$/i;

/* -------------------- INSTALL -------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

/* -------------------- ACTIVATE -------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* -------------------- MESSAGE -------------------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' ||
      (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

/* -------------------- FETCH -------------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (STATIC_RE.test(url.pathname)) {
    /* ---------- CACHE-FIRST для статики ---------- */
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
            }
            return resp;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  /* ---------- NETWORK-FIRST для HTML / JS / JSON ---------- */
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Fallback: пробуем без query params (?v=..., ?_=...)
          try {
            const urlNoQuery = new URL(req.url);
            if (urlNoQuery.search) {
              urlNoQuery.search = '';
              return caches.match(urlNoQuery.toString()).then((c) => {
                if (c) return c;
                return new Response('', { status: 504, statusText: 'Offline' });
              });
            }
          } catch (e) {}
          return new Response('', { status: 504, statusText: 'Offline' });
        })
      )
  );
});
