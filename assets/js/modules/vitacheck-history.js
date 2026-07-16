const FIREBASE_VERSION = '12.15.0';
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
const FIREBASE_FIRESTORE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
const PUBLIC_FIREBASE_APP_NAME = 'vitanusa-public';

export const VITACHECK_LOCAL_STORAGE_KEY = 'vitanusa-vitacheck-v2-result';
export const VITACHECK_REMINDER_STORAGE_KEY = 'vitanusa-vitacheck-history-reminder';
export const VITACHECK_SOURCE = 'vitacheck-v2';
export const VITACHECK_VERSION = 2;
export const VITACHECK_HISTORY_PAGE_SIZE = 12;

export const VITACHECK_CATEGORIES = Object.freeze({
  tidur: Object.freeze({ label: 'Tidur', focus: 'Tidur 15–30 menit lebih awal.' }),
  air: Object.freeze({ label: 'Air minum', focus: 'Siapkan air minum dekat tempat aktivitas.' }),
  makan: Object.freeze({ label: 'Pola makan', focus: 'Rapikan satu waktu makan terlebih dahulu.' }),
  gerak: Object.freeze({ label: 'Gerak tubuh', focus: 'Jalan kaki atau bergerak ringan 10 menit.' }),
  pencernaan: Object.freeze({ label: 'Pencernaan', focus: 'Perhatikan pola makan dan keluhan yang menetap.' }),
  energi: Object.freeze({ label: 'Energi', focus: 'Kurangi begadang dan perhatikan sinyal tubuh.' }),
  stres: Object.freeze({ label: 'Stres', focus: 'Ambil jeda dan cari dukungan jika beban terasa berat.' }),
  literasi: Object.freeze({ label: 'Literasi produk', focus: 'Baca label dan periksa klaim sebelum percaya testimoni.' }),
});

export const VITACHECK_RESULT_BANDS = Object.freeze({
  strong: 'Kebiasaan cukup kuat',
  medium: 'Cukup, tetapi perlu dirapikan',
  low: 'Perlu perhatian bertahap',
});

const ALLOWED_CATEGORY_IDS = Object.freeze(Object.keys(VITACHECK_CATEGORIES));
const CLOUD_FIELDS = Object.freeze([
  'version',
  'score',
  'resultBand',
  'focusIds',
  'attentionIds',
  'recommendationSlugs',
  'source',
  'createdAt',
]);
const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_RESULT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const HISTORY_BATCH_SIZE = 200;

let firebaseRuntimePromise = null;

function createHistoryError(code, message) {
  const error = new Error(message);
  error.name = 'VitaNusaVitaCheckHistoryError';
  error.code = code;
  return error;
}

function normalizeInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) return Number(value.trim());
  return Number.NaN;
}

function uniqueStrings(values) {
  const unique = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
}

function normalizeCategoryList(value) {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((item) => (
    typeof item === 'string' ? item.trim().toLowerCase() : String(item)
  )));
}

function normalizeSlug(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getSlugFromArticle(article) {
  const directSlug = normalizeSlug(article?.slug || article?.id);
  if (SAFE_SLUG_PATTERN.test(directSlug)) return directSlug;

  const href = typeof article?.href === 'string' ? article.href.trim() : '';
  if (!href) return '';

  try {
    const url = new URL(href, 'https://vitanusa.example/');
    const querySlug = normalizeSlug(url.searchParams.get('slug'));
    if (SAFE_SLUG_PATTERN.test(querySlug)) return querySlug;

    const filename = url.pathname.split('/').filter(Boolean).at(-1) || '';
    const fileSlug = normalizeSlug(filename.replace(/\.html$/i, ''));
    if (fileSlug === 'index') return '';
    return SAFE_SLUG_PATTERN.test(fileSlug) ? fileSlug : '';
  } catch {
    return '';
  }
}

function getRecommendationSlugs(input) {
  if (Array.isArray(input?.recommendationSlugs)) {
    return uniqueStrings(input.recommendationSlugs.map(normalizeSlug));
  }

  if (!Array.isArray(input?.articles)) return [];
  return uniqueStrings(input.articles.map(getSlugFromArticle).filter(Boolean));
}

function getCategoryIdsFromAnswers(input, values) {
  if (!Array.isArray(input?.answers)) return [];
  return uniqueStrings(input.answers
    .filter((answer) => values.includes(Number(answer?.value)))
    .map((answer) => typeof answer?.questionId === 'string' ? answer.questionId.trim().toLowerCase() : '')
    .filter(Boolean));
}

function getDerivedFocusIds(input) {
  if (Array.isArray(input?.focusIds)) return normalizeCategoryList(input.focusIds);
  const low = getCategoryIdsFromAnswers(input, [0]);
  return low.length ? low : getCategoryIdsFromAnswers(input, [1]);
}

function getDerivedAttentionIds(input) {
  if (Array.isArray(input?.attentionIds)) return normalizeCategoryList(input.attentionIds);
  return getCategoryIdsFromAnswers(input, [0]);
}

export function getVitaCheckResultBand(score) {
  const normalizedScore = normalizeInteger(score);
  if (!Number.isInteger(normalizedScore)) return '';
  if (normalizedScore >= 80) return 'strong';
  if (normalizedScore >= 50) return 'medium';
  return 'low';
}

export function normalizeVitaCheckHistoryRecord(input = {}, { createdAt } = {}) {
  const score = normalizeInteger(input.score);
  const resultBand = typeof input.resultBand === 'string'
    ? input.resultBand.trim().toLowerCase()
    : getVitaCheckResultBand(score);

  return {
    version: normalizeInteger(input.version ?? VITACHECK_VERSION),
    score,
    resultBand,
    focusIds: getDerivedFocusIds(input).slice(0, 4),
    attentionIds: getDerivedAttentionIds(input).slice(0, 4),
    recommendationSlugs: getRecommendationSlugs(input).slice(0, 3),
    source: typeof input.source === 'string' ? input.source.trim().toLowerCase() : VITACHECK_SOURCE,
    createdAt: createdAt ?? input.createdAt ?? null,
  };
}

function isTimestampLike(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') return !Number.isNaN(Date.parse(value));
  if (!value || typeof value !== 'object') return false;
  return typeof value.toDate === 'function'
    || typeof value.toMillis === 'function'
    || value._methodName === 'serverTimestamp';
}

export function validateVitaCheckHistoryPayload(payload, { requireCreatedAt = true } = {}) {
  const errors = [];
  const keys = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? Object.keys(payload)
    : [];
  const requiredFields = requireCreatedAt ? CLOUD_FIELDS : CLOUD_FIELDS.filter((field) => field !== 'createdAt');

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('payload harus berupa object');
    return { valid: false, errors };
  }

  if (keys.some((key) => !CLOUD_FIELDS.includes(key))) errors.push('field tambahan tidak diizinkan');
  if (requiredFields.some((field) => !keys.includes(field))) errors.push('field wajib belum lengkap');
  if (payload.version !== VITACHECK_VERSION || !Number.isInteger(payload.version)) errors.push('version tidak didukung');
  if (!Number.isInteger(payload.score) || payload.score < 0 || payload.score > 100) errors.push('score harus integer 0–100');
  if (!Object.hasOwn(VITACHECK_RESULT_BANDS, payload.resultBand)) errors.push('resultBand tidak valid');

  for (const [field, maxItems] of [['focusIds', 4], ['attentionIds', 4]]) {
    const list = payload[field];
    if (!Array.isArray(list) || list.length > maxItems) {
      errors.push(`${field} tidak valid`);
      continue;
    }
    if (list.some((item) => typeof item !== 'string' || !ALLOWED_CATEGORY_IDS.includes(item))) {
      errors.push(`${field} memuat kategori tidak dikenal`);
    }
  }

  const slugs = payload.recommendationSlugs;
  if (!Array.isArray(slugs) || slugs.length > 3) {
    errors.push('recommendationSlugs tidak valid');
  } else if (slugs.some((slug) => typeof slug !== 'string' || slug.length > 120 || !SAFE_SLUG_PATTERN.test(slug))) {
    errors.push('recommendationSlugs memuat slug tidak aman');
  }

  if (payload.source !== VITACHECK_SOURCE) errors.push('source tidak valid');
  if (requireCreatedAt && !isTimestampLike(payload.createdAt)) errors.push('createdAt tidak valid');

  return { valid: errors.length === 0, errors };
}

export function buildVitaCheckHistoryPayload(input, { createdAt = new Date() } = {}) {
  const payload = normalizeVitaCheckHistoryRecord(input, { createdAt });
  const validation = validateVitaCheckHistoryPayload(payload);
  if (!validation.valid) {
    throw createHistoryError('invalid-argument', validation.errors.join('; '));
  }
  return Object.freeze(payload);
}

function randomToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return Math.random().toString(36).slice(2).padEnd(16, '0').slice(0, 16);
}

export function createVitaCheckResultId({ now = Date.now(), token } = {}) {
  const timestamp = Number.isFinite(Number(now)) ? Math.max(0, Math.floor(Number(now))) : Date.now();
  const safeToken = String(token || randomToken()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
  return `vc2-${timestamp.toString(36)}-${safeToken || 'result'}`;
}

function stableLegacyResultId(input) {
  const seed = JSON.stringify({
    version: input?.version,
    score: input?.score,
    createdAt: input?.createdAt,
  });
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const time = Number.isNaN(Date.parse(input?.createdAt)) ? 0 : Date.parse(input.createdAt);
  return `vc2-legacy-${Math.max(0, time).toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function createSafeLocalVitaCheckResult(input = {}, options = {}) {
  const resultId = typeof options.resultId === 'string'
    ? options.resultId.trim()
    : typeof input.resultId === 'string'
      ? input.resultId.trim()
      : createVitaCheckResultId();
  const localCreatedAt = options.createdAt ?? input.createdAt ?? new Date().toISOString();
  const payload = buildVitaCheckHistoryPayload(input, { createdAt: localCreatedAt });

  if (!SAFE_RESULT_ID_PATTERN.test(resultId)) {
    throw createHistoryError('invalid-result-id', 'ID hasil VitaCheck tidak valid.');
  }

  return Object.freeze({ resultId, ...payload });
}

export function readLocalVitaCheckResult(storage = globalThis.localStorage, key = VITACHECK_LOCAL_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const resultId = SAFE_RESULT_ID_PATTERN.test(String(parsed.resultId || ''))
      ? parsed.resultId
      : stableLegacyResultId(parsed);
    const safeResult = createSafeLocalVitaCheckResult(parsed, {
      resultId,
      createdAt: parsed.createdAt || new Date(0).toISOString(),
    });
    const safeSerialized = JSON.stringify(safeResult);
    if (safeSerialized !== raw) storage?.setItem?.(key, safeSerialized);
    return safeResult;
  } catch {
    return null;
  }
}

export function saveLocalVitaCheckResult(input, storage = globalThis.localStorage, key = VITACHECK_LOCAL_STORAGE_KEY) {
  const safeResult = createSafeLocalVitaCheckResult(input, {
    resultId: input?.resultId,
    createdAt: input?.createdAt,
  });
  storage?.setItem?.(key, JSON.stringify(safeResult));
  return safeResult;
}

export function clearLocalVitaCheckResult(storage = globalThis.localStorage, key = VITACHECK_LOCAL_STORAGE_KEY) {
  storage?.removeItem?.(key);
}

export function normalizeVitaCheckHistoryErrorCode(error) {
  const raw = typeof error === 'string' ? error : error?.code;
  const code = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!code) return 'unknown';
  return code
    .replace(/^firestore\//, '')
    .replace(/^firebase:/, '')
    .replace(/[()]/g, '');
}

export function mapVitaCheckHistoryError(error) {
  const code = normalizeVitaCheckHistoryErrorCode(error);
  const mappings = {
    'permission-denied': {
      title: 'Akses ditolak',
      message: 'Firestore Rules menolak operasi ini. Pastikan kamu login dengan akun pemilik riwayat.',
    },
    unavailable: {
      title: 'Jaringan tidak tersedia',
      message: 'Tidak dapat menghubungi Firestore. Periksa koneksi internet lalu coba kembali.',
    },
    'deadline-exceeded': {
      title: 'Koneksi terlalu lama',
      message: 'Permintaan ke Firestore melewati batas waktu. Hasil lokal tetap aman di perangkat.',
    },
    'already-exists': {
      title: 'Hasil sudah tersimpan',
      message: 'Hasil VitaCheck ini sudah ada di akun dan tidak ditimpa.',
    },
    'operation-in-progress': {
      title: 'Penyimpanan sedang berjalan',
      message: 'Operasi untuk hasil ini masih diproses. Tunggu hingga selesai.',
    },
    'not-found': {
      title: 'Hasil tidak ditemukan',
      message: 'Hasil tersebut sudah tidak tersedia atau telah dihapus.',
    },
    unauthenticated: {
      title: 'Sesi belum tersedia',
      message: 'Silakan login kembali sebelum mengakses riwayat akun.',
    },
    'invalid-argument': {
      title: 'Ringkasan tidak valid',
      message: 'Ringkasan VitaCheck tidak memenuhi batas data privat yang diizinkan.',
    },
  };

  return Object.freeze({
    code,
    title: mappings[code]?.title || 'Operasi belum berhasil',
    message: mappings[code]?.message || 'Terjadi kendala yang tidak dikenal. Data lokal tidak dihapus dan detail teknis tidak ditampilkan.',
  });
}

export function createDocumentOperationGuard() {
  const activeKeys = new Set();

  return {
    isActive(key) {
      return activeKeys.has(String(key));
    },
    async run(key, operation) {
      const safeKey = String(key);
      if (activeKeys.has(safeKey)) {
        throw createHistoryError('operation-in-progress', 'Operasi untuk dokumen ini sedang berjalan.');
      }
      activeKeys.add(safeKey);
      try {
        return await operation();
      } finally {
        activeKeys.delete(safeKey);
      }
    },
  };
}

const cloudOperationGuard = createDocumentOperationGuard();

function validateUid(uid) {
  const normalized = typeof uid === 'string' ? uid.trim() : '';
  if (!normalized || normalized.length > 128 || normalized.includes('/')) {
    throw createHistoryError('unauthenticated', 'UID pengguna aktif tidak tersedia.');
  }
  return normalized;
}

function validateResultId(resultId) {
  const normalized = typeof resultId === 'string' ? resultId.trim() : '';
  if (!SAFE_RESULT_ID_PATTERN.test(normalized)) {
    throw createHistoryError('invalid-result-id', 'ID hasil VitaCheck tidak valid.');
  }
  return normalized;
}

async function loadFirebaseFirestoreModules() {
  const [appModule, firestoreModule] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_FIRESTORE_URL),
  ]);

  return {
    getApps: appModule.getApps,
    initializeApp: appModule.initializeApp,
    collection: firestoreModule.collection,
    deleteDoc: firestoreModule.deleteDoc,
    doc: firestoreModule.doc,
    documentId: firestoreModule.documentId,
    getDocs: firestoreModule.getDocs,
    getFirestore: firestoreModule.getFirestore,
    limit: firestoreModule.limit,
    orderBy: firestoreModule.orderBy,
    query: firestoreModule.query,
    runTransaction: firestoreModule.runTransaction,
    serverTimestamp: firestoreModule.serverTimestamp,
    startAfter: firestoreModule.startAfter,
    writeBatch: firestoreModule.writeBatch,
  };
}

async function loadFirebaseConfig() {
  const configModule = await import('../../../admin/firebase-config.js');
  return configModule.firebaseConfig;
}

async function getFirebaseFirestoreRuntime() {
  if (!firebaseRuntimePromise) {
    firebaseRuntimePromise = Promise.all([
      loadFirebaseFirestoreModules(),
      loadFirebaseConfig(),
    ]).then(([api, firebaseConfig]) => {
      const existingPublicApp = api.getApps().find((candidate) => candidate.name === PUBLIC_FIREBASE_APP_NAME);
      const app = existingPublicApp || api.initializeApp(firebaseConfig, PUBLIC_FIREBASE_APP_NAME);
      return { api, app, db: api.getFirestore(app) };
    }).catch((error) => {
      firebaseRuntimePromise = null;
      throw error;
    });
  }
  return firebaseRuntimePromise;
}

function historyCollection(runtime, uid) {
  return runtime.api.collection(runtime.db, 'users', uid, 'vitaCheckHistory');
}

function historyDocument(runtime, uid, resultId) {
  return runtime.api.doc(runtime.db, 'users', uid, 'vitaCheckHistory', resultId);
}

export async function saveVitaCheckHistory({ uid, result }) {
  const safeUid = validateUid(uid);
  const resultId = validateResultId(result?.resultId);

  return cloudOperationGuard.run(`${safeUid}/${resultId}`, async () => {
    const runtime = await getFirebaseFirestoreRuntime();
    const payload = buildVitaCheckHistoryPayload(result, {
      createdAt: runtime.api.serverTimestamp(),
    });
    const reference = historyDocument(runtime, safeUid, resultId);

    await runtime.api.runTransaction(runtime.db, async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists()) {
        throw createHistoryError('already-exists', 'Hasil VitaCheck ini sudah tersimpan.');
      }
      transaction.set(reference, payload);
    });

    return Object.freeze({ resultId, ...payload });
  });
}

function sanitizeHistorySnapshot(snapshot) {
  const normalized = normalizeVitaCheckHistoryRecord(snapshot.data(), {
    createdAt: snapshot.data()?.createdAt,
  });
  const validation = validateVitaCheckHistoryPayload(normalized);
  if (!validation.valid) return null;
  return Object.freeze({ resultId: snapshot.id, ...normalized });
}

export async function listVitaCheckHistory({ uid, pageSize = VITACHECK_HISTORY_PAGE_SIZE, cursor = null }) {
  const safeUid = validateUid(uid);
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 50
    ? pageSize
    : VITACHECK_HISTORY_PAGE_SIZE;
  const runtime = await getFirebaseFirestoreRuntime();
  const constraints = [
    runtime.api.orderBy('createdAt', 'desc'),
  ];
  if (cursor) constraints.push(runtime.api.startAfter(cursor));
  constraints.push(runtime.api.limit(safePageSize + 1));

  const snapshot = await runtime.api.getDocs(runtime.api.query(
    historyCollection(runtime, safeUid),
    ...constraints,
  ));
  const displayedDocs = snapshot.docs.slice(0, safePageSize);
  const items = displayedDocs.map(sanitizeHistorySnapshot).filter(Boolean);

  return Object.freeze({
    items,
    hasMore: snapshot.docs.length > safePageSize,
    cursor: displayedDocs.at(-1) || null,
  });
}

export async function deleteVitaCheckHistoryResult({ uid, resultId }) {
  const safeUid = validateUid(uid);
  const safeResultId = validateResultId(resultId);
  return cloudOperationGuard.run(`${safeUid}/${safeResultId}`, async () => {
    const runtime = await getFirebaseFirestoreRuntime();
    await runtime.api.deleteDoc(historyDocument(runtime, safeUid, safeResultId));
    return { resultId: safeResultId };
  });
}

export async function deleteAllVitaCheckHistory({ uid, onProgress } = {}) {
  const safeUid = validateUid(uid);
  return cloudOperationGuard.run(`${safeUid}/__all__`, async () => {
    const runtime = await getFirebaseFirestoreRuntime();
    let deleted = 0;
    let batchNumber = 0;

    while (true) {
      const snapshot = await runtime.api.getDocs(runtime.api.query(
        historyCollection(runtime, safeUid),
        runtime.api.orderBy(runtime.api.documentId()),
        runtime.api.limit(HISTORY_BATCH_SIZE),
      ));
      if (snapshot.empty) break;

      const batch = runtime.api.writeBatch(runtime.db);
      snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
      await batch.commit();
      deleted += snapshot.size;
      batchNumber += 1;
      onProgress?.(Object.freeze({ deleted, batch: batchNumber }));
    }

    return Object.freeze({ deleted, batches: batchNumber });
  });
}

function formatHistoryDate(value) {
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value?.toDate === 'function') date = value.toDate();
  else if (typeof value?.toMillis === 'function') date = new Date(value.toMillis());
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);

  if (!date || Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getArticleHref(slug) {
  const staticRoutes = {
    'testimoni-bukan-bukti': 'articles/artikel-3.html',
    'artikel-3': 'articles/artikel-3.html',
    'ai-untuk-edukasi-kesehatan': 'articles/ai-untuk-edukasi-kesehatan.html',
    'kebiasaan-sehat-7-hari': 'articles/kebiasaan-sehat-7-hari.html',
    'tidur-dan-energi-harian': 'articles/tidur-dan-energi-harian.html',
    'pencernaan-dan-pola-makan': 'articles/pencernaan-dan-pola-makan.html',
    'cara-memakai-vitacheck': 'articles/cara-memakai-vitacheck.html',
  };
  return staticRoutes[slug] || `articles/detail.html?slug=${encodeURIComponent(slug)}`;
}

function createHistoryCard(item) {
  const card = document.createElement('article');
  card.className = 'vn-history-card';
  card.setAttribute('aria-label', `Hasil VitaCheck ${formatHistoryDate(item.createdAt)}`);

  const heading = document.createElement('div');
  heading.className = 'vn-history-card-heading';
  const date = document.createElement('time');
  date.className = 'vn-history-date';
  date.textContent = formatHistoryDate(item.createdAt);
  const score = document.createElement('strong');
  score.className = 'vn-history-score';
  score.textContent = `${item.score}/100`;
  score.setAttribute('aria-label', `Skor refleksi ${item.score} dari 100`);
  heading.append(date, score);

  const band = document.createElement('p');
  band.className = 'vn-history-band';
  band.textContent = VITACHECK_RESULT_BANDS[item.resultBand] || 'Hasil refleksi';

  const focusSection = document.createElement('section');
  const focusTitle = document.createElement('h3');
  focusTitle.textContent = 'Fokus mingguan';
  const focusList = document.createElement('ul');
  focusList.className = 'vn-history-tags';
  const focusIds = item.focusIds.length ? item.focusIds : [''];
  focusIds.forEach((id) => {
    const listItem = document.createElement('li');
    listItem.textContent = id ? VITACHECK_CATEGORIES[id]?.label || id : 'Belum ada fokus khusus';
    focusList.append(listItem);
  });
  focusSection.append(focusTitle, focusList);

  const articleSection = document.createElement('section');
  const articleTitle = document.createElement('h3');
  articleTitle.textContent = 'Artikel terkait';
  const articleList = document.createElement('div');
  articleList.className = 'vn-history-links';
  if (item.recommendationSlugs.length) {
    item.recommendationSlugs.forEach((slug) => {
      const link = document.createElement('a');
      link.href = getArticleHref(slug);
      link.textContent = slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      articleList.append(link);
    });
  } else {
    const empty = document.createElement('span');
    empty.textContent = 'Tidak ada artikel tersimpan';
    articleList.append(empty);
  }
  articleSection.append(articleTitle, articleList);

  const actions = document.createElement('div');
  actions.className = 'vn-history-actions';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'btn outline';
  deleteButton.dataset.historyDelete = item.resultId;
  deleteButton.dataset.historyDate = formatHistoryDate(item.createdAt);
  deleteButton.textContent = 'Hapus';
  deleteButton.setAttribute('aria-label', `Hapus hasil VitaCheck ${formatHistoryDate(item.createdAt)}`);
  actions.append(deleteButton);

  card.append(heading, band, focusSection, articleSection, actions);
  return card;
}

function setLiveStatus(element, kind, title, message, busy = false) {
  if (!element) return;
  element.hidden = false;
  element.dataset.kind = kind;
  element.setAttribute('aria-busy', String(busy));
  element.replaceChildren();
  const strong = document.createElement('strong');
  const span = document.createElement('span');
  strong.textContent = title;
  span.textContent = message;
  element.append(strong, span);
}

function createDialogController(dialog) {
  if (!dialog) {
    return {
      open() {},
      close() {},
      getAction: () => null,
      destroy() {},
    };
  }

  const title = dialog.querySelector('[data-dialog-title]');
  const message = dialog.querySelector('[data-dialog-message]');
  const confirmButton = dialog.querySelector('[data-dialog-confirm]');
  const cancelButtons = [...dialog.querySelectorAll('[data-dialog-cancel]')];
  let action = null;
  let trigger = null;

  const close = () => {
    if (dialog.open) dialog.close();
    else dialog.hidden = true;
    action = null;
    const focusTarget = trigger;
    trigger = null;
    focusTarget?.focus?.({ preventScroll: true });
  };

  const handleCancel = () => close();
  cancelButtons.forEach((button) => button.addEventListener('click', handleCancel));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  return {
    open(nextAction, options = {}) {
      action = nextAction;
      trigger = options.trigger || document.activeElement;
      if (title) title.textContent = options.title || 'Konfirmasi';
      if (message) message.textContent = options.message || 'Pastikan tindakan ini memang kamu inginkan.';
      if (confirmButton) confirmButton.textContent = options.confirmLabel || 'Konfirmasi';
      dialog.hidden = false;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      confirmButton?.focus({ preventScroll: true });
    },
    close,
    getAction() {
      return action;
    },
    destroy() {
      cancelButtons.forEach((button) => button.removeEventListener('click', handleCancel));
    },
  };
}

export function initVitaCheckHistoryPanel(root = document) {
  const panel = root.querySelector('[data-vc-history-panel]');
  if (!panel) return { setAuthState() {}, reload() {}, destroy() {} };

  const list = panel.querySelector('[data-vc-history-list]');
  const status = panel.querySelector('[data-vc-history-status]');
  const loadMoreButton = panel.querySelector('[data-vc-history-more]');
  const deleteAllButton = panel.querySelector('[data-vc-history-delete-all]');
  const dialog = panel.querySelector('[data-history-dialog]');
  const dialogController = createDialogController(dialog);
  const dialogConfirm = dialog?.querySelector('[data-dialog-confirm]');
  let activeUid = '';
  let cursor = null;
  let items = [];
  let operationInFlight = false;

  const setBusy = (busy) => {
    operationInFlight = busy;
    panel.setAttribute('aria-busy', String(busy));
    if (loadMoreButton) loadMoreButton.disabled = busy;
    if (deleteAllButton) deleteAllButton.disabled = busy || !activeUid || items.length === 0;
    list?.querySelectorAll('button').forEach((button) => {
      button.disabled = busy;
    });
    if (dialogConfirm) dialogConfirm.disabled = busy;
  };

  const render = () => {
    if (!list) return;
    list.replaceChildren(...items.map(createHistoryCard));
    if (loadMoreButton) loadMoreButton.hidden = !cursor;
    if (deleteAllButton) deleteAllButton.disabled = operationInFlight || items.length === 0;
  };

  const load = async ({ reset = false } = {}) => {
    if (!activeUid || operationInFlight) return;
    setBusy(true);
    setLiveStatus(status, 'loading', 'Memuat riwayat', 'Mengambil hasil privat milik akun aktif.', true);

    try {
      const page = await listVitaCheckHistory({
        uid: activeUid,
        cursor: reset ? null : cursor,
      });
      items = reset ? page.items : [...items, ...page.items];
      cursor = page.hasMore ? page.cursor : null;
      render();
      if (items.length) {
        setLiveStatus(status, 'success', 'Riwayat siap', `${items.length} hasil terbaru ditampilkan.`);
      } else {
        setLiveStatus(status, 'neutral', 'Belum ada riwayat', 'Hasil hanya muncul setelah kamu memilih Simpan ke akun dari VitaCheck.');
      }
    } catch (error) {
      const mapped = mapVitaCheckHistoryError(error);
      console.warn('VitaCheck history list', { code: mapped.code });
      setLiveStatus(status, 'error', mapped.title, mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleListClick = (event) => {
    const button = event.target.closest('[data-history-delete]');
    if (!button || operationInFlight) return;
    dialogController.open({ type: 'delete-one', resultId: button.dataset.historyDelete }, {
      trigger: button,
      title: 'Hapus satu hasil?',
      message: `Hasil VitaCheck ${button.dataset.historyDate || ''} akan dihapus dari akun. Hasil lokal di perangkat tidak ikut dihapus.`,
      confirmLabel: 'Hapus hasil',
    });
  };

  const handleDeleteAll = () => {
    if (!activeUid || operationInFlight || items.length === 0) return;
    dialogController.open({ type: 'delete-all' }, {
      trigger: deleteAllButton,
      title: 'Hapus seluruh riwayat cloud?',
      message: 'Semua hasil VitaCheck di akun aktif akan dihapus permanen. Hasil lokal di perangkat ini tetap disimpan.',
      confirmLabel: 'Hapus seluruh riwayat cloud',
    });
  };

  const handleDialogConfirm = async () => {
    const action = dialogController.getAction();
    if (!action || !activeUid || operationInFlight) return;
    setBusy(true);

    try {
      if (action.type === 'delete-one') {
        setLiveStatus(status, 'loading', 'Menghapus hasil', 'Menghapus satu hasil dari akun aktif.', true);
        await deleteVitaCheckHistoryResult({ uid: activeUid, resultId: action.resultId });
      } else {
        setLiveStatus(status, 'loading', 'Menghapus riwayat cloud', 'Memulai penghapusan bertahap.', true);
        await deleteAllVitaCheckHistory({
          uid: activeUid,
          onProgress: ({ deleted }) => setLiveStatus(
            status,
            'loading',
            'Menghapus riwayat cloud',
            `${deleted} hasil telah dihapus.`,
            true,
          ),
        });
      }
      dialogController.close();
      items = [];
      cursor = null;
      setBusy(false);
      await load({ reset: true });
      setLiveStatus(status, 'success', 'Penghapusan selesai', 'Riwayat cloud akun aktif telah diperbarui.');
    } catch (error) {
      const mapped = mapVitaCheckHistoryError(error);
      console.warn('VitaCheck history delete', { code: mapped.code });
      setLiveStatus(status, 'error', mapped.title, mapped.message);
      setBusy(false);
    }
  };

  const handleLoadMore = () => load();
  list?.addEventListener('click', handleListClick);
  loadMoreButton?.addEventListener('click', handleLoadMore);
  deleteAllButton?.addEventListener('click', handleDeleteAll);
  dialogConfirm?.addEventListener('click', handleDialogConfirm);

  return {
    setAuthState(state) {
      const nextUid = state?.isAuthenticated ? state.user?.uid || '' : '';
      if (nextUid === activeUid) return;
      activeUid = nextUid;
      items = [];
      cursor = null;
      render();
      if (activeUid) load({ reset: true });
      else setLiveStatus(status, 'neutral', 'Login diperlukan', 'Login untuk melihat riwayat cloud milikmu.');
    },
    reload() {
      return load({ reset: true });
    },
    destroy() {
      list?.removeEventListener('click', handleListClick);
      loadMoreButton?.removeEventListener('click', handleLoadMore);
      deleteAllButton?.removeEventListener('click', handleDeleteAll);
      dialogConfirm?.removeEventListener('click', handleDialogConfirm);
      dialogController.destroy();
    },
  };
}

export function initVitaCheckPrivacySettings(root = document) {
  const settings = root.querySelector('[data-vc-privacy-settings]');
  if (!settings) return { setAuthState() {}, destroy() {} };

  const reminder = settings.querySelector('[data-vc-history-reminder]');
  const autoSave = settings.querySelector('[data-vc-auto-save]');
  const clearLocalButton = settings.querySelector('[data-vc-clear-local]');
  const clearCloudButton = settings.querySelector('[data-vc-clear-cloud]');
  const status = settings.querySelector('[data-vc-privacy-status]');
  const dialog = settings.querySelector('[data-privacy-dialog]');
  const dialogController = createDialogController(dialog);
  const dialogConfirm = dialog?.querySelector('[data-dialog-confirm]');
  let activeUid = '';
  let operationInFlight = false;

  if (autoSave) {
    autoSave.checked = false;
    autoSave.disabled = true;
  }

  if (reminder) {
    try {
      reminder.checked = globalThis.localStorage?.getItem(VITACHECK_REMINDER_STORAGE_KEY) !== 'off';
    } catch {
      reminder.checked = true;
    }
  }

  const setBusy = (busy) => {
    operationInFlight = busy;
    settings.setAttribute('aria-busy', String(busy));
    if (clearLocalButton) clearLocalButton.disabled = busy;
    if (clearCloudButton) clearCloudButton.disabled = busy || !activeUid;
    if (reminder) reminder.disabled = busy;
    if (dialogConfirm) dialogConfirm.disabled = busy;
  };

  const handleReminder = () => {
    try {
      globalThis.localStorage?.setItem(VITACHECK_REMINDER_STORAGE_KEY, reminder.checked ? 'on' : 'off');
      setLiveStatus(status, 'success', 'Preferensi disimpan', reminder.checked
        ? 'Pengingat riwayat di perangkat ini aktif.'
        : 'Pengingat riwayat di perangkat ini dimatikan.');
    } catch {
      setLiveStatus(status, 'error', 'Preferensi belum disimpan', 'Browser tidak menyediakan localStorage untuk preferensi ini.');
    }
  };

  const openLocalDialog = () => dialogController.open({ type: 'clear-local' }, {
    trigger: clearLocalButton,
    title: 'Hapus hasil di perangkat ini?',
    message: 'Hasil VitaCheck lokal terakhir akan dihapus dari browser ini. Riwayat cloud tidak berubah.',
    confirmLabel: 'Hapus hasil lokal',
  });

  const openCloudDialog = () => {
    if (!activeUid) {
      setLiveStatus(status, 'error', 'Login diperlukan', 'Login dengan Google untuk menghapus riwayat cloud milikmu.');
      return;
    }
    dialogController.open({ type: 'clear-cloud' }, {
      trigger: clearCloudButton,
      title: 'Hapus seluruh riwayat cloud?',
      message: 'Semua hasil VitaCheck pada akun aktif akan dihapus permanen. Hasil lokal tetap tersedia.',
      confirmLabel: 'Hapus riwayat cloud',
    });
  };

  const handleConfirm = async () => {
    const action = dialogController.getAction();
    if (!action || operationInFlight) return;
    setBusy(true);

    try {
      if (action.type === 'clear-local') {
        clearLocalVitaCheckResult();
        setLiveStatus(status, 'success', 'Hasil lokal dihapus', 'Riwayat cloud, bila ada, tidak berubah.');
      } else {
        await deleteAllVitaCheckHistory({
          uid: activeUid,
          onProgress: ({ deleted }) => setLiveStatus(
            status,
            'loading',
            'Menghapus riwayat cloud',
            `${deleted} hasil telah dihapus.`,
            true,
          ),
        });
        setLiveStatus(status, 'success', 'Riwayat cloud dihapus', 'Hasil lokal di perangkat ini tidak ikut dihapus.');
      }
      dialogController.close();
    } catch (error) {
      const mapped = mapVitaCheckHistoryError(error);
      console.warn('VitaCheck privacy delete', { code: mapped.code });
      setLiveStatus(status, 'error', mapped.title, mapped.message);
    } finally {
      setBusy(false);
    }
  };

  reminder?.addEventListener('change', handleReminder);
  clearLocalButton?.addEventListener('click', openLocalDialog);
  clearCloudButton?.addEventListener('click', openCloudDialog);
  dialogConfirm?.addEventListener('click', handleConfirm);

  return {
    setAuthState(state) {
      activeUid = state?.isAuthenticated ? state.user?.uid || '' : '';
      if (clearCloudButton) clearCloudButton.disabled = operationInFlight || !activeUid;
      setLiveStatus(status, 'neutral', activeUid ? 'Akun terhubung' : 'Mode lokal', activeUid
        ? 'Penghapusan lokal dan cloud tetap merupakan dua tindakan terpisah.'
        : 'Hasil lokal dapat dikelola tanpa login. Login diperlukan untuk riwayat cloud.');
    },
    destroy() {
      reminder?.removeEventListener('change', handleReminder);
      clearLocalButton?.removeEventListener('click', openLocalDialog);
      clearCloudButton?.removeEventListener('click', openCloudDialog);
      dialogConfirm?.removeEventListener('click', handleConfirm);
      dialogController.destroy();
    },
  };
}
