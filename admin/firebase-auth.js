import {
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDocFromServer,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  canManageAdmins,
  evaluateAdminAccess,
  getAdminRetryAction,
  getFirebaseConfigError,
  normalizeFirebaseErrorCode
} from "./admin-access.js";

const EXPECTED_FIREBASE_CONFIG = Object.freeze({
  projectId: "vitanusa-ai",
  authDomain: "vitanusa-ai.firebaseapp.com"
});
const ADMIN_CHECK_TIMEOUT_MS = 10000;
const ADMIN_AUTH_BOOT_KEY = "__vitaNusaAdminAuthBooted";

let auth = null;
let db = null;
let googleProvider = null;
let firebaseInitializationResult = null;

const declaredConfigError = getFirebaseConfigError(firebaseConfig, EXPECTED_FIREBASE_CONFIG);

if (declaredConfigError) {
  firebaseInitializationResult = evaluateAdminAccess({ errorCode: declaredConfigError });
} else {
  try {
    const existingDefaultApp = getApps().find((candidate) => candidate.name === "[DEFAULT]");
    const app = existingDefaultApp || initializeApp(firebaseConfig);
    const existingConfigError = getFirebaseConfigError(app.options, EXPECTED_FIREBASE_CONFIG);

    if (existingConfigError) {
      firebaseInitializationResult = evaluateAdminAccess({ errorCode: existingConfigError });
    } else {
      auth = getAuth(app);
      db = getFirestore(app);
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });
    }
  } catch (error) {
    const code = normalizeFirebaseErrorCode(error);
    const safeCode = code === "unknown-error" ? "firebase-config-error" : code;
    firebaseInitializationResult = evaluateAdminAccess({ errorCode: safeCode });
  }
}

export { auth, db, googleProvider };

const page = document.body.dataset.adminAuthPage;
const loginButton = document.querySelector("[data-login-button]");
const logoutButtons = document.querySelectorAll("[data-logout-button]");
const recheckButtons = document.querySelectorAll("[data-recheck-admin]");
const statusBox = document.querySelector("[data-auth-status]");
const protectedContent = document.querySelector("[data-protected-content]");
const deniedContent = document.querySelector("[data-auth-denied]");
const deniedTitle = document.querySelector("[data-auth-denied-title]");
const deniedMessage = document.querySelector("[data-auth-denied-message]");
const emailTargets = document.querySelectorAll("[data-auth-email]");
const uidTargets = document.querySelectorAll("[data-auth-uid]");
const projectTargets = document.querySelectorAll("[data-firebase-project]");
const authStateTargets = document.querySelectorAll("[data-auth-state]");
const firestoreStateTargets = document.querySelectorAll("[data-firestore-state]");
const errorCodeTargets = document.querySelectorAll("[data-auth-error-code]");
const documentStatusTargets = document.querySelectorAll("[data-admin-document-status]");
const documentRoleTargets = document.querySelectorAll("[data-admin-role]");
const uidCards = document.querySelectorAll("[data-uid-card]");
const copyUidButtons = document.querySelectorAll("[data-copy-uid]");

let adminCheckInFlight = null;

function clearAdminReady() {
  window.vitaNusaAdmin = null;
}

function announceAdminReady(user, adminData) {
  const selectedAdmin = adminData || {};
  const detail = {
    user,
    auth,
    db,
    admin: selectedAdmin,
    canManageAdmins: canManageAdmins(selectedAdmin)
  };

  window.vitaNusaAdmin = detail;
  window.dispatchEvent(new CustomEvent("vitanusa:admin-ready", { detail }));
}

function setText(targets, value) {
  targets.forEach((target) => {
    const safeValue = value === undefined || value === null || value === "" ? "-" : String(value);

    if ("value" in target && target.matches("input, textarea, select")) {
      target.value = safeValue;
      return;
    }

    target.textContent = safeValue;
  });
}

function setStatus(kind, title, message) {
  if (!statusBox) return;

  const titleNode = document.createElement("strong");
  const messageNode = document.createElement("span");

  titleNode.textContent = title;
  messageNode.textContent = message;

  statusBox.hidden = false;
  statusBox.setAttribute("aria-busy", String(kind === "loading"));
  statusBox.classList.remove("is-loading", "is-success", "is-error", "is-warning");
  statusBox.classList.add(`is-${kind}`);
  statusBox.replaceChildren(titleNode, messageNode);
}

function getResultTone(result) {
  if (result.allowed) return "success";
  if (["no-user", "missing-admin-document", "inactive-admin"].includes(result.reason)) return "warning";
  return "error";
}

function getFirestoreState(result) {
  const states = {
    active: "Terverifikasi dari server",
    "no-user": "Belum diperiksa",
    "missing-admin-document": "Dokumen tidak ditemukan",
    "inactive-admin": "Dokumen ditemukan, status tidak aktif",
    "invalid-admin-role": "Dokumen ditemukan, role tidak valid",
    "permission-denied": "Ditolak oleh Firestore Rules",
    "network-unavailable": "Koneksi Firestore gagal",
    "request-timeout": "Request Firestore timeout",
    "firebase-config-error": "Konfigurasi Firebase tidak valid",
    "unknown-error": "Pemeriksaan gagal"
  };

  return states[result?.reason] || "Belum diperiksa";
}

function getAdminRoleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return role || "-";
}

function showUserIdentity(user) {
  setText(emailTargets, user?.email || "Email tidak tersedia");
  setText(uidTargets, user?.uid || "UID tidak tersedia");
  setText(authStateTargets, user ? "Login Google berhasil" : auth ? "Belum login" : "Firebase tidak tersedia");

  if (loginButton) loginButton.hidden = Boolean(user);
  logoutButtons.forEach((button) => {
    button.hidden = !user;
  });
  recheckButtons.forEach((button) => {
    button.hidden = !user;
  });
}

function updateDiagnostics(user, result) {
  showUserIdentity(user);
  setText(projectTargets, firebaseConfig?.projectId || "Tidak tersedia");
  setText(firestoreStateTargets, getFirestoreState(result));
  setText(errorCodeTargets, result?.errorCode || "-");
  setText(documentStatusTargets, result?.documentStatus || "-");
  setText(documentRoleTargets, getAdminRoleLabel(result?.documentRole));

  const showCard = Boolean(user) || result?.reason === "firebase-config-error";
  uidCards.forEach((card) => {
    card.hidden = !showCard;
  });
}

function setCheckingState(checking) {
  if (loginButton && !loginButton.hidden) loginButton.disabled = checking;
  recheckButtons.forEach((button) => {
    button.disabled = checking;
  });
}

function selectAdminMetadata(data) {
  return {
    status: data?.status === "active" ? "active" : undefined,
    role: ["owner", "admin"].includes(data?.role) ? data.role : undefined
  };
}

function createTimeoutError() {
  const error = new Error("Admin access request timed out");
  error.code = "firestore/deadline-exceeded";
  return error;
}

function withRequestTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(createTimeoutError()), ADMIN_CHECK_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function readAdminFromServer(user) {
  try {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnapshot = await withRequestTimeout(getDocFromServer(adminRef));
    const adminData = adminSnapshot.exists() ? adminSnapshot.data() : null;
    const result = evaluateAdminAccess({
      user,
      exists: adminSnapshot.exists(),
      data: adminData
    });

    if (!result.allowed) return result;
    return { ...result, data: selectAdminMetadata(adminData) };
  } catch (error) {
    return evaluateAdminAccess({
      user,
      errorCode: normalizeFirebaseErrorCode(error)
    });
  }
}

async function checkActiveAdmin(user) {
  if (!user) return { ...evaluateAdminAccess({ user: null }), attempts: 0 };
  if (!db) {
    return {
      ...(firebaseInitializationResult || evaluateAdminAccess({ errorCode: "firebase-config-error" })),
      attempts: 0
    };
  }

  const startedAt = performance.now();
  let attempts = 1;
  let result = await readAdminFromServer(user);
  const retryAction = getAdminRetryAction(result.reason, attempts);

  if (retryAction === "refresh-token" && typeof user.getIdToken === "function") {
    try {
      await withRequestTimeout(user.getIdToken(true));
      attempts += 1;
      result = await readAdminFromServer(user);
    } catch (error) {
      result = evaluateAdminAccess({
        user,
        errorCode: normalizeFirebaseErrorCode(error)
      });
    }
  } else if (retryAction === "retry-server") {
    attempts += 1;
    result = await readAdminFromServer(user);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const safeLog = {
    reason: result.reason,
    errorCode: result.errorCode || null,
    projectId: firebaseConfig.projectId,
    durationMs,
    attempts
  };

  if (result.allowed) console.info("VitaNusa admin access check", safeLog);
  else console.warn("VitaNusa admin access check", safeLog);

  return { ...result, attempts, durationMs };
}

function renderDeniedState(user, result) {
  clearAdminReady();
  if (protectedContent) protectedContent.hidden = true;
  if (deniedContent) deniedContent.hidden = false;
  if (deniedTitle) deniedTitle.textContent = result.title;
  if (deniedMessage) deniedMessage.textContent = result.message;
  updateDiagnostics(user, result);
  setStatus(getResultTone(result), result.title, result.message);
}

function renderAdminAccessResult(user, result) {
  updateDiagnostics(user, result);

  if (!result.allowed) {
    renderDeniedState(user, result);
    return;
  }

  if (deniedContent) deniedContent.hidden = true;
  setStatus("success", result.title, result.message);

  if (page === "login") {
    window.location.replace("index.html");
    return;
  }

  if (protectedContent) protectedContent.hidden = false;
  announceAdminReady(user, result.data);
}

async function verifyAndRenderAdmin(user) {
  if (adminCheckInFlight) return adminCheckInFlight;

  adminCheckInFlight = (async () => {
    setCheckingState(true);
    setStatus("loading", "Memeriksa akses admin", "Membaca dokumen admins/{uid} langsung dari server Firestore.");
    updateDiagnostics(user, {
      allowed: false,
      reason: "checking",
      errorCode: null,
      documentStatus: null
    });

    try {
      const result = await checkActiveAdmin(user);
      renderAdminAccessResult(user, result);
      return result;
    } finally {
      setCheckingState(false);
      adminCheckInFlight = null;
    }
  })();

  return adminCheckInFlight;
}

async function handleLoginPage(user) {
  if (!user) {
    clearAdminReady();
    const result = evaluateAdminAccess({ user: null });
    updateDiagnostics(null, result);
    setStatus("warning", result.title, result.message);
    if (loginButton) loginButton.disabled = false;
    return;
  }

  await verifyAndRenderAdmin(user);
}

async function handleDashboardPage(user) {
  if (!user) {
    clearAdminReady();
    window.location.replace("login.html");
    return;
  }

  await verifyAndRenderAdmin(user);
}

function renderLoginError(error) {
  const errorCode = normalizeFirebaseErrorCode(error);

  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(errorCode)) {
    setStatus("warning", "Login dibatalkan", "Tidak ada perubahan akun. Tekan Login dengan Google jika ingin mencoba lagi.");
    setText(errorCodeTargets, errorCode);
    return;
  }

  const result = evaluateAdminAccess({ user: {}, errorCode });
  const title = result.reason === "unknown-error" ? "Login Google gagal" : result.title;
  const message = result.reason === "unknown-error"
    ? "Catat kode error yang ditampilkan, lalu coba login kembali."
    : result.message;

  updateDiagnostics(auth?.currentUser || null, { ...result, title, message });
  setStatus("error", title, message);
}

function bindLoginButton() {
  if (!loginButton) return;

  loginButton.addEventListener("click", async () => {
    if (!auth || !googleProvider) {
      renderAdminAccessResult(null, firebaseInitializationResult || evaluateAdminAccess({ errorCode: "firebase-config-error" }));
      return;
    }

    loginButton.disabled = true;
    setStatus("loading", "Membuka Google Login", "Pilih akun Google untuk masuk ke admin VitaNusa AI.");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      renderLoginError(error);
    } finally {
      if (!auth.currentUser) loginButton.disabled = false;
    }
  });
}

function bindLogoutButtons() {
  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!auth) return;

      button.disabled = true;
      setStatus("loading", "Logout", "Sedang keluar dari sesi admin.");

      try {
        await signOut(auth);
        clearAdminReady();
        window.location.replace("login.html");
      } catch (error) {
        const errorCode = normalizeFirebaseErrorCode(error);
        setText(errorCodeTargets, errorCode);
        setStatus("error", "Logout gagal", "Catat kode error yang ditampilkan, lalu coba kembali.");
        button.disabled = false;
      }
    });
  });
}

function bindRecheckButtons() {
  recheckButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.disabled || adminCheckInFlight) return;
      const user = auth?.currentUser || null;

      if (!user) {
        const result = evaluateAdminAccess({ user: null });
        renderAdminAccessResult(null, result);
        return;
      }

      await verifyAndRenderAdmin(user);
    });
  });
}

function bindCopyUidButtons() {
  copyUidButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const uid = document.querySelector("[data-auth-uid]")?.textContent?.trim();
      if (!uid || uid === "UID tidak tersedia") return;

      try {
        await navigator.clipboard.writeText(uid);
        button.textContent = "UID disalin";
        window.setTimeout(() => {
          button.textContent = "Salin UID";
        }, 1800);
      } catch (error) {
        window.alert("UID belum bisa disalin otomatis. Silakan salin manual dari kotak UID.");
      }
    });
  });
}

function bootAdminAuth() {
  setText(projectTargets, firebaseConfig?.projectId || "Tidak tersedia");
  bindLoginButton();
  bindLogoutButtons();
  bindRecheckButtons();
  bindCopyUidButtons();

  if (firebaseInitializationResult || !auth) {
    renderAdminAccessResult(null, firebaseInitializationResult || evaluateAdminAccess({ errorCode: "firebase-config-error" }));
    return;
  }

  onAuthStateChanged(
    auth,
    async (user) => {
      if (page === "login") {
        await handleLoginPage(user);
        return;
      }

      if (page === "dashboard") await handleDashboardPage(user);
    },
    (error) => {
      const result = evaluateAdminAccess({
        user: auth.currentUser || {},
        errorCode: normalizeFirebaseErrorCode(error)
      });
      renderAdminAccessResult(auth.currentUser, result);
    }
  );
}

if (!window[ADMIN_AUTH_BOOT_KEY]) {
  window[ADMIN_AUTH_BOOT_KEY] = true;
  bootAdminAuth();
}
