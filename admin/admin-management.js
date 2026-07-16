import {
  canManageAdmins,
  normalizeFirebaseErrorCode
} from "./admin-access.js";

const FIRESTORE_MODULE_URL = "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
const VALID_ROLES = new Set(["owner", "admin"]);
const VALID_STATUSES = new Set(["active", "inactive"]);
const SAFE_UID_PATTERN = /^[A-Za-z0-9._~:@+-]+$/;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_COPY = Object.freeze({
  "permission-denied": {
    title: "Permission denied",
    message: "Akses ditolak oleh Firestore Rules. Pastikan akun yang digunakan memiliki role owner dan status active."
  },
  unavailable: {
    title: "Jaringan tidak tersedia",
    message: "Tidak dapat menghubungi Firestore. Periksa koneksi internet lalu coba kembali."
  },
  "deadline-exceeded": {
    title: "Koneksi melewati batas waktu",
    message: "Firestore belum merespons. Periksa koneksi internet lalu coba kembali."
  },
  "already-exists": {
    title: "Akun sudah tersedia",
    message: "UID tersebut sudah terdaftar di koleksi admins. Gunakan fitur edit, bukan tambah akun baru."
  },
  "not-found": {
    title: "Akun tidak ditemukan",
    message: "Dokumen admin sudah tidak tersedia. Muat ulang daftar lalu coba kembali."
  },
  unauthenticated: {
    title: "Sesi berubah",
    message: "Sesi owner tidak lagi valid. Silakan login kembali."
  },
  unknown: {
    title: "Operasi gagal",
    message: "Terjadi kesalahan yang tidak dikenal. Muat ulang daftar dan coba kembali tanpa membagikan data akun."
  }
});

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function canOpenAdminManagement(adminData) {
  return canManageAdmins(adminData);
}

export function normalizeAdminRecord(input = {}) {
  const requestedRole = cleanString(input.role);
  const requestedStatus = cleanString(input.status);

  return {
    uid: cleanString(input.uid),
    email: cleanString(input.email).toLowerCase(),
    role: requestedRole || "admin",
    status: requestedStatus || "inactive"
  };
}

export function validateAdminInput(input = {}) {
  const value = normalizeAdminRecord(input);
  const errors = {};

  if (!value.uid) {
    errors.uid = "UID Firebase wajib diisi.";
  } else if (value.uid.length > 128) {
    errors.uid = "UID Firebase maksimal 128 karakter.";
  } else if (value.uid === "." || value.uid === ".." || !SAFE_UID_PATTERN.test(value.uid)) {
    errors.uid = "UID hanya boleh memakai karakter aman tanpa spasi atau garis miring.";
  }

  if (!value.email) {
    errors.email = "Email wajib diisi.";
  } else if (value.email.length > 254 || !BASIC_EMAIL_PATTERN.test(value.email)) {
    errors.email = "Masukkan format email yang valid.";
  }

  if (!VALID_ROLES.has(value.role)) {
    errors.role = "Role hanya boleh owner atau admin.";
  }

  if (!VALID_STATUSES.has(value.status)) {
    errors.status = "Status hanya boleh active atau inactive.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value
  };
}

export function canEditAdmin(currentAdmin, targetAdmin, changes = {}) {
  if (!canOpenAdminManagement(currentAdmin)) return false;

  const currentUid = cleanString(currentAdmin?.uid);
  const targetUid = cleanString(targetAdmin?.uid);
  if (!currentUid || !targetUid) return false;
  if (currentUid !== targetUid) return true;

  const nextRole = Object.hasOwn(changes, "role") ? changes.role : targetAdmin?.role;
  const nextStatus = Object.hasOwn(changes, "status") ? changes.status : targetAdmin?.status;
  return nextRole === "owner" && nextStatus === "active";
}

export function canDeleteAdmin(currentAdmin, targetAdmin) {
  if (!canOpenAdminManagement(currentAdmin)) return false;

  const currentUid = cleanString(currentAdmin?.uid);
  const targetUid = cleanString(targetAdmin?.uid);
  return Boolean(currentUid && targetUid && currentUid !== targetUid);
}

export function shortenUid(uid) {
  const normalized = cleanString(uid);
  if (normalized.length <= 14) return normalized || "-";
  return `${normalized.slice(0, 8)}…${normalized.slice(-4)}`;
}

export function sortAdminRecords(records = []) {
  const rank = (record) => {
    if (record?.status === "active" && record?.role === "owner") return 0;
    if (record?.status === "active" && record?.role === "admin") return 1;
    if (record?.status === "inactive") return 2;
    return 3;
  };

  return [...records].sort((left, right) => {
    const rankDifference = rank(left) - rank(right);
    if (rankDifference) return rankDifference;

    const emailDifference = cleanString(left?.email).localeCompare(cleanString(right?.email), "id", {
      sensitivity: "base"
    });
    if (emailDifference) return emailDifference;
    return cleanString(left?.uid).localeCompare(cleanString(right?.uid), "id");
  });
}

export function mapAdminManagementError(errorOrCode) {
  const normalizedCode = normalizeFirebaseErrorCode(errorOrCode);
  const suffix = normalizedCode.split("/").pop();
  let code = suffix;

  if (suffix === "network-request-failed") code = "unavailable";
  if (!Object.hasOwn(ERROR_COPY, code)) code = "unknown";

  return {
    code,
    title: ERROR_COPY[code].title,
    message: ERROR_COPY[code].message
  };
}

function createManagementError(code) {
  const error = new Error("Admin management operation rejected");
  error.code = `firestore/${code}`;
  return error;
}

function labelRole(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Tidak valid";
}

function labelStatus(status) {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Tidak valid";
}

function selectLoadedAdmin(uid, data = {}) {
  return {
    uid: cleanString(uid),
    email: typeof data.email === "string" ? data.email : "",
    role: VALID_ROLES.has(data.role) ? data.role : "",
    status: VALID_STATUSES.has(data.status) ? data.status : ""
  };
}

function getChanges(target, role, status) {
  const changes = {};
  if (role !== target.role) changes.role = role;
  if (status !== target.status) changes.status = status;
  return changes;
}

function describeChanges(target, changes) {
  const descriptions = [];
  if (Object.hasOwn(changes, "role")) {
    descriptions.push(`Role: ${labelRole(target.role)} → ${labelRole(changes.role)}`);
  }
  if (Object.hasOwn(changes, "status")) {
    descriptions.push(`Status: ${labelStatus(target.status)} → ${labelStatus(changes.status)}`);
  }
  return descriptions.join("; ");
}

function getUpdateConfirmation(target, changes) {
  const isDeactivation = target.status !== "inactive" && changes.status === "inactive";
  const isPromotion = target.role !== "owner" && changes.role === "owner";
  const isDemotion = target.role === "owner" && changes.role === "admin";
  if (!isDeactivation && !isPromotion && !isDemotion) return null;

  if (isDemotion) {
    return {
      title: "Turunkan role owner?",
      confirmLabel: "Turunkan menjadi admin",
      tone: "danger"
    };
  }
  if (isPromotion) {
    return {
      title: "Ubah admin menjadi owner?",
      confirmLabel: "Ubah menjadi owner",
      tone: "primary"
    };
  }
  return {
    title: "Nonaktifkan akses admin?",
    confirmLabel: "Nonaktifkan admin",
    tone: "danger"
  };
}

const app = typeof document === "undefined"
  ? null
  : document.querySelector("[data-admin-management-app]");

const state = {
  authorized: false,
  bound: false,
  currentAdmin: null,
  db: null,
  firestoreApi: null,
  firestoreApiPromise: null,
  admins: [],
  listError: null,
  listPromise: null,
  formBusy: false,
  inFlight: new Map(),
  confirmationResolver: null,
  confirmationTrigger: null
};

const elements = app ? {
  form: app.querySelector("[data-admin-management-form]"),
  formSubmit: app.querySelector("[data-admin-management-submit]"),
  formErrors: app.querySelectorAll("[data-admin-management-error]"),
  list: app.querySelector("[data-admin-management-list]"),
  listRegion: app.querySelector("[data-admin-management-list-region]"),
  refresh: app.querySelector("[data-admin-management-refresh]"),
  message: app.querySelector("[data-admin-management-message]"),
  currentEmail: app.querySelector("[data-admin-management-current-email]"),
  currentUid: app.querySelector("[data-admin-management-current-uid]"),
  currentRole: app.querySelector("[data-admin-management-current-role]"),
  currentStatus: app.querySelector("[data-admin-management-current-status]"),
  dialog: app.querySelector("[data-admin-management-dialog]"),
  dialogTitle: app.querySelector("[data-admin-management-dialog-title]"),
  dialogEmail: app.querySelector("[data-admin-management-dialog-email]"),
  dialogUid: app.querySelector("[data-admin-management-dialog-uid]"),
  dialogChange: app.querySelector("[data-admin-management-dialog-change]"),
  dialogCancel: app.querySelector("[data-admin-management-dialog-cancel]"),
  dialogConfirm: app.querySelector("[data-admin-management-dialog-confirm]")
} : {};

function setOwnerNavigation(allowed) {
  document.querySelectorAll("[data-owner-admin-management-nav]").forEach((target) => {
    target.hidden = !allowed;
    target.disabled = !allowed;
    target.setAttribute("aria-hidden", String(!allowed));
  });
}

function setMessage(tone, title, message) {
  if (!elements.message) return;

  const titleNode = document.createElement("strong");
  const messageNode = document.createElement("span");
  titleNode.textContent = title;
  messageNode.textContent = message;

  elements.message.hidden = false;
  elements.message.classList.remove("is-success", "is-error", "is-warning", "is-loading");
  elements.message.classList.add(`is-${tone}`);
  elements.message.replaceChildren(titleNode, messageNode);
}

function renderCurrentAdmin() {
  const current = state.currentAdmin || {};
  if (elements.currentEmail) elements.currentEmail.textContent = current.email || "Email tidak tersedia";
  if (elements.currentUid) {
    elements.currentUid.textContent = shortenUid(current.uid);
    elements.currentUid.title = current.uid || "";
  }
  if (elements.currentRole) elements.currentRole.textContent = labelRole(current.role);
  if (elements.currentStatus) elements.currentStatus.textContent = labelStatus(current.status);
}

function createListStateRow(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 5;
  cell.className = "admin-management-list-state";
  cell.textContent = message;
  row.append(cell);
  return row;
}

function renderListState(message) {
  if (elements.list) elements.list.replaceChildren(createListStateRow(message));
}

function createCell(label, child) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  if (typeof child === "string") cell.textContent = child;
  else cell.append(child);
  return cell;
}

function createSelect(name, values, selectedValue, label) {
  const select = document.createElement("select");
  select.name = name;
  select.setAttribute("aria-label", label);

  if (!values.includes(selectedValue)) {
    const invalidOption = document.createElement("option");
    invalidOption.value = "";
    invalidOption.textContent = "Tidak valid";
    invalidOption.selected = true;
    invalidOption.disabled = true;
    select.append(invalidOption);
  }

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name === "role" ? labelRole(value) : labelStatus(value);
    option.selected = selectedValue === value;
    select.append(option);
  });
  return select;
}

function syncRowSaveState(row, target) {
  const role = row.querySelector('select[name="role"]')?.value;
  const status = row.querySelector('select[name="status"]')?.value;
  const saveButton = row.querySelector('[data-admin-management-action="update"]');
  if (!saveButton) return;

  const changes = getChanges(target, role, status);
  const hasChanges = Object.keys(changes).length > 0;
  saveButton.disabled = state.inFlight.has(target.uid)
    || !hasChanges
    || !canEditAdmin(state.currentAdmin, target, changes);
}

function createAdminRow(target) {
  const row = document.createElement("tr");
  row.dataset.adminRecord = target.uid;

  const email = document.createElement("strong");
  email.textContent = target.email || "(email tidak valid)";

  const uid = document.createElement("code");
  uid.textContent = target.uid;

  const role = createSelect("role", ["owner", "admin"], target.role, `Role ${target.email || target.uid}`);
  const status = createSelect("status", ["active", "inactive"], target.status, `Status ${target.email || target.uid}`);
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const isSelf = target.uid === state.currentAdmin?.uid;
  const operation = state.inFlight.get(target.uid);

  actions.className = "admin-management-actions";
  saveButton.type = "button";
  saveButton.className = "admin-button admin-button-primary";
  saveButton.dataset.adminManagementAction = "update";
  saveButton.textContent = operation === "update" ? "Menyimpan..." : "Simpan";

  deleteButton.type = "button";
  deleteButton.className = "admin-button admin-button-danger";
  deleteButton.dataset.adminManagementAction = "delete";
  deleteButton.textContent = operation === "delete" ? "Menghapus..." : "Hapus";

  role.disabled = isSelf || Boolean(operation);
  status.disabled = isSelf || Boolean(operation);
  saveButton.disabled = true;
  deleteButton.disabled = Boolean(operation) || !canDeleteAdmin(state.currentAdmin, target);
  actions.append(saveButton, deleteButton);

  if (isSelf) {
    const note = document.createElement("small");
    note.className = "admin-management-self-note";
    note.textContent = "Akun owner yang sedang digunakan dilindungi.";
    actions.append(note);
  }

  row.append(
    createCell("Email", email),
    createCell("UID", uid),
    createCell("Role", role),
    createCell("Status", status),
    createCell("Tindakan", actions)
  );
  syncRowSaveState(row, target);
  return row;
}

function renderAdminList() {
  if (!elements.list) return;
  if (state.listError) {
    const stateLabel = state.listError.code === "permission-denied" ? "Akses ditolak" : "Gagal memuat";
    renderListState(`${stateLabel}. ${state.listError.message}`);
    return;
  }
  if (!state.admins.length) {
    renderListState("Belum ada data admin.");
    return;
  }
  elements.list.replaceChildren(...state.admins.map(createAdminRow));
}

function logSafeError(operation, mappedError) {
  console.warn("VitaNusa admin management operation failed", {
    operation,
    code: mappedError.code
  });
}

async function getFirestoreApi() {
  if (state.firestoreApi) return state.firestoreApi;
  if (!state.firestoreApiPromise) {
    state.firestoreApiPromise = import(FIRESTORE_MODULE_URL).then((module) => {
      state.firestoreApi = module;
      return module;
    }).finally(() => {
      state.firestoreApiPromise = null;
    });
  }
  return state.firestoreApiPromise;
}

function ensureAuthorized() {
  if (!state.authorized || !canOpenAdminManagement(state.currentAdmin) || !state.db) {
    throw createManagementError("permission-denied");
  }
}

async function loadAdmins({ announce = true } = {}) {
  if (state.listPromise) return state.listPromise;

  state.listPromise = (async () => {
    ensureAuthorized();
    const { collection, getDocs } = await getFirestoreApi();
    if (elements.refresh) elements.refresh.disabled = true;
    if (elements.listRegion) elements.listRegion.setAttribute("aria-busy", "true");
    renderListState("Memuat...");
    if (announce) setMessage("loading", "Memuat daftar admin", "Membaca koleksi admins melalui Firestore Rules.");

    try {
      const snapshot = await getDocs(collection(state.db, "admins"));
      state.listError = null;
      state.admins = sortAdminRecords(snapshot.docs.map((entry) => selectLoadedAdmin(entry.id, entry.data())));
      renderAdminList();
      if (announce) {
        const detail = state.admins.length
          ? `${state.admins.length} akun admin berhasil dimuat.`
          : "Koleksi admins belum memiliki dokumen.";
        setMessage("success", state.admins.length ? "Daftar admin siap" : "Belum ada data", detail);
      }
      return { ok: true, records: state.admins };
    } catch (error) {
      const mapped = mapAdminManagementError(error);
      const stateLabel = mapped.code === "permission-denied" ? "Akses ditolak" : "Gagal memuat";
      state.admins = [];
      state.listError = mapped;
      renderListState(`${stateLabel}. ${mapped.message}`);
      setMessage("error", mapped.title, mapped.message);
      logSafeError("list", mapped);
      return { ok: false, error: mapped, records: [] };
    } finally {
      if (elements.refresh) elements.refresh.disabled = false;
      if (elements.listRegion) elements.listRegion.setAttribute("aria-busy", "false");
    }
  })().finally(() => {
    state.listPromise = null;
  });

  return state.listPromise;
}

function renderValidation(errors = {}) {
  elements.formErrors?.forEach((target) => {
    const fieldName = target.dataset.adminManagementError;
    const field = elements.form?.elements.namedItem(fieldName);
    const message = errors[fieldName] || "";
    target.textContent = message;
    target.hidden = !message;
    field?.setAttribute("aria-invalid", String(Boolean(message)));
  });
}

function setFormBusy(busy) {
  state.formBusy = busy;
  elements.form?.setAttribute("aria-busy", String(busy));
  Array.from(elements.form?.elements || []).forEach((field) => {
    field.disabled = busy;
  });
  if (elements.formSubmit) elements.formSubmit.textContent = busy ? "Menambahkan..." : "Tambah admin";
}

function resetCreateForm() {
  elements.form?.reset();
  if (elements.form?.elements.role) elements.form.elements.role.value = "admin";
  if (elements.form?.elements.status) elements.form.elements.status.value = "inactive";
  renderValidation();
}

async function handleCreate(event) {
  event.preventDefault();
  if (state.formBusy) return;

  const input = Object.fromEntries(new FormData(elements.form).entries());
  const validation = validateAdminInput(input);
  renderValidation(validation.errors);

  if (!validation.valid) {
    setMessage("warning", "Periksa form tambah admin", "Lengkapi UID, email, role, dan status dengan nilai yang valid.");
    return;
  }

  const record = validation.value;
  if (record.uid === state.currentAdmin?.uid) {
    setMessage(
      "error",
      "Akun owner aktif dilindungi",
      "Dokumen owner yang sedang digunakan tidak dapat ditimpa melalui form tambah admin."
    );
    return;
  }

  if (state.inFlight.has(record.uid)) {
    setMessage("warning", "Operasi masih berjalan", "Tunggu operasi pada UID tersebut selesai lalu coba kembali.");
    return;
  }

  state.inFlight.set(record.uid, "create");
  setFormBusy(true);
  try {
    ensureAuthorized();
    const { doc, getDocFromServer, runTransaction } = await getFirestoreApi();
    const adminRef = doc(state.db, "admins", record.uid);
    const existing = await getDocFromServer(adminRef);
    if (existing.exists()) throw createManagementError("already-exists");

    await runTransaction(state.db, async (transaction) => {
      const latest = await transaction.get(adminRef);
      if (latest.exists()) throw createManagementError("already-exists");
      transaction.set(adminRef, {
        email: record.email,
        role: record.role,
        status: record.status
      });
    });

    resetCreateForm();
    state.inFlight.delete(record.uid);
    const refreshResult = await loadAdmins({ announce: false });
    if (refreshResult.ok) {
      setMessage("success", "Admin ditambahkan", `${record.email} ditambahkan dengan status ${record.status}.`);
    } else {
      setMessage(
        "warning",
        "Admin ditambahkan, daftar belum dimuat",
        `Create berhasil, tetapi refresh gagal. ${refreshResult.error.message}`
      );
    }
  } catch (error) {
    const mapped = mapAdminManagementError(error);
    setMessage("error", mapped.title, mapped.message);
    logSafeError("create", mapped);
  } finally {
    state.inFlight.delete(record.uid);
    setFormBusy(false);
    renderAdminList();
  }
}

function closeConfirmation(confirmed) {
  const resolver = state.confirmationResolver;
  const trigger = state.confirmationTrigger;
  state.confirmationResolver = null;
  state.confirmationTrigger = null;

  if (elements.dialog?.open && typeof elements.dialog.close === "function") elements.dialog.close();
  else elements.dialog?.removeAttribute("open");

  resolver?.(confirmed);
  trigger?.focus?.();
}

function requestConfirmation({ title, target, change, confirmLabel, tone }, trigger) {
  if (!elements.dialog || state.confirmationResolver) return Promise.resolve(false);

  elements.dialogTitle.textContent = title;
  elements.dialogEmail.textContent = target.email || "Email tidak tersedia";
  elements.dialogUid.textContent = shortenUid(target.uid);
  elements.dialogUid.title = target.uid;
  elements.dialogChange.textContent = change;
  elements.dialogConfirm.textContent = confirmLabel;
  elements.dialogConfirm.classList.toggle("admin-button-danger", tone === "danger");
  elements.dialogConfirm.classList.toggle("admin-button-primary", tone !== "danger");
  state.confirmationTrigger = trigger;

  return new Promise((resolve) => {
    state.confirmationResolver = resolve;
    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    else elements.dialog.setAttribute("open", "");
    elements.dialogCancel?.focus();
  });
}

async function updateAdmin(target, row, trigger) {
  const role = row.querySelector('select[name="role"]')?.value;
  const status = row.querySelector('select[name="status"]')?.value;
  const validation = validateAdminInput({ ...target, role, status });
  const changes = getChanges(target, role, status);

  if (!validation.valid || !Object.keys(changes).length) {
    setMessage("warning", "Tidak ada perubahan valid", "Pilih role dan status yang valid sebelum menyimpan.");
    return;
  }

  if (!canEditAdmin(state.currentAdmin, target, changes)) {
    setMessage(
      "error",
      "Akun owner aktif dilindungi",
      "Akun owner yang sedang digunakan tidak dapat dinonaktifkan atau diturunkan rolenya dari sesi ini."
    );
    renderAdminList();
    return;
  }

  const riskyChange = getUpdateConfirmation(target, changes);
  if (riskyChange) {
    const confirmed = await requestConfirmation({
      ...riskyChange,
      target,
      change: describeChanges(target, changes)
    }, trigger);
    if (!confirmed) {
      renderAdminList();
      return;
    }
  }

  if (state.inFlight.has(target.uid)) return;
  state.inFlight.set(target.uid, "update");
  renderAdminList();

  try {
    ensureAuthorized();
    const { doc, updateDoc } = await getFirestoreApi();
    await updateDoc(doc(state.db, "admins", target.uid), changes);
    state.inFlight.delete(target.uid);
    const refreshResult = await loadAdmins({ announce: false });
    if (refreshResult.ok) {
      setMessage("success", "Perubahan disimpan", `${target.email || shortenUid(target.uid)} berhasil diperbarui.`);
    } else {
      setMessage(
        "warning",
        "Perubahan tersimpan, daftar belum dimuat",
        `Update berhasil, tetapi refresh gagal. ${refreshResult.error.message}`
      );
    }
  } catch (error) {
    const mapped = mapAdminManagementError(error);
    setMessage("error", mapped.title, mapped.message);
    logSafeError("update", mapped);
  } finally {
    state.inFlight.delete(target.uid);
    renderAdminList();
  }
}

async function deleteAdmin(target, trigger) {
  if (!canDeleteAdmin(state.currentAdmin, target)) {
    setMessage(
      "error",
      "Akun owner aktif dilindungi",
      "Akun owner yang sedang digunakan tidak dapat dihapus dari sesi ini."
    );
    return;
  }

  const confirmed = await requestConfirmation({
    title: "Hapus dokumen admin?",
    target,
    change: "Dokumen admins/{uid} akan dihapus dan akses dashboard akun tersebut akan dicabut.",
    confirmLabel: "Hapus akses admin",
    tone: "danger"
  }, trigger);
  if (!confirmed || state.inFlight.has(target.uid)) return;

  state.inFlight.set(target.uid, "delete");
  renderAdminList();
  try {
    ensureAuthorized();
    const { deleteDoc, doc } = await getFirestoreApi();
    await deleteDoc(doc(state.db, "admins", target.uid));
    state.inFlight.delete(target.uid);
    const refreshResult = await loadAdmins({ announce: false });
    if (refreshResult.ok) {
      setMessage("success", "Akses admin dihapus", `${target.email || shortenUid(target.uid)} tidak lagi terdaftar.`);
    } else {
      setMessage(
        "warning",
        "Akses dihapus, daftar belum dimuat",
        `Delete berhasil, tetapi refresh gagal. ${refreshResult.error.message}`
      );
    }
  } catch (error) {
    const mapped = mapAdminManagementError(error);
    setMessage("error", mapped.title, mapped.message);
    logSafeError("delete", mapped);
  } finally {
    state.inFlight.delete(target.uid);
    renderAdminList();
  }
}

function handleListChange(event) {
  const row = event.target.closest("[data-admin-record]");
  const target = state.admins.find((record) => record.uid === row?.dataset.adminRecord);
  if (row && target) syncRowSaveState(row, target);
}

async function handleListClick(event) {
  const button = event.target.closest("[data-admin-management-action]");
  const row = button?.closest("[data-admin-record]");
  const target = state.admins.find((record) => record.uid === row?.dataset.adminRecord);
  if (!button || !row || !target || button.disabled) return;

  if (button.dataset.adminManagementAction === "update") {
    await updateAdmin(target, row, button);
    return;
  }
  if (button.dataset.adminManagementAction === "delete") await deleteAdmin(target, button);
}

function bindPanel() {
  if (state.bound) return;
  state.bound = true;
  elements.form?.addEventListener("submit", handleCreate);
  elements.refresh?.addEventListener("click", () => loadAdmins());
  elements.list?.addEventListener("change", handleListChange);
  elements.list?.addEventListener("click", handleListClick);
  elements.dialogCancel?.addEventListener("click", () => closeConfirmation(false));
  elements.dialogConfirm?.addEventListener("click", () => closeConfirmation(true));
  elements.dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeConfirmation(false);
  });
}

async function handleAdminReady(detail = {}) {
  const adminData = detail.admin || {};
  const allowed = canOpenAdminManagement(adminData);
  state.authorized = allowed;
  setOwnerNavigation(allowed);

  if (!allowed) {
    state.currentAdmin = null;
    state.db = null;
    state.admins = [];
    state.listError = null;
    renderListState("Akses ditolak. Panel ini hanya tersedia untuk owner active.");
    return;
  }

  state.currentAdmin = {
    uid: cleanString(detail.user?.uid),
    email: cleanString(detail.user?.email).toLowerCase(),
    role: adminData.role,
    status: adminData.status
  };
  state.db = detail.db || null;
  renderCurrentAdmin();
  bindPanel();

  try {
    await getFirestoreApi();
    await loadAdmins();
  } catch (error) {
    const mapped = mapAdminManagementError(error);
    renderListState(`Gagal memuat. ${mapped.message}`);
    setMessage("error", mapped.title, mapped.message);
    logSafeError("initialize", mapped);
  }
}

if (app && typeof window !== "undefined") {
  window.addEventListener("vitanusa:admin-ready", (event) => {
    handleAdminReady(event.detail);
  });
  if (window.vitaNusaAdmin) handleAdminReady(window.vitaNusaAdmin);
}
