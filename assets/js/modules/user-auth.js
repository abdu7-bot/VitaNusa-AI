const FIREBASE_VERSION = '12.15.0';
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
const PUBLIC_FIREBASE_APP_NAME = 'vitanusa-public';

export const USER_AUTH_STATE_EVENT = 'vitanusa:user-auth-state';
export const USER_AUTH_ERROR_EVENT = 'vitanusa:user-auth-error';

let firebaseRuntimePromise = null;
let authBootPromise = null;
let authObserverUnsubscribe = null;

function safeString(value, maxLength = 320) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function safePhotoUrl(value) {
  const candidate = safeString(value, 2048);
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function createPublicUserState(firebaseUser) {
  const uid = safeString(firebaseUser?.uid, 128);

  if (!uid) {
    return Object.freeze({
      status: 'signed-out',
      isAuthenticated: false,
      user: null,
    });
  }

  const user = Object.freeze({
    uid,
    displayName: safeString(firebaseUser?.displayName, 120) || 'Pengguna VitaNusa',
    email: safeString(firebaseUser?.email, 320),
    photoURL: safePhotoUrl(firebaseUser?.photoURL),
  });

  return Object.freeze({
    status: 'signed-in',
    isAuthenticated: true,
    user,
  });
}

export function createUserAuthStore(initialUser = null) {
  let state = createPublicUserState(initialUser);
  const listeners = new Set();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  return {
    getState() {
      return state;
    },
    setUser(firebaseUser) {
      state = createPublicUserState(firebaseUser);
      notify();
      return state;
    },
    clear() {
      state = createPublicUserState(null);
      notify();
      return state;
    },
    subscribe(listener, { emitCurrent = true } = {}) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      if (emitCurrent) listener(state);
      return () => listeners.delete(listener);
    },
  };
}

const publicUserStore = createUserAuthStore();

export function normalizeUserAuthErrorCode(error) {
  const rawCode = typeof error === 'string' ? error : error?.code;
  const code = safeString(rawCode, 96).toLowerCase();
  if (!code) return 'auth/unknown';
  if (code.startsWith('auth/')) return code;
  if (code.startsWith('firebase:')) {
    const match = code.match(/\((auth\/[a-z0-9-]+)\)/);
    if (match) return match[1];
  }
  return /^[a-z0-9-]+\/[a-z0-9-]+$/.test(code) ? code : 'auth/unknown';
}

export function mapUserAuthError(error) {
  const code = normalizeUserAuthErrorCode(error);
  const errors = {
    'auth/popup-blocked': {
      title: 'Popup login diblokir',
      message: 'Browser memblokir jendela login. VitaNusa akan mencoba alur pengalihan yang aman.',
    },
    'auth/popup-closed-by-user': {
      title: 'Login dibatalkan',
      message: 'Jendela Google ditutup sebelum login selesai. Tidak ada data VitaCheck yang diunggah.',
    },
    'auth/cancelled-popup-request': {
      title: 'Permintaan login dibatalkan',
      message: 'Ada permintaan login lain yang masih berlangsung. Tunggu sebentar lalu coba kembali.',
    },
    'auth/network-request-failed': {
      title: 'Koneksi login bermasalah',
      message: 'Tidak dapat menghubungi layanan login. Periksa koneksi internet lalu coba kembali.',
    },
    'auth/unauthorized-domain': {
      title: 'Domain belum diizinkan',
      message: 'Domain halaman ini belum terdaftar sebagai domain Firebase Authentication yang diizinkan.',
    },
    'auth/operation-not-allowed': {
      title: 'Login Google belum aktif',
      message: 'Provider Google belum diaktifkan pada Firebase Authentication. Hubungi pengelola situs.',
    },
    'auth/operation-not-supported-in-this-environment': {
      title: 'Popup tidak didukung',
      message: 'Browser ini tidak mendukung popup login. Gunakan alur pengalihan untuk melanjutkan.',
    },
    'auth/web-storage-unsupported': {
      title: 'Penyimpanan sesi diblokir',
      message: 'Browser memblokir penyimpanan yang diperlukan untuk sesi login. Periksa pengaturan privasi browser.',
    },
    'auth/unauthenticated': {
      title: 'Sesi belum tersedia',
      message: 'Silakan login dengan Google sebelum mengakses riwayat akun.',
    },
  };

  return Object.freeze({
    code,
    title: errors[code]?.title || 'Login belum berhasil',
    message: errors[code]?.message || 'Terjadi kendala saat memproses akun. Coba kembali tanpa membagikan informasi kredensial.',
  });
}

export function isLikelyMobileAuthEnvironment(environment = {}) {
  const userAgent = safeString(
    environment.userAgent
      ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    512,
  );
  const maxTouchPoints = Number(
    environment.maxTouchPoints
      ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0),
  );
  const viewportWidth = Number(
    environment.viewportWidth
      ?? (typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY),
  );

  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
    || (maxTouchPoints > 1 && viewportWidth <= 900);
}

export function shouldFallbackToRedirect(error) {
  return [
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
  ].includes(normalizeUserAuthErrorCode(error));
}

function createSafeAuthError(error) {
  const mapped = mapUserAuthError(error);
  const safeError = new Error(mapped.message);
  safeError.name = 'VitaNusaUserAuthError';
  safeError.code = mapped.code;
  safeError.title = mapped.title;
  return safeError;
}

function emitBrowserEvent(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function publishAuthState(firebaseUser) {
  const state = publicUserStore.setUser(firebaseUser);
  emitBrowserEvent(USER_AUTH_STATE_EVENT, state);
  return state;
}

function publishAuthError(error) {
  const mapped = mapUserAuthError(error);
  emitBrowserEvent(USER_AUTH_ERROR_EVENT, mapped);
  return mapped;
}

async function loadFirebaseAuthModules() {
  const [appModule, authModule] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_AUTH_URL),
  ]);

  return {
    getApps: appModule.getApps,
    initializeApp: appModule.initializeApp,
    GoogleAuthProvider: authModule.GoogleAuthProvider,
    browserLocalPersistence: authModule.browserLocalPersistence,
    getAuth: authModule.getAuth,
    getRedirectResult: authModule.getRedirectResult,
    onAuthStateChanged: authModule.onAuthStateChanged,
    setPersistence: authModule.setPersistence,
    signInWithPopup: authModule.signInWithPopup,
    signInWithRedirect: authModule.signInWithRedirect,
    signOut: authModule.signOut,
  };
}

async function loadFirebaseConfig() {
  const configModule = await import('../../../admin/firebase-config.js');
  return configModule.firebaseConfig;
}

async function getFirebaseRuntime() {
  if (!firebaseRuntimePromise) {
    firebaseRuntimePromise = Promise.all([
      loadFirebaseAuthModules(),
      loadFirebaseConfig(),
    ]).then(async ([api, firebaseConfig]) => {
      const existingPublicApp = api.getApps().find((candidate) => candidate.name === PUBLIC_FIREBASE_APP_NAME);
      const app = existingPublicApp || api.initializeApp(firebaseConfig, PUBLIC_FIREBASE_APP_NAME);
      const auth = api.getAuth(app);
      const provider = new api.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        await api.setPersistence(auth, api.browserLocalPersistence);
      } catch (error) {
        if (normalizeUserAuthErrorCode(error) !== 'auth/web-storage-unsupported') throw error;
      }

      return { api, app, auth, provider };
    }).catch((error) => {
      firebaseRuntimePromise = null;
      throw createSafeAuthError(error);
    });
  }

  return firebaseRuntimePromise;
}

export async function initUserAuth() {
  if (!authBootPromise) {
    authBootPromise = getFirebaseRuntime().then(async (runtime) => {
      try {
        await runtime.api.getRedirectResult(runtime.auth);
      } catch (error) {
        publishAuthError(error);
      }

      if (!authObserverUnsubscribe) {
        authObserverUnsubscribe = runtime.api.onAuthStateChanged(
          runtime.auth,
          (firebaseUser) => publishAuthState(firebaseUser),
          (error) => publishAuthError(error),
        );
      }

      publishAuthState(runtime.auth.currentUser);
      return publicUserStore.getState();
    }).catch((error) => {
      authBootPromise = null;
      publishAuthError(error);
      throw error;
    });
  }

  return authBootPromise;
}

export function subscribeUserAuth(listener, options) {
  const unsubscribe = publicUserStore.subscribe(listener, options);
  initUserAuth().catch(() => {});
  return unsubscribe;
}

export function getCurrentPublicUser() {
  return publicUserStore.getState().user;
}

export async function signInPublicUser({ preferRedirect } = {}) {
  const runtime = await getFirebaseRuntime();
  const useRedirect = typeof preferRedirect === 'boolean'
    ? preferRedirect
    : isLikelyMobileAuthEnvironment();

  if (useRedirect) {
    try {
      await runtime.api.signInWithRedirect(runtime.auth, runtime.provider);
      return Object.freeze({ mode: 'redirect', state: publicUserStore.getState() });
    } catch (error) {
      publishAuthError(error);
      throw createSafeAuthError(error);
    }
  }

  try {
    const credential = await runtime.api.signInWithPopup(runtime.auth, runtime.provider);
    const state = publishAuthState(credential.user);
    return Object.freeze({ mode: 'popup', state });
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      try {
        await runtime.api.signInWithRedirect(runtime.auth, runtime.provider);
        return Object.freeze({ mode: 'redirect', state: publicUserStore.getState() });
      } catch (redirectError) {
        publishAuthError(redirectError);
        throw createSafeAuthError(redirectError);
      }
    }

    publishAuthError(error);
    throw createSafeAuthError(error);
  }
}

export async function signOutPublicUser() {
  const runtime = await getFirebaseRuntime();

  try {
    await runtime.api.signOut(runtime.auth);
    const state = publicUserStore.clear();
    emitBrowserEvent(USER_AUTH_STATE_EVENT, state);
    return state;
  } catch (error) {
    publishAuthError(error);
    throw createSafeAuthError(error);
  }
}

function setText(root, selector, value) {
  root.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function setAuthStatus(root, kind, title, message, busy = false) {
  const status = root.querySelector('[data-user-auth-status]');
  if (!status) return;
  status.hidden = false;
  status.dataset.kind = kind;
  status.setAttribute('aria-busy', String(busy));
  status.replaceChildren();
  const strong = document.createElement('strong');
  const span = document.createElement('span');
  strong.textContent = title;
  span.textContent = message;
  status.append(strong, span);
}

export function renderPublicAccountState(root, state) {
  const signedIn = Boolean(state?.isAuthenticated && state.user);
  const signedOutPanel = root.querySelector('[data-user-signed-out]');
  const signedInPanel = root.querySelector('[data-user-signed-in]');
  const historyPanel = root.querySelector('[data-vc-history-panel]');

  if (signedOutPanel) signedOutPanel.hidden = signedIn;
  if (signedInPanel) signedInPanel.hidden = !signedIn;
  if (historyPanel) historyPanel.hidden = !signedIn;

  if (!signedIn) {
    setText(root, '[data-user-name]', 'Pengguna VitaNusa');
    setText(root, '[data-user-email]', 'Belum login');
    setText(root, '[data-user-login-state]', 'Belum login');
    return;
  }

  setText(root, '[data-user-name]', state.user.displayName || 'Pengguna VitaNusa');
  setText(root, '[data-user-email]', state.user.email || 'Email tidak tersedia');
  setText(root, '[data-user-login-state]', 'Login Google aktif');

  const image = root.querySelector('[data-user-photo]');
  const fallback = root.querySelector('[data-user-photo-fallback]');
  if (image) {
    if (state.user.photoURL) {
      image.src = state.user.photoURL;
      image.alt = `Foto profil ${state.user.displayName || 'pengguna'}`;
      image.hidden = false;
      if (fallback) fallback.hidden = true;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
      if (fallback) fallback.hidden = false;
    }
  }
}

export function initUserAccountPage(root = document, { onStateChange } = {}) {
  const loginButtons = [...root.querySelectorAll('[data-user-login]')];
  const logoutButtons = [...root.querySelectorAll('[data-user-logout]')];
  let operationInFlight = false;

  const setButtonsDisabled = (disabled) => {
    [...loginButtons, ...logoutButtons].forEach((button) => {
      button.disabled = disabled;
    });
  };

  const handleLogin = async () => {
    if (operationInFlight) return;
    operationInFlight = true;
    setButtonsDisabled(true);
    setAuthStatus(root, 'loading', 'Membuka Google Login', 'Pilih akun Google. Hasil VitaCheck tidak akan diunggah otomatis.', true);

    try {
      const result = await signInPublicUser();
      if (result.mode === 'popup') {
        setAuthStatus(root, 'success', 'Login berhasil', 'Akun siap. Penyimpanan hasil tetap memerlukan pilihan Simpan ke akun.');
      }
    } catch (error) {
      const mapped = mapUserAuthError(error);
      setAuthStatus(root, 'error', mapped.title, mapped.message);
    } finally {
      operationInFlight = false;
      setButtonsDisabled(false);
    }
  };

  const handleLogout = async () => {
    if (operationInFlight) return;
    operationInFlight = true;
    setButtonsDisabled(true);
    setAuthStatus(root, 'loading', 'Sedang logout', 'Mengakhiri sesi akun VitaNusa dengan aman.', true);

    try {
      await signOutPublicUser();
      setAuthStatus(root, 'success', 'Logout berhasil', 'Sesi akun telah berakhir. Hasil lokal di perangkat tidak dihapus.');
    } catch (error) {
      const mapped = mapUserAuthError(error);
      setAuthStatus(root, 'error', 'Logout belum berhasil', mapped.message);
    } finally {
      operationInFlight = false;
      setButtonsDisabled(false);
    }
  };

  const handleAuthError = (event) => {
    const mapped = mapUserAuthError(event?.detail?.code || event?.detail || 'auth/unknown');
    setAuthStatus(root, 'error', mapped.title, mapped.message);
  };

  loginButtons.forEach((button) => button.addEventListener('click', handleLogin));
  logoutButtons.forEach((button) => button.addEventListener('click', handleLogout));
  if (typeof window !== 'undefined') window.addEventListener(USER_AUTH_ERROR_EVENT, handleAuthError);

  const unsubscribe = subscribeUserAuth((state) => {
    renderPublicAccountState(root, state);
    if (state.isAuthenticated) {
      setAuthStatus(root, 'success', 'Akun terhubung', 'Riwayat cloud hanya berisi hasil yang kamu simpan secara sadar.');
    } else {
      setAuthStatus(root, 'neutral', 'Login bersifat opsional', 'VitaCheck tetap dapat digunakan dan disimpan lokal tanpa akun.');
    }
    onStateChange?.(state);
  });

  return {
    getState: () => publicUserStore.getState(),
    destroy() {
      unsubscribe();
      loginButtons.forEach((button) => button.removeEventListener('click', handleLogin));
      logoutButtons.forEach((button) => button.removeEventListener('click', handleLogout));
      if (typeof window !== 'undefined') window.removeEventListener(USER_AUTH_ERROR_EVENT, handleAuthError);
    },
  };
}
