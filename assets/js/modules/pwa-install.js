const INSTALL_DISMISS_KEY = 'VITANUSA_PWA_INSTALL_DISMISSED_AT';
const INSTALL_DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const INSTALL_CONTROLLERS = new WeakMap();

export function getVitaNusaBaseUrl(moduleUrl = import.meta.url) {
  const url = new URL(moduleUrl);
  const markers = ['/assets/js/modules/', '/assets/js/', '/assets/'];

  for (const marker of markers) {
    const markerIndex = url.pathname.lastIndexOf(marker);
    if (markerIndex === -1) continue;
    url.pathname = url.pathname.slice(0, markerIndex + 1);
    url.search = '';
    url.hash = '';
    return url;
  }

  return new URL('./', url);
}

export function detectStandalone({
  displayModeStandalone = false,
  navigatorStandalone = false,
} = {}) {
  return Boolean(displayModeStandalone || navigatorStandalone);
}

export function isInstallDismissalActive(
  storage,
  now = Date.now(),
  ttlMs = INSTALL_DISMISS_TTL_MS,
) {
  try {
    const dismissedAt = Number(storage?.getItem(INSTALL_DISMISS_KEY));
    return Number.isFinite(dismissedAt)
      && dismissedAt > 0
      && now - dismissedAt < ttlMs;
  } catch {
    return false;
  }
}

function rememberInstallDismissal(storage, now) {
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, String(now));
  } catch {
    // localStorage dapat dibatasi pada mode privasi.
  }
}

function clearInstallDismissal(storage) {
  try {
    storage?.removeItem(INSTALL_DISMISS_KEY);
  } catch {
    // localStorage dapat dibatasi pada mode privasi.
  }
}

export function createInstallPromptSession({
  standalone = false,
  storage = null,
  now = () => Date.now(),
} = {}) {
  let deferredPrompt = null;
  let installed = Boolean(standalone);
  let promptInProgress = false;

  return {
    capture(event) {
      if (installed || !event || typeof event.prompt !== 'function') return false;
      event.preventDefault?.();
      deferredPrompt = event;
      return true;
    },

    getState() {
      return {
        installed,
        available: Boolean(deferredPrompt),
        promptInProgress,
        dismissedRecently: isInstallDismissalActive(storage, now()),
      };
    },

    async requestInstall() {
      if (installed) return { status: 'installed' };
      if (!deferredPrompt || promptInProgress) return { status: 'unavailable' };

      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptInProgress = true;

      try {
        await promptEvent.prompt();
        const choice = await Promise.resolve(promptEvent.userChoice).catch(() => null);
        const outcome = choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';

        if (outcome === 'dismissed') {
          rememberInstallDismissal(storage, now());
        }

        return { status: outcome };
      } catch {
        return { status: 'unavailable' };
      } finally {
        promptInProgress = false;
      }
    },

    markInstalled() {
      installed = true;
      deferredPrompt = null;
      promptInProgress = false;
      clearInstallDismissal(storage);
    },
  };
}

export function hasUnsavedPwaInteraction(documentRef) {
  if (!documentRef?.querySelectorAll) return false;

  const chatInputs = documentRef.querySelectorAll('[data-nusa-chat-input]');
  for (const input of chatInputs) {
    if (String(input.value || '').trim()) return true;
  }

  const vitaCheckForm = documentRef.querySelector('[data-vitacheck-form]');
  if (vitaCheckForm) {
    if (vitaCheckForm.querySelector('input:checked')) return true;
    for (const field of vitaCheckForm.querySelectorAll('textarea, input[type="text"], input[type="email"], select')) {
      if (String(field.value || '').trim()) return true;
    }
  }

  if (documentRef.querySelector('[data-update-guard="dirty"], [data-update-guard="busy"]')) {
    return true;
  }

  return false;
}

function setText(nodes, value) {
  nodes.forEach((node) => {
    node.textContent = value;
  });
}

function setInstallButtonsState(buttons, state) {
  buttons.forEach((button) => {
    const isPrimary = button.dataset.pwaInstallContext === 'primary';

    if (state.installed) {
      button.hidden = true;
      button.disabled = true;
      return;
    }

    if (isPrimary && (!state.available || state.dismissedRecently)) {
      button.hidden = true;
      button.disabled = true;
      return;
    }

    button.hidden = false;
    button.disabled = !state.available || state.promptInProgress;
    button.textContent = state.promptInProgress ? 'Membuka pemasangan…' : 'Pasang VitaNusa';
  });
}

function createUpdateNotice(documentRef) {
  const notice = documentRef.createElement('aside');
  notice.className = 'vn-pwa-update-notice';
  notice.hidden = true;
  notice.setAttribute('data-pwa-update-notice', '');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const copy = documentRef.createElement('div');
  const title = documentRef.createElement('strong');
  title.textContent = 'Pembaruan VitaNusa tersedia.';
  const message = documentRef.createElement('span');
  message.textContent = 'Perbarui saat tidak sedang mengisi formulir atau mengetik chat.';
  message.setAttribute('data-pwa-update-message', '');
  copy.append(title, message);

  const actions = documentRef.createElement('div');
  actions.className = 'vn-pwa-update-actions';

  const updateButton = documentRef.createElement('button');
  updateButton.type = 'button';
  updateButton.className = 'btn primary';
  updateButton.textContent = 'Perbarui sekarang';
  updateButton.setAttribute('data-pwa-update-now', '');

  const laterButton = documentRef.createElement('button');
  laterButton.type = 'button';
  laterButton.className = 'btn outline';
  laterButton.textContent = 'Nanti';
  laterButton.setAttribute('data-pwa-update-later', '');

  actions.append(updateButton, laterButton);
  notice.append(copy, actions);
  documentRef.body.append(notice);

  return { notice, message, updateButton, laterButton };
}

function initPwaUpdateFlow(documentRef, windowRef, navigatorRef) {
  if (!navigatorRef?.serviceWorker || documentRef.querySelector('[data-pwa-update-notice]')) {
    return null;
  }

  const ui = createUpdateNotice(documentRef);
  let waitingRegistration = null;
  let updateRequested = false;
  let reloadStarted = false;

  const showWaiting = (registration) => {
    if (!registration?.waiting) return;
    waitingRegistration = registration;
    ui.message.textContent = 'Perbarui saat tidak sedang mengisi VitaCheck, mengetik chat, atau mengedit data.';
    ui.updateButton.disabled = false;
    ui.notice.hidden = false;
  };

  const handleWaiting = (event) => showWaiting(event.detail?.registration);
  windowRef.addEventListener('vitanusa-sw-waiting', handleWaiting);

  ui.updateButton.addEventListener('click', () => {
    if (!waitingRegistration?.waiting) return;

    if (hasUnsavedPwaInteraction(documentRef)) {
      ui.message.textContent = 'Selesaikan atau simpan isian yang sedang aktif, lalu tekan Perbarui sekarang lagi.';
      return;
    }

    updateRequested = true;
    ui.updateButton.disabled = true;
    ui.message.textContent = 'Menyiapkan pembaruan…';
    waitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  });

  ui.laterButton.addEventListener('click', () => {
    ui.notice.hidden = true;
  });

  navigatorRef.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested || reloadStarted) return;
    reloadStarted = true;
    windowRef.location.reload();
  });

  return { showWaiting };
}

export function ensurePwaMetadata(
  documentRef = document,
  baseUrl = getVitaNusaBaseUrl(),
) {
  if (!documentRef?.head) return;

  let manifest = documentRef.querySelector('link[rel="manifest"]');
  if (!manifest) {
    manifest = documentRef.createElement('link');
    manifest.rel = 'manifest';
    documentRef.head.append(manifest);
  }
  manifest.href = new URL('manifest.webmanifest', baseUrl).href;

  let touchIcon = documentRef.querySelector('link[rel="apple-touch-icon"]');
  if (!touchIcon) {
    touchIcon = documentRef.createElement('link');
    touchIcon.rel = 'apple-touch-icon';
    documentRef.head.append(touchIcon);
  }
  touchIcon.href = new URL('images/icon-192.png', baseUrl).href;

  const viewport = documentRef.querySelector('meta[name="viewport"]');
  if (viewport && !/\bviewport-fit\s*=\s*cover\b/i.test(viewport.content)) {
    viewport.content = `${viewport.content || 'width=device-width,initial-scale=1'},viewport-fit=cover`;
  }

  let capable = documentRef.querySelector('meta[name="mobile-web-app-capable"]');
  if (!capable) {
    capable = documentRef.createElement('meta');
    capable.name = 'mobile-web-app-capable';
    documentRef.head.append(capable);
  }
  capable.content = 'yes';
}

function dispatchWaitingWorker(windowRef, registration) {
  if (!registration?.waiting) return;
  windowRef.dispatchEvent(new windowRef.CustomEvent('vitanusa-sw-waiting', {
    detail: { registration },
  }));
}

function observeServiceWorkerRegistration(windowRef, registration) {
  dispatchWaitingWorker(windowRef, registration);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && registration.waiting) {
        dispatchWaitingWorker(windowRef, registration);
      }
    });
  });
}

export function registerVitaNusaServiceWorker({
  windowRef = window,
  navigatorRef = navigator,
  baseUrl = getVitaNusaBaseUrl(),
} = {}) {
  if (!navigatorRef?.serviceWorker) return Promise.resolve(null);
  if (windowRef.__vitanusaServiceWorkerRegistration) {
    return windowRef.__vitanusaServiceWorkerRegistration;
  }

  const startRegistration = async () => {
    const workerUrl = new URL('service-worker.js', baseUrl);
    const registration = await navigatorRef.serviceWorker.register(workerUrl.href, {
      scope: baseUrl.pathname,
    });
    observeServiceWorkerRegistration(windowRef, registration);
    return registration;
  };

  windowRef.__vitanusaServiceWorkerRegistration = new Promise((resolve) => {
    if (windowRef.document?.readyState === 'complete') {
      resolve(startRegistration());
      return;
    }

    windowRef.addEventListener('load', () => resolve(startRegistration()), { once: true });
  }).then((registration) => registration).catch((error) => {
    console.warn('Service worker VitaNusa gagal aktif:', error?.message || 'registration-failed');
    return null;
  });

  return windowRef.__vitanusaServiceWorkerRegistration;
}

export function initPwaInstall(
  documentRef = document,
  {
    windowRef = documentRef.defaultView || window,
    navigatorRef = windowRef.navigator,
  } = {},
) {
  if (INSTALL_CONTROLLERS.has(documentRef)) return INSTALL_CONTROLLERS.get(documentRef);

  const displayMode = windowRef.matchMedia?.('(display-mode: standalone)');
  let storage = null;
  try {
    storage = windowRef.localStorage;
  } catch {
    // localStorage dapat dibatasi pada mode privasi.
  }
  const session = createInstallPromptSession({
    standalone: detectStandalone({
      displayModeStandalone: Boolean(displayMode?.matches),
      navigatorStandalone: Boolean(navigatorRef?.standalone),
    }),
    storage,
  });

  const buttons = [...documentRef.querySelectorAll('[data-pwa-install]')];
  const statuses = [...documentRef.querySelectorAll('[data-pwa-install-status]')];

  const render = (message = '') => {
    const state = session.getState();
    setInstallButtonsState(buttons, state);

    if (message) {
      setText(statuses, message);
    } else if (state.installed) {
      setText(statuses, 'VitaNusa sedang dibuka dalam mode aplikasi.');
    } else if (state.available) {
      setText(statuses, 'Pemasangan tersedia. VitaNusa hanya akan meminta konfirmasi setelah tombol ditekan.');
    } else {
      setText(statuses, 'Jika tombol belum tersedia, gunakan menu Chrome lalu pilih Pasang aplikasi atau Tambahkan ke layar utama.');
    }
  };

  const handleBeforeInstall = (event) => {
    if (session.capture(event)) render();
  };

  const handleInstalled = () => {
    session.markInstalled();
    render('VitaNusa berhasil dipasang.');
  };

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const installRequest = session.requestInstall();
      render('Membuka konfirmasi pemasangan…');
      const result = await installRequest;

      if (result.status === 'accepted') {
        render('Pemasangan diterima. Menunggu konfirmasi dari browser.');
      } else if (result.status === 'dismissed') {
        render('Pemasangan dibatalkan. Kamu dapat mencobanya lagi dari Pengaturan.');
      } else if (result.status === 'installed') {
        render('VitaNusa sudah terpasang.');
      } else {
        render('Prompt pemasangan belum tersedia. Gunakan menu Chrome untuk memasang VitaNusa.');
      }
    });
  });

  windowRef.addEventListener('beforeinstallprompt', handleBeforeInstall);
  windowRef.addEventListener('appinstalled', handleInstalled);
  displayMode?.addEventListener?.('change', () => {
    if (displayMode.matches) session.markInstalled();
    render();
  });

  initPwaUpdateFlow(documentRef, windowRef, navigatorRef);
  render();

  const controller = { session, render };
  INSTALL_CONTROLLERS.set(documentRef, controller);
  return controller;
}
