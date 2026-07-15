const RESULT_COPY = Object.freeze({
  active: {
    title: "Admin aktif",
    message: "Dokumen admin ditemukan dari server; status active dan role yang diizinkan sudah terverifikasi."
  },
  "no-user": {
    title: "Belum login",
    message: "Silakan login dengan Google untuk meminta akses admin."
  },
  "missing-admin-document": {
    title: "Akun belum terdaftar sebagai admin.",
    message: "Dokumen admins/{UID} belum ditemukan pada project Firebase yang digunakan aplikasi."
  },
  "inactive-admin": {
    title: "Akun admin belum aktif.",
    message: "Dokumen admin ditemukan, tetapi field status belum bernilai active."
  },
  "invalid-admin-role": {
    title: "Role akun admin tidak valid.",
    message: "Dokumen admin ditemukan, tetapi field role harus bernilai owner atau admin."
  },
  "permission-denied": {
    title: "Pemeriksaan admin ditolak oleh Firestore.",
    message: "Login Google berhasil, tetapi Firestore Rules menolak pembacaan dokumen admin. Periksa Rules yang sudah dipublikasikan dan pastikan UID dokumen sesuai."
  },
  "network-unavailable": {
    title: "Tidak dapat memeriksa status admin.",
    message: "Periksa koneksi internet, lalu tekan Periksa Ulang."
  },
  "request-timeout": {
    title: "Pemeriksaan admin melewati batas waktu.",
    message: "Server Firestore belum merespons tepat waktu. Periksa koneksi internet, lalu tekan Periksa Ulang."
  },
  "firebase-config-error": {
    title: "Konfigurasi Firebase tidak sesuai.",
    message: "Halaman admin terhubung ke project Firebase yang berbeda dari tempat dokumen admin dibuat."
  },
  "unknown-error": {
    title: "Pemeriksaan admin gagal.",
    message: "Catat kode error yang ditampilkan, lalu periksa console pengembang."
  }
});

const FIRESTORE_ERROR_CODES = new Set([
  "aborted",
  "already-exists",
  "cancelled",
  "data-loss",
  "deadline-exceeded",
  "failed-precondition",
  "internal",
  "invalid-argument",
  "not-found",
  "out-of-range",
  "permission-denied",
  "resource-exhausted",
  "unauthenticated",
  "unavailable",
  "unimplemented",
  "unknown"
]);

const CONFIG_ERROR_CODES = new Set([
  "firebase-config-error",
  "app/duplicate-app",
  "app/invalid-app-argument",
  "app/no-app",
  "app/no-options",
  "auth/invalid-api-key",
  "auth/unauthorized-domain"
]);

function makeResult(reason, overrides = {}) {
  const copy = RESULT_COPY[reason] || RESULT_COPY["unknown-error"];

  return {
    allowed: reason === "active",
    reason,
    title: copy.title,
    message: copy.message,
    errorCode: null,
    documentStatus: null,
    documentRole: null,
    ...overrides
  };
}

function getErrorReason(errorCode) {
  const suffix = errorCode.split("/").pop();

  if (CONFIG_ERROR_CODES.has(errorCode)) return "firebase-config-error";
  if (suffix === "permission-denied" || suffix === "unauthenticated") return "permission-denied";
  if (suffix === "unavailable" || suffix === "network-request-failed") return "network-unavailable";
  if (suffix === "deadline-exceeded") return "request-timeout";
  return "unknown-error";
}

function getSafeDocumentStatus(data) {
  const status = data?.status;

  if (status === undefined || status === null) return null;
  if (typeof status === "string") {
    const compact = status.replace(/\s+/g, " ").trim();
    return compact ? compact.slice(0, 80) : "(kosong)";
  }
  if (typeof status === "number" || typeof status === "boolean") return String(status);
  return `(tipe ${Array.isArray(status) ? "array" : "object"} tidak valid)`;
}

function getSafeDocumentRole(data) {
  const role = data?.role;

  if (role === undefined || role === null) return null;
  if (typeof role === "string") {
    const compact = role.replace(/\s+/g, " ").trim();
    return compact ? compact.slice(0, 80) : "(kosong)";
  }
  if (typeof role === "number" || typeof role === "boolean") return String(role);
  return `(tipe ${Array.isArray(role) ? "array" : "object"} tidak valid)`;
}

export function canManageAdmins(adminData) {
  return adminData?.status === "active" && adminData?.role === "owner";
}

export function normalizeFirebaseErrorCode(errorOrCode) {
  let rawCode = typeof errorOrCode === "string" ? errorOrCode : errorOrCode?.code;

  if (!rawCode && errorOrCode?.name === "TypeError") rawCode = "auth/network-request-failed";
  if (!rawCode) return "unknown-error";

  const normalized = String(rawCode).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9/_-]{0,79}$/.test(normalized)) return "unknown-error";
  if (normalized.includes("/")) return normalized;
  if (FIRESTORE_ERROR_CODES.has(normalized)) return `firestore/${normalized}`;
  if (normalized === "network-request-failed") return "auth/network-request-failed";
  return normalized;
}

export function getFirebaseConfigError(firebaseConfig, expectedConfig) {
  if (!firebaseConfig || typeof firebaseConfig !== "object") return "firebase-config-error";
  if (!expectedConfig || typeof expectedConfig !== "object") return "firebase-config-error";

  const projectMatches = firebaseConfig.projectId === expectedConfig.projectId;
  const authDomainMatches = firebaseConfig.authDomain === expectedConfig.authDomain;
  return projectMatches && authDomainMatches ? null : "firebase-config-error";
}

export function getAdminRetryAction(reason, attemptNumber) {
  if (attemptNumber !== 1) return "none";
  if (reason === "permission-denied") return "refresh-token";
  if (["network-unavailable", "request-timeout"].includes(reason)) return "retry-server";
  return "none";
}

export function evaluateAdminAccess({ user = null, exists = false, data = null, errorCode = null } = {}) {
  const normalizedErrorCode = errorCode ? normalizeFirebaseErrorCode(errorCode) : null;

  if (normalizedErrorCode && getErrorReason(normalizedErrorCode) === "firebase-config-error") {
    return makeResult("firebase-config-error", { errorCode: normalizedErrorCode });
  }

  if (!user) return makeResult("no-user");

  if (normalizedErrorCode) {
    const reason = getErrorReason(normalizedErrorCode);
    return makeResult(reason, { errorCode: normalizedErrorCode });
  }

  if (exists !== true) return makeResult("missing-admin-document");

  const documentStatus = getSafeDocumentStatus(data);
  const documentRole = getSafeDocumentRole(data);
  if (data?.status !== "active") {
    const statusMessage = documentStatus
      ? ` Status dokumen saat ini: ${documentStatus}. Nilai yang diperlukan: active.`
      : " Field status tidak tersedia. Nilai yang diperlukan: active.";

    return makeResult("inactive-admin", {
      documentStatus,
      documentRole,
      message: `${RESULT_COPY["inactive-admin"].message}${statusMessage}`
    });
  }

  if (!["owner", "admin"].includes(data?.role)) {
    const roleMessage = documentRole
      ? ` Role dokumen saat ini: ${documentRole}. Nilai yang diizinkan: owner atau admin.`
      : " Field role tidak tersedia. Nilai yang diizinkan: owner atau admin.";

    return makeResult("invalid-admin-role", {
      documentStatus: "active",
      documentRole,
      message: `${RESULT_COPY["invalid-admin-role"].message}${roleMessage}`
    });
  }

  return makeResult("active", {
    documentStatus: "active",
    documentRole: data.role
  });
}
