import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

const page = document.body.dataset.adminAuthPage;
const loginButton = document.querySelector("[data-login-button]");
const logoutButtons = document.querySelectorAll("[data-logout-button]");
const statusBox = document.querySelector("[data-auth-status]");
const protectedContent = document.querySelector("[data-protected-content]");
const deniedContent = document.querySelector("[data-auth-denied]");
const emailTargets = document.querySelectorAll("[data-auth-email]");
const uidTargets = document.querySelectorAll("[data-auth-uid]");
const uidCards = document.querySelectorAll("[data-uid-card]");
const copyUidButtons = document.querySelectorAll("[data-copy-uid]");

function setText(targets, value) {
  targets.forEach((target) => {
    target.textContent = value || "-";
  });
}

function setStatus(kind, title, message) {
  if (!statusBox) return;

  const titleNode = document.createElement("strong");
  const messageNode = document.createElement("span");

  titleNode.textContent = title;
  messageNode.textContent = message;

  statusBox.hidden = false;
  statusBox.classList.remove("is-loading", "is-success", "is-error", "is-warning");
  statusBox.classList.add(`is-${kind}`);
  statusBox.replaceChildren(titleNode, messageNode);
}

function showUserIdentity(user) {
  setText(emailTargets, user?.email || "Email tidak tersedia");
  setText(uidTargets, user?.uid || "UID tidak tersedia");
  uidCards.forEach((card) => {
    card.hidden = !user;
  });
}

async function checkActiveAdmin(user) {
  if (!user) return { active: false, reason: "no-user" };

  try {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnapshot = await getDoc(adminRef);

    if (!adminSnapshot.exists()) {
      return { active: false, reason: "missing-admin-doc" };
    }

    const adminData = adminSnapshot.data();
    return {
      active: adminData.status === "active",
      reason: adminData.status === "active" ? "active" : "inactive-admin",
      data: adminData
    };
  } catch (error) {
    return {
      active: false,
      reason: "admin-check-failed",
      error
    };
  }
}

function renderUnauthorized(user) {
  showUserIdentity(user);

  if (protectedContent) protectedContent.hidden = true;
  if (deniedContent) deniedContent.hidden = false;

  setStatus(
    "error",
    "Akun ini belum terdaftar sebagai admin aktif.",
    "Minta owner membuat dokumen admins/{uid} di Firestore Console dengan status active."
  );
}

async function handleLoginPage(user) {
  if (!user) {
    setStatus("warning", "Belum login", "Silakan login dengan Google untuk meminta akses admin.");
    showUserIdentity(null);
    if (loginButton) loginButton.disabled = false;
    return;
  }

  setStatus("loading", "Memeriksa akses admin", "Sedang mengecek dokumen admins/{uid} di Firestore.");
  showUserIdentity(user);

  const adminCheck = await checkActiveAdmin(user);

  if (adminCheck.active) {
    setStatus("success", "Admin aktif", "Login berhasil. Mengarahkan ke dashboard admin.");
    window.location.replace("index.html");
    return;
  }

  renderUnauthorized(user);
  if (loginButton) loginButton.disabled = false;
}

async function handleDashboardPage(user) {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  setStatus("loading", "Memeriksa akses admin", "Sedang mengecek status admin aktif.");
  showUserIdentity(user);

  const adminCheck = await checkActiveAdmin(user);

  if (!adminCheck.active) {
    renderUnauthorized(user);
    return;
  }

  if (deniedContent) deniedContent.hidden = true;
  if (protectedContent) protectedContent.hidden = false;

  setStatus(
    "success",
    "Admin aktif",
    "Firebase Auth aktif. CRUD artikel, komik, dan upload Storage belum aktif."
  );
}

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    loginButton.disabled = true;
    setStatus("loading", "Membuka Google Login", "Pilih akun Google untuk masuk ke admin VitaNusa AI.");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      loginButton.disabled = false;
      setStatus("error", "Login gagal", error.message || "Login Google tidak berhasil.");
    }
  });
}

logoutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    setStatus("loading", "Logout", "Sedang keluar dari sesi admin.");

    try {
      await signOut(auth);
      window.location.replace("login.html");
    } catch (error) {
      button.disabled = false;
      setStatus("error", "Logout gagal", error.message || "Gagal keluar dari sesi admin.");
    }
  });
});

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

onAuthStateChanged(auth, (user) => {
  if (page === "login") {
    handleLoginPage(user);
    return;
  }

  if (page === "dashboard") {
    handleDashboardPage(user);
  }
});
