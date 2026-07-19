const CACHE_PREFIX = 'vitanusa-ai-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v16-nusabelajar-phase2-exit`;
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname.replace(/\/$/, '');
const ADMIN_PATH = `${BASE_PATH}/admin`;
const BUILD_ASSETS = [];

function scopedUrl(path = '') {
  return new URL(path, self.registration.scope).href;
}

function scopedPath(path = '') {
  return new URL(path, self.registration.scope).pathname;
}

const SHARE_TARGET_PATH = scopedPath('share-target.html');
const OFFLINE_URL = scopedUrl('offline.html');
const LEARNING_STATIC_PATHS = Object.freeze([
  'content/mandiri/learning/catalog.json',
  'content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
  'content/mandiri/learning/packages/money-basics-id-v1/content.json',
]);
const LEARNING_STATIC_URLS = new Set(LEARNING_STATIC_PATHS.map((path) => scopedUrl(path)));
const NETWORK_FIRST_PUBLIC_PATHS = new Set([
  scopedPath('account.html'),
  scopedPath('settings.html'),
  scopedPath('vitacheck.html'),
  scopedPath('share-target.html'),
  scopedPath('offline.html'),
  scopedPath('assets/js/main.js'),
  scopedPath('assets/js/modules/pwa-install.js'),
  scopedPath('assets/js/modules/nusa-agent.js'),
  scopedPath('assets/js/modules/share-target.js'),
  scopedPath('assets/js/modules/user-auth.js'),
  scopedPath('assets/js/modules/vitacheck-history.js'),
  scopedPath('assets/js/modules/vitacheck.js'),
]);

// Shell statis saja. Data akun, chat, VitaCheck, dan parameter Share Target
// tidak pernah dimasukkan ke Cache API.
const APP_SHELL = [
  scopedUrl('./'),
  scopedUrl('index.html'),
  scopedUrl('offline.html'),
  scopedUrl('share-target.html'),
  scopedUrl('vitacheck.html'),
  scopedUrl('manifest.webmanifest'),
  scopedUrl('mandiri/belajar/index.html'),
  scopedUrl('mandiri/belajar/lesson.html'),
  scopedUrl('assets/css/nusa-app-shell.css'),
  scopedUrl('assets/css/vitanusa-public.css'),
  scopedUrl('assets/css/android-pwa.css'),
  scopedUrl('assets/css/nusa-agent.css'),
  scopedUrl('assets/css/nusabelajar.css'),
  scopedUrl('assets/js/main.js'),
  scopedUrl('assets/js/modules/nusa-ui-shell.js'),
  scopedUrl('assets/js/modules/nusa-agent.js'),
  scopedUrl('assets/js/modules/nusa-chat.js'),
  scopedUrl('assets/js/modules/nusa-knowledge.js'),
  scopedUrl('assets/js/modules/chat-viewport.js'),
  scopedUrl('assets/js/modules/pwa-install.js'),
  scopedUrl('assets/js/modules/share-target.js'),
  scopedUrl('404.html'),
  scopedUrl('images/icon-192.png'),
  scopedUrl('images/icon-512.png'),
  ...LEARNING_STATIC_PATHS.map((path) => scopedUrl(path)),
  ...BUILD_ASSETS.map((path) => scopedUrl(path)),
];

const STATIC_DESTINATIONS = new Set([
  'style',
  'script',
  'image',
  'font',
  'manifest',
]);
const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/i;
const API_PATH_PATTERN = /\/(?:ask|health|feedback)\/?$/i;
const EXTERNAL_DATA_HOSTS = [
  'googleapis.com',
  'gstatic.com',
  'firebaseio.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

function isWithinScope(url) {
  if (url.origin !== self.location.origin) return false;
  if (!BASE_PATH) return url.pathname.startsWith('/');
  return url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`);
}

function isHtmlRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';
  return (
    request.mode === 'navigate'
    || request.destination === 'document'
    || accept.includes('text/html')
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/')
  );
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_DESTINATIONS.has(request.destination)
    || STATIC_FILE_PATTERN.test(url.pathname);
}

function isAdminRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin
    && (url.pathname === ADMIN_PATH || url.pathname.startsWith(`${ADMIN_PATH}/`));
}

function isNetworkFirstPublicRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET'
    && url.origin === self.location.origin
    && NETWORK_FIRST_PUBLIC_PATHS.has(url.pathname);
}

function isShareTargetRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname === SHARE_TARGET_PATH;
}

function isLearningStaticRequest(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return request.method === 'GET' && LEARNING_STATIC_URLS.has(url.href);
}

function isExternalDataHost(hostname) {
  const lower = hostname.toLowerCase();
  return EXTERNAL_DATA_HOSTS.some((host) => lower === host || lower.endsWith(`.${host}`));
}

function shouldBypassCache(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') return true;
  if (API_PATH_PATTERN.test(url.pathname)) return true;
  if (isExternalDataHost(url.hostname)) return true;
  if (!isWithinScope(url)) return true;
  return false;
}

function canCache(response) {
  const cacheControl = response?.headers?.get('cache-control') || '';
  return Boolean(
    response
    && response.ok
    && response.type !== 'opaque'
    && !cacheControl.toLowerCase().includes('no-store')
  );
}

function getNavigationCacheKey(request) {
  const url = new URL(request.url);
  if (url.pathname === SHARE_TARGET_PATH && url.search) return null;
  url.search = '';
  url.hash = '';
  return url.href;
}

async function getOfflineResponse(cache) {
  const offline = await cache.match(OFFLINE_URL, { ignoreSearch: true });
  if (offline) return offline;
  return new Response('VitaNusa sedang offline. Silakan coba lagi.', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function networkFirst(request, {
  allowOfflineFallback = true,
  cacheKey = request,
  fallbackKey = null,
} = {}) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (cacheKey && canCache(fresh)) {
      await cache.put(cacheKey, fresh.clone()).catch(() => null);
    }
    return fresh;
  } catch {
    const cached = cacheKey
      ? await cache.match(cacheKey, { ignoreSearch: true })
      : null;
    if (cached) return cached;

    if (fallbackKey) {
      const fallback = await cache.match(fallbackKey, { ignoreSearch: true });
      if (fallback) return fallback;
    }

    if (allowOfflineFallback) return getOfflineResponse(cache);
    return Response.error();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return new Response('Halaman admin memerlukan koneksi jaringan. Silakan coba lagi saat online.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
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

async function cacheFirstLearningStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  const cacheKey = url.href;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (canCache(response)) await cache.put(cacheKey, response.clone()).catch(() => null);
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (isAdminRequest(request)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (shouldBypassCache(request)) return;

  if (isShareTargetRequest(request)) {
    const shareTargetShell = scopedUrl('share-target.html');
    // Parameter GET tetap berada di address bar agar halaman dapat membentuk
    // draft, tetapi shell diambil tanpa query supaya teks pengguna tidak
    // diteruskan ke origin atau dijadikan cache key.
    event.respondWith(networkFirst(shareTargetShell, {
      cacheKey: shareTargetShell,
      fallbackKey: shareTargetShell,
      allowOfflineFallback: true,
    }));
    return;
  }

  if (isLearningStaticRequest(request)) {
    event.respondWith(cacheFirstLearningStatic(request));
    return;
  }

  if (isNetworkFirstPublicRequest(request)) {
    event.respondWith(networkFirst(request, {
      allowOfflineFallback: isHtmlRequest(request),
      cacheKey: isHtmlRequest(request) ? getNavigationCacheKey(request) : request,
    }));
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request, {
      cacheKey: getNavigationCacheKey(request),
    }));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
