const CACHE_PREFIX = 'vitanusa-ai-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v10-html-network-first`;
const BASE_PATH = '/VitaNusa-AI';

// Preload hanya shell penting. Halaman publik lain disimpan saat benar-benar dibuka.
const APP_SHELL = [
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/assets/css/nusa-app-shell.css?v=20260709-pwa-chat-balance-v3`,
  `${BASE_PATH}/assets/css/vitanusa-public.css?v=20260703-public-design-v1`,
  `${BASE_PATH}/assets/js/main.js?v=20260709-pwa-chat-refine-v1`,
  `${BASE_PATH}/404.html`,
  `${BASE_PATH}/images/icon-192.png`,
  `${BASE_PATH}/images/icon-512.png`
];

const STATIC_DESTINATIONS = new Set([
  'style',
  'script',
  'image',
  'font',
  'manifest'
]);

const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/i;
const API_PATH_PATTERN = /\/(?:ask|health)\/?$/i;
const EXTERNAL_DATA_HOSTS = [
  'googleapis.com',
  'gstatic.com',
  'firebaseio.com',
  'firestore.googleapis.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => null))
      );
    } finally {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

function isHtmlRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';

  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    accept.includes('text/html') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  );
}

function isStaticAsset(request) {
  const url = new URL(request.url);

  return (
    STATIC_DESTINATIONS.has(request.destination) ||
    STATIC_FILE_PATTERN.test(url.pathname)
  );
}

function shouldBypassCache(request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (request.method !== 'GET') return true;
  if (API_PATH_PATTERN.test(url.pathname)) return true;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  ) {
    return true;
  }

  if (hostname.endsWith('onrender.com')) return true;
  if (hostname.endsWith('railway.app')) return true;

  if (EXTERNAL_DATA_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return true;
  }

  // Cache hanya resource same-origin milik root atau scope /VitaNusa-AI.
  if (url.origin !== self.location.origin) return true;

  return !(
    url.pathname === '/' ||
    url.pathname === BASE_PATH ||
    url.pathname.startsWith(`${BASE_PATH}/`)
  );
}

function canCache(response) {
  return Boolean(
    response &&
    response.ok &&
    response.type !== 'opaque'
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request, { cache: 'no-store' });

    if (canCache(fresh)) {
      await cache.put(request, fresh.clone()).catch(() => null);
    }

    return fresh;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const fallback = await cache.match(`${BASE_PATH}/index.html`, {
      ignoreSearch: true
    });
    if (fallback) return fallback;

    return new Response('VitaNusa AI sedang offline. Silakan coba lagi.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkUpdate = fetch(request).then(async (response) => {
    if (canCache(response)) {
      await cache.put(request, response.clone()).catch(() => null);
    }

    return response;
  });

  if (cached) {
    event.waitUntil(networkUpdate.catch(() => null));
    return cached;
  }

  return networkUpdate.catch(() => Response.error());
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (shouldBypassCache(request)) {
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
