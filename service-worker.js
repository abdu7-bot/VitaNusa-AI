const CACHE_NAME = 'vitanusa-ai-pwa-v4';
const BASE_PATH = '/VitaNusa-AI';

const APP_SHELL = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/assets/css/nusa-app-shell.css?v=20260709-pwa-keyboard-hard-lock-v1`,
  `${BASE_PATH}/assets/css/vitanusa-public.css`,
  `${BASE_PATH}/assets/js/main.js?v=20260709-pwa-keyboard-hard-lock-v1`,
  `${BASE_PATH}/images/icon-192.png`,
  `${BASE_PATH}/images/icon-512.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => null)
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

function shouldBypassCache(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') return true;

  if (url.pathname.includes('/ask')) return true;

  if (url.hostname.includes('onrender.com')) return true;
  if (url.hostname.includes('railway.app')) return true;
  if (url.hostname === '127.0.0.1') return true;
  if (url.hostname === 'localhost') return true;

  if (url.hostname.includes('googleapis.com')) return true;
  if (url.hostname.includes('gstatic.com')) return true;
  if (url.hostname.includes('firebaseio.com')) return true;
  if (url.hostname.includes('firestore.googleapis.com')) return true;

  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (shouldBypassCache(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => null);
          });

          return response;
        })
        .catch(() => caches.match(`${BASE_PATH}/index.html`));
    })
  );
});
