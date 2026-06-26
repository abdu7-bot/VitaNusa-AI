import { db } from './firebase-auth.js';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const articleApp = document.querySelector('[data-article-app]');
const REQUIRED_DISCLAIMER = 'Konten ini bersifat edukasi dan refleksi, bukan diagnosis medis. Untuk keluhan serius, segera konsultasikan kepada tenaga kesehatan profesional.';
const VALID_STATUSES = new Set(['draft', 'published', 'archived']);
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RISK_TERMS = [
  'pasti sembuh',
  '100% aman',
  'obat segala penyakit',
  'sembuh total',
  'hasil instan',
  'tanpa efek samping',
  'menyembuhkan kanker',
  'menyembuhkan diabetes',
  'menyembuhkan penyakit kronis'
];
const EDUCATIONAL_CONTEXT_TERMS = [
  'contoh klaim',
  'klaim berisiko',
  'perlu diwaspadai',
  'yang perlu diwaspadai',
  'hindari klaim',
  'hindari promosi',
  'jangan percaya klaim',
  'bahaya klaim',
  'klaim berlebihan',
  'overclaim',
  'bukan bukti',
  'tidak boleh menjanjikan',
  'waspadai promosi',
  'literasi produk',
  'membahas bahaya',
  'mengkritisi klaim',
  'perlu dikritisi',
  'harus dikritisi',
  'sebagai peringatan',
  'bukan menjanjikan',
  'bukan klaim promosi',
  'laporan penelitian',
  'penelitian ilmiah',
  'tinjauan kritis',
  'analisis empiris',
  'analisis toksikologi',
  'pemasaran berlebihan',
  'praktik overclaim',
  'fenomena overclaim',
  'klaim manfaat secara berlebihan',
  'tanpa didukung oleh bukti ilmiah',
  'uji klinis yang valid',
  'bukan materi promosi',
  'bukan promosi',
  'bukan iklan',
  'kewaspadaan konsumen',
  'konten disajikan secara kritis',
  'melindungi konsumen',
  'informasi yang menyesatkan',
  'nilai guna objektif',
  'promosi manipulatif',
  'penyesatan informasi',
  'klaim kesehatan palsu'
];
const WEAK_EDUCATIONAL_CONTEXT_TERMS = [
  'edukasi',
  'edukatif',
  'peringatan',
  'kritis',
  'risiko',
  'konsumen',
  'pemasaran',
  'testimoni'
];
const GLOBAL_EDUCATIONAL_CONTEXT_TERMS = [
  'laporan penelitian',
  'ringkasan dari laporan penelitian',
  'penelitian ilmiah',
  'tinjauan kritis',
  'dokumen ini adalah ringkasan',
  'bukan materi promosi',
  'bukan promosi',
  'bukan iklan',
  'konten disajikan secara kritis',
  'kewaspadaan konsumen',
  'fenomena pemasaran berlebihan',
  'praktik overclaim',
  'overclaim produk',
  'tanpa didukung oleh bukti ilmiah',
  'uji klinis yang valid',
  'melindungi konsumen',
  'informasi yang menyesatkan',
  'penyesatan informasi',
  'promosi manipulatif',
  'klaim kesehatan palsu'
];
const DIRECT_PROMOTIONAL_CONTEXT_TERMS = [
  'produk ini',
  'produk kami',
  'setelah konsumsi',
  'setelah minum',
  'setelah pakai',
  'konsumsi produk',
  'gunakan produk',
  'beli produk',
  'ampuh',
  'garansi',
  'dijamin',
  'terbukti menyembuhkan',
  'memberi hasil instan',
  'memberikan hasil instan',
  'mendapat hasil instan'
];
const RISK_CONTEXT_WINDOW = 260;

const state = {
  initialized: false,
  articles: [],
  editingId: null,
  slugTouched: false,
  selectedBannerFile: null,
  previewObjectUrl: null
};

if (articleApp) {
  window.addEventListener('vitanusa:admin-ready', initArticleCrud);

  if (window.vitaNusaAdmin?.user) {
    initArticleCrud();
  }
}

function initArticleCrud() {
  if (state.initialized) return;
  state.initialized = true;

  const form = getForm();
  const titleInput = form?.elements.title;
  const slugInput = form?.elements.slug;
  const contentInput = form?.elements.contentHtml;
  const bannerInput = getBannerInput();

  initDisclaimerHelper();

  document.querySelector('[data-article-new]')?.addEventListener('click', () => resetForm());
  document.querySelector('[data-article-refresh]')?.addEventListener('click', () => loadArticles());
  document.querySelector('[data-article-reset]')?.addEventListener('click', () => resetForm());
  document.querySelector('[data-article-list]')?.addEventListener('click', handleListAction);
  document.querySelector('[data-banner-clear]')?.addEventListener('click', clearBannerSelection);
  form?.addEventListener('submit', handleSaveArticle);

  contentInput?.addEventListener('input', updateDisclaimerStatus);
  bannerInput?.addEventListener('change', handleBannerSelection);

  titleInput?.addEventListener('input', () => {
    if (!state.slugTouched && slugInput) {
      slugInput.value = normalizeSlug(titleInput.value);
    }
  });

  slugInput?.addEventListener('input', () => {
    state.slugTouched = true;
  });

  slugInput?.addEventListener('blur', () => {
    slugInput.value = normalizeSlug(slugInput.value);
  });

  resetForm();
  loadArticles();
}

function getForm() {
  return document.querySelector('[data-article-form]');
}

function getListBody() {
  return document.querySelector('[data-article-list]');
}

function getBannerInput() {
  return document.querySelector('[data-banner-file]');
}

function getPreviewBox() {
  return document.querySelector('[data-banner-preview]');
}

function getPreviewImage() {
  return document.querySelector('[data-banner-preview-image]');
}

function setMessage(kind, message) {
  const box = document.querySelector('[data-article-message]');
  if (!box) return;

  box.hidden = false;
  box.classList.remove('is-error', 'is-warning');
  if (kind !== 'success') box.classList.add(`is-${kind}`);
  box.textContent = message;
}

function clearMessage() {
  const box = document.querySelector('[data-article-message]');
  if (!box) return;
  box.hidden = true;
  box.textContent = '';
  box.classList.remove('is-error', 'is-warning');
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizePlainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagsToInput(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  const timestamp = getTimestampValue(value);
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

async function loadArticles() {
  const body = getListBody();
  if (body) {
    body.replaceChildren(createEmptyRow('Memuat artikel...'));
  }

  try {
    const snapshot = await getDocs(collection(db, 'articles'));
    state.articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => getTimestampValue(b.updatedAt) - getTimestampValue(a.updatedAt));

    renderArticles();
    clearMessage();
  } catch (error) {
    console.error('Gagal memuat artikel dari Firestore:', error);
    const message = 'Gagal memuat artikel. Periksa Firestore rules dan pastikan rules sudah dipublish/deploy ke Firebase.';
    if (body) body.replaceChildren(createEmptyRow(message));
    setMessage('error', message);
  }
}

function renderArticles() {
  const body = getListBody();
  if (!body) return;

  if (!state.articles.length) {
    body.replaceChildren(createEmptyRow('Belum ada artikel di Firestore.'));
    return;
  }

  const rows = state.articles.map((article) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    const statusCell = document.createElement('td');
    const categoryCell = document.createElement('td');
    const updatedCell = document.createElement('td');
    const actionCell = document.createElement('td');

    titleCell.className = 'article-title-cell';
    titleCell.dataset.label = 'Artikel';
    statusCell.dataset.label = 'Status';
    categoryCell.dataset.label = 'Kategori';
    updatedCell.dataset.label = 'Update';
    actionCell.dataset.label = 'Aksi';

    titleCell.append(createStrong(article.title || '(tanpa judul)'));
    titleCell.append(createSmall(article.slug || '-'));

    if (article.bannerUrl) {
      const bannerFlag = createSmall('Banner: tersedia');
      bannerFlag.className = 'article-meta-muted article-banner-flag';
      titleCell.append(bannerFlag);
    }

    statusCell.append(createStatusBadge(article.status));
    categoryCell.textContent = article.category || '-';
    updatedCell.textContent = formatDate(article.updatedAt || article.createdAt);

    const actions = document.createElement('div');
    actions.className = 'article-row-actions';
    actions.append(createActionButton('Edit', 'edit', article.id));

    if (article.status !== 'published') {
      actions.append(createActionButton('Publish', 'publish', article.id));
    }

    if (article.status !== 'archived') {
      actions.append(createActionButton('Archive', 'archive', article.id));
    }

    actionCell.append(actions);
    row.append(titleCell, statusCell, categoryCell, updatedCell, actionCell);
    return row;
  });

  body.replaceChildren(...rows);
}

function createEmptyRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'article-meta-muted';
  cell.textContent = message;
  row.append(cell);
  return row;
}

function createStrong(text) {
  const strong = document.createElement('strong');
  strong.textContent = text;
  return strong;
}

function createSmall(text) {
  const small = document.createElement('small');
  small.textContent = text;
  return small;
}

function createStatusBadge(status) {
  const normalized = VALID_STATUSES.has(status) ? status : 'draft';
  const badge = document.createElement('span');
  badge.className = `article-status article-status-${normalized}`;
  badge.textContent = normalized;
  return badge;
}

function createActionButton(label, action, id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-button article-action-button';
  button.dataset.articleAction = action;
  button.dataset.articleId = id;
  button.textContent = label;
  return button;
}

async function handleListAction(event) {
  const button = event.target.closest('[data-article-action]');
  if (!button) return;

  const article = state.articles.find((item) => item.id === button.dataset.articleId);
  if (!article) return;

  if (button.dataset.articleAction === 'edit') {
    fillForm(article);
    return;
  }

  if (button.dataset.articleAction === 'publish') {
    await publishArticle(article);
    return;
  }

  if (button.dataset.articleAction === 'archive') {
    await archiveArticle(article);
  }
}

function getPayloadFromForm() {
  const form = getForm();
  const formData = new FormData(form);
  const status = String(formData.get('status') || 'draft');

  return {
    title: String(formData.get('title') || '').trim(),
    slug: normalizeSlug(formData.get('slug')),
    status: VALID_STATUSES.has(status) ? status : 'draft',
    category: String(formData.get('category') || '').trim(),
    summary: String(formData.get('summary') || '').trim(),
    contentHtml: String(formData.get('contentHtml') || '').trim(),
    bannerUrl: String(formData.get('bannerUrl') || '').trim(),
    pdfUrl: String(formData.get('pdfUrl') || '').trim(),
    readTime: String(formData.get('readTime') || '').trim(),
    tags: parseTags(formData.get('tags'))
  };
}

function validateArticle(payload, currentId = null) {
  const errors = [];
  const warnings = [];
  const riskAnalysis = analyzeRiskContext(`${payload.summary} ${payload.contentHtml}`);
  const missingDisclaimer = !hasRequiredDisclaimer(payload.contentHtml);

  if (!payload.title) errors.push('Title wajib diisi.');
  if (!payload.slug) errors.push('Slug wajib diisi.');
  if (payload.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    errors.push('Slug hanya boleh huruf kecil, angka, dan tanda minus.');
  }
  if (!payload.summary) errors.push('Summary wajib diisi.');
  if (!VALID_STATUSES.has(payload.status)) errors.push('Status tidak valid.');
  if (/<\s*script/i.test(payload.contentHtml)) errors.push('Content HTML tidak boleh mengandung tag script.');

  const duplicate = state.articles.find((article) => article.slug === payload.slug && article.id !== currentId);
  if (duplicate) errors.push('Slug sudah dipakai artikel lain.');

  if (riskAnalysis.riskLevel === 'promotional') {
    warnings.push('Ditemukan klaim berisiko yang terdengar seperti promosi kesehatan. Hindari klaim sembuh, hasil pasti, atau manfaat berlebihan.');
  }

  if (riskAnalysis.riskLevel === 'educational') {
    warnings.push('Artikel mengandung istilah berisiko dalam konteks edukasi. Pastikan kalimatnya membahas bahaya klaim, bukan menjanjikan hasil.');
  }

  if (missingDisclaimer) {
    warnings.push('Disclaimer edukasi kesehatan wajib ditambahkan sebelum artikel bisa dipublish.');
  }

  const forceDraft = payload.status === 'published' && (missingDisclaimer || riskAnalysis.riskLevel === 'promotional');

  return {
    errors,
    warnings,
    riskTerms: riskAnalysis.riskTerms,
    riskLevel: riskAnalysis.riskLevel,
    missingDisclaimer,
    forceDraft
  };
}

function validateBannerFile(file) {
  if (!file) return [];
  const errors = [];

  if (!ALLOWED_BANNER_TYPES.has(file.type)) {
    errors.push('Banner harus berupa gambar JPG, PNG, atau WEBP.');
  }

  if (file.size > MAX_BANNER_BYTES) {
    errors.push('Ukuran banner maksimal 2MB.');
  }

  return errors;
}

function findRiskTerms(text) {
  const lowerText = normalizePlainText(text);
  return RISK_TERMS.filter((term) => lowerText.includes(term));
}

function analyzeRiskContext(text) {
  const normalizedText = normalizePlainText(text);
  const riskTerms = findRiskTerms(normalizedText);

  if (!riskTerms.length) {
    return {
      riskTerms,
      riskLevel: 'none'
    };
  }

  return {
    riskTerms,
    riskLevel: isEducationalRiskContext(normalizedText, riskTerms) ? 'educational' : 'promotional'
  };
}

function isEducationalRiskContext(text, riskTerms) {
  if (hasDirectPromotionalRiskCue(text, riskTerms)) return false;

  const everyRiskWindowHasEducationalCue = riskTerms.every((term) => {
    const windows = getRiskTermWindows(text, term);
    return windows.length > 0 && windows.every((windowText) => hasEducationalCue(windowText));
  });

  return everyRiskWindowHasEducationalCue || hasGlobalEducationalContext(text);
}

function getRiskTermWindows(text, term) {
  const windows = [];
  let searchStart = 0;

  while (searchStart < text.length) {
    const index = text.indexOf(term, searchStart);
    if (index === -1) break;

    windows.push(text.slice(
      Math.max(0, index - RISK_CONTEXT_WINDOW),
      Math.min(text.length, index + term.length + RISK_CONTEXT_WINDOW)
    ));
    searchStart = index + term.length;
  }

  return windows;
}

function hasEducationalCue(text) {
  const hasStrongCue = EDUCATIONAL_CONTEXT_TERMS.some((term) => text.includes(term));
  if (hasStrongCue) return true;

  const hasWeakCue = WEAK_EDUCATIONAL_CONTEXT_TERMS.some((term) => text.includes(term));
  const hasDirectPromotion = DIRECT_PROMOTIONAL_CONTEXT_TERMS.some((term) => text.includes(term));
  return hasWeakCue && !hasDirectPromotion;
}

function hasGlobalEducationalContext(text) {
  return GLOBAL_EDUCATIONAL_CONTEXT_TERMS.some((term) => text.includes(term));
}

function hasDirectPromotionalRiskCue(text, riskTerms) {
  return riskTerms.some((term) => {
    const windows = getRiskTermWindows(text, term);
    return windows.some((windowText) => {
      const hasDirectPromotion = DIRECT_PROMOTIONAL_CONTEXT_TERMS.some((cue) => windowText.includes(cue));
      return hasDirectPromotion && !hasEducationalCue(windowText);
    });
  });
}

function hasRequiredDisclaimer(contentHtml) {
  return normalizePlainText(contentHtml).includes(normalizePlainText(REQUIRED_DISCLAIMER));
}

function getValidationMessage(validation, fallback = '') {
  const parts = [...validation.errors, ...validation.warnings];
  if (fallback) parts.push(fallback);
  return parts.filter(Boolean).join(' ');
}

async function handleSaveArticle(event) {
  event.preventDefault();
  clearMessage();

  const payload = getPayloadFromForm();
  const currentId = state.editingId;
  const existing = state.articles.find((article) => article.id === currentId);
  const validation = validateArticle(payload, currentId);
  const bannerUploadDisabled = Boolean(state.selectedBannerFile);

  if (validation.errors.length) {
    setMessage('error', validation.errors.join(' '));
    return;
  }

  let forcedDraft = false;
  if (validation.forceDraft) {
    payload.status = 'draft';
    forcedDraft = true;
  }

  const writePayload = {
    ...payload,
    updatedAt: serverTimestamp()
  };

  if (payload.status === 'published' && existing?.status !== 'published') {
    writePayload.publishedAt = serverTimestamp();
  }

  if (payload.status !== 'published') {
    writePayload.publishedAt = null;
  }

  try {
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;

    if (currentId) {
      await updateDoc(doc(db, 'articles', currentId), writePayload);
    } else {
      await addDoc(collection(db, 'articles'), {
        ...writePayload,
        createdAt: serverTimestamp()
      });
    }

    if (submitButton) submitButton.disabled = false;
    await loadArticles();
    resetForm();

    const bannerMessage = bannerUploadDisabled
      ? ' Upload banner via Firebase Storage sedang nonaktif; artikel memakai Banner URL manual.'
      : '';

    if (forcedDraft) {
      setMessage('warning', `${getValidationMessage(validation)} Artikel disimpan sebagai draft, bukan published.${bannerMessage}`);
      return;
    }

    if (validation.warnings.length) {
      setMessage('warning', `${validation.warnings.join(' ')} Artikel tersimpan sebagai ${payload.status}.${bannerMessage}`);
      return;
    }

    setMessage('success', `Artikel berhasil disimpan sebagai ${payload.status}.${bannerMessage}`);
  } catch (error) {
    console.error('Gagal menyimpan artikel:', error);
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = false;
    setMessage('error', error.message || 'Gagal menyimpan artikel.');
  }
}

function initDisclaimerHelper() {
  const form = getForm();
  const contentInput = form?.elements.contentHtml;
  if (!contentInput || document.querySelector('[data-article-disclaimer-helper]')) return;

  const helper = document.createElement('div');
  helper.className = 'article-disclaimer-helper';
  helper.dataset.articleDisclaimerHelper = '';
  helper.innerHTML = `
    <div class="article-disclaimer-copy">
      <strong>Disclaimer wajib</strong>
      <p>${REQUIRED_DISCLAIMER}</p>
    </div>
    <p class="article-disclaimer-status" data-article-disclaimer-status></p>
    <div class="article-disclaimer-actions">
      <button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-add-disclaimer>Tambahkan Disclaimer</button>
      <button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-copy-disclaimer>Salin disclaimer wajib</button>
    </div>
  `;

  const helpText = contentInput.closest('label')?.nextElementSibling;
  if (helpText?.classList.contains('article-help')) {
    helpText.after(helper);
  } else {
    contentInput.closest('label')?.after(helper);
  }

  helper.querySelector('[data-article-add-disclaimer]')?.addEventListener('click', appendRequiredDisclaimer);
  helper.querySelector('[data-article-copy-disclaimer]')?.addEventListener('click', copyRequiredDisclaimer);
  updateDisclaimerStatus();
}

function updateDisclaimerStatus() {
  const form = getForm();
  const status = document.querySelector('[data-article-disclaimer-status]');
  if (!form || !status) return;

  const hasDisclaimer = hasRequiredDisclaimer(form.elements.contentHtml?.value || '');
  status.classList.toggle('is-ok', hasDisclaimer);
  status.classList.toggle('is-missing', !hasDisclaimer);
  status.textContent = hasDisclaimer
    ? 'Disclaimer wajib sudah ada di Content HTML.'
    : 'Disclaimer wajib belum ada. Artikel published akan ditahan sebagai draft sampai disclaimer ditambahkan.';
}

function appendRequiredDisclaimer() {
  const form = getForm();
  const contentInput = form?.elements.contentHtml;
  if (!contentInput) return;

  if (hasRequiredDisclaimer(contentInput.value)) {
    updateDisclaimerStatus();
    setMessage('success', 'Disclaimer wajib sudah ada di Content HTML.');
    return;
  }

  const currentContent = contentInput.value.trim();
  const separator = currentContent ? '\n\n' : '';
  contentInput.value = `${currentContent}${separator}<p>${REQUIRED_DISCLAIMER}</p>`;
  contentInput.focus();
  updateDisclaimerStatus();
  setMessage('success', 'Disclaimer wajib berhasil ditambahkan ke Content HTML.');
}

async function copyRequiredDisclaimer() {
  try {
    await navigator.clipboard.writeText(REQUIRED_DISCLAIMER);
    setMessage('success', 'Disclaimer wajib berhasil disalin.');
  } catch (error) {
    console.warn('Gagal menyalin disclaimer:', error);
    setMessage('warning', 'Gagal menyalin otomatis. Silakan salin teks disclaimer wajib yang tampil di bawah Content HTML.');
  }
}

function handleBannerSelection(event) {
  const file = event.target.files?.[0] || null;
  state.selectedBannerFile = file;

  if (!file) {
    hideBannerPreview();
    return;
  }

  const errors = validateBannerFile(file);
  if (errors.length) {
    setMessage('error', errors.join(' '));
    clearBannerSelection();
    return;
  }

  showBannerPreview(URL.createObjectURL(file));
}

function showBannerPreview(url) {
  hideBannerPreview();
  state.previewObjectUrl = url;

  const previewBox = getPreviewBox();
  const previewImage = getPreviewImage();
  if (!previewBox || !previewImage) return;

  previewImage.src = url;
  previewBox.hidden = false;
}

function showExistingBannerPreview(url) {
  hideBannerPreview();

  const previewBox = getPreviewBox();
  const previewImage = getPreviewImage();
  if (!previewBox || !previewImage || !url) return;

  previewImage.src = url;
  previewBox.hidden = false;
}

function hideBannerPreview() {
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }

  const previewBox = getPreviewBox();
  const previewImage = getPreviewImage();
  if (previewImage) previewImage.removeAttribute('src');
  if (previewBox) previewBox.hidden = true;
}

function clearBannerSelection() {
  const input = getBannerInput();
  if (input) input.value = '';
  state.selectedBannerFile = null;
  hideBannerPreview();
}

function fillForm(article) {
  const form = getForm();
  if (!form) return;

  state.editingId = article.id;
  state.slugTouched = true;
  state.selectedBannerFile = null;

  form.elements.articleId.value = article.id;
  form.elements.title.value = article.title || '';
  form.elements.slug.value = article.slug || '';
  form.elements.category.value = article.category || '';
  form.elements.summary.value = article.summary || '';
  form.elements.contentHtml.value = article.contentHtml || '';
  form.elements.bannerUrl.value = article.bannerUrl || '';
  form.elements.pdfUrl.value = article.pdfUrl || '';
  form.elements.readTime.value = article.readTime || '';
  form.elements.tags.value = tagsToInput(article.tags);
  form.elements.status.value = VALID_STATUSES.has(article.status) ? article.status : 'draft';
  if (form.elements.bannerFile) form.elements.bannerFile.value = '';

  if (article.bannerUrl) {
    showExistingBannerPreview(article.bannerUrl);
  } else {
    hideBannerPreview();
  }

  updateDisclaimerStatus();
  document.querySelector('[data-article-form-title]').textContent = 'Edit Artikel';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  const form = getForm();
  if (!form) return;

  state.editingId = null;
  state.slugTouched = false;
  state.selectedBannerFile = null;
  form.reset();
  form.elements.status.value = 'draft';
  form.elements.contentHtml.value = `<p>${REQUIRED_DISCLAIMER}</p>`;
  if (form.elements.bannerFile) form.elements.bannerFile.value = '';
  hideBannerPreview();
  updateDisclaimerStatus();
  document.querySelector('[data-article-form-title]').textContent = 'Tambah Artikel';
}

async function publishArticle(article) {
  const validation = validateArticle({
    title: article.title || '',
    slug: article.slug || '',
    status: 'published',
    summary: article.summary || '',
    contentHtml: article.contentHtml || ''
  }, article.id);

  if (validation.errors.length) {
    setMessage('error', validation.errors.join(' '));
    return;
  }

  if (validation.forceDraft) {
    const message = getValidationMessage(validation, 'Artikel tidak dipublish. Perbaiki konten lalu simpan ulang.');
    setMessage('warning', message);
    return;
  }

  try {
    const updatePayload = {
      status: 'published',
      updatedAt: serverTimestamp()
    };

    if (article.status !== 'published') {
      updatePayload.publishedAt = serverTimestamp();
    }

    await updateDoc(doc(db, 'articles', article.id), updatePayload);
    await loadArticles();

    if (validation.warnings.length) {
      setMessage('warning', `Artikel berhasil dipublish. ${validation.warnings.join(' ')}`);
      return;
    }

    setMessage('success', 'Artikel berhasil dipublish.');
  } catch (error) {
    setMessage('error', error.message || 'Gagal publish artikel.');
  }
}

async function archiveArticle(article) {
  const confirmed = window.confirm(`Archive artikel "${article.title || article.slug}"? Artikel tidak akan dihapus.`);
  if (!confirmed) return;

  try {
    await updateDoc(doc(db, 'articles', article.id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
      publishedAt: null
    });
    await loadArticles();
    setMessage('success', 'Artikel berhasil di-archive.');
  } catch (error) {
    setMessage('error', error.message || 'Gagal archive artikel.');
  }
}
