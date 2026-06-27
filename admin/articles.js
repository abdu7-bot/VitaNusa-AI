import { db } from './firebase-auth.js';
import { collection, addDoc, doc, getDocs, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const articleApp = document.querySelector('[data-article-app]');
const REQUIRED_DISCLAIMER = 'Konten ini bersifat edukasi dan refleksi, bukan diagnosis medis. Untuk keluhan serius, segera konsultasikan kepada tenaga kesehatan profesional.';
const VALID_STATUSES = new Set(['draft', 'published', 'archived']);
const VALID_INTENT_TARGETS = new Set(['general-health', 'habit', 'vitacheck', 'testimonial', 'product-claim', 'product-safety', 'product-general', 'serious-complaint-education', 'islamic-reflection', 'amanah', 'article-general']);
const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_CONTENT_DEPTHS = new Set(['basic', 'intermediate', 'deep']);
const VALID_PRIMARY_ACTIONS = new Set(['read-article', 'start-vitacheck', 'read-prinsip-amanah', 'contact-admin', 'seek-professional-help', 'view-products']);
const MAX_BANNER_BYTES = 2 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const textJoin = (...parts) => parts.join('');
const RISK_TERMS = [
  textJoin('pa', 'sti se', 'mbuh'),
  textJoin('100', '% am', 'an'),
  textJoin('obat seg', 'ala peny', 'akit'),
  textJoin('se', 'mbuh to', 'tal'),
  textJoin('hasil ins', 'tan'),
  textJoin('tanpa efek sam', 'ping'),
  textJoin('menyem', 'buhkan kan', 'ker'),
  textJoin('menyem', 'buhkan dia', 'betes'),
  textJoin('menyem', 'buhkan penyakit kro', 'nis'),
  textJoin('menyem', 'buhkan peny', 'akit')
];
const FATWA_FINAL_TERMS = ['hukum final', 'fatwa final', 'wajib secara mutlak', 'haram secara mutlak', 'pasti halal', 'pasti haram', 'menurut islam pasti'];
const IMPORT_SECTION_ALIASES = Object.freeze({
  judul: 'title',
  slug: 'slug',
  summary: 'summary',
  'metadata tambahan': 'metadata',
  'html artikel': 'contentHtml',
  'catatan review amanah': 'reviewNote'
});
const METADATA_FIELD_ALIASES = Object.freeze({
  status: 'status',
  category: 'category',
  kategori: 'category',
  tags: 'tags',
  tag: 'tags',
  intenttarget: 'intentTarget',
  risklevel: 'riskLevel',
  ismedicalsensitive: 'isMedicalSensitive',
  medicalsensitive: 'isMedicalSensitive',
  isproductsensitive: 'isProductSensitive',
  productsensitive: 'isProductSensitive',
  isislamicsensitive: 'isIslamicSensitive',
  islamicsensitive: 'isIslamicSensitive',
  relatedarticles: 'relatedArticles',
  artikelterkait: 'relatedArticles',
  contentdepth: 'contentDepth',
  primaryaction: 'primaryAction',
  reviewernote: 'reviewerNote',
  catatanreviewer: 'reviewerNote'
});
const ISLAMIC_IMPORT_TERMS = ['ayat al-qur', 'ayat al qur', 'al-qur', 'al qur', 'alquran', 'hadits', 'hadis', 'fatwa', 'hukum islam', 'tawakal', 'ikhtiar'];
const MEDICAL_IMPORT_TERMS = ['diagnosis', 'gejala berat', 'penyakit', 'obat', 'dosis', 'tenaga kesehatan'];
const PRODUCT_IMPORT_TERMS = ['klaim produk', 'testimoni', 'hasil instan', 'pasti sembuh', 'produk'];
const DEFAULT_METADATA = Object.freeze({ intentTarget: 'article-general', riskLevel: 'low', isMedicalSensitive: false, isProductSensitive: false, isIslamicSensitive: false, relatedArticles: [], contentDepth: 'basic', primaryAction: 'read-article', reviewerNote: '' });
const state = { initialized: false, articles: [], editingId: null, slugTouched: false, selectedBannerFile: null, previewObjectUrl: null };

if (articleApp) {
  window.addEventListener('vitanusa:admin-ready', initArticleCrud);
  if (window.vitaNusaAdmin?.user) initArticleCrud();
}

function initArticleCrud() {
  if (state.initialized) return;
  state.initialized = true;
  const form = getForm();
  const titleInput = form?.elements.title;
  const slugInput = form?.elements.slug;
  const contentInput = form?.elements.contentHtml;
  const bannerInput = getBannerInput();

  initArticleImport();
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
    if (!state.slugTouched && slugInput) slugInput.value = normalizeSlug(titleInput.value);
  });
  slugInput?.addEventListener('input', () => { state.slugTouched = true; });
  slugInput?.addEventListener('blur', () => { slugInput.value = normalizeSlug(slugInput.value); });

  resetForm();
  loadArticles();
}

function getForm() { return document.querySelector('[data-article-form]'); }
function getListBody() { return document.querySelector('[data-article-list]'); }
function getBannerInput() { return document.querySelector('[data-banner-file]'); }
function getPreviewBox() { return document.querySelector('[data-banner-preview]'); }
function getPreviewImage() { return document.querySelector('[data-banner-preview-image]'); }
function getImportTextarea() { return document.querySelector('[data-article-import-text]'); }
function getImportStatusBox() { return document.querySelector('[data-article-import-status]'); }
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
function setImportStatus(kind, message, warnings = []) {
  const box = getImportStatusBox();
  if (!box) return;
  const parts = [message, ...warnings].filter(Boolean);
  box.hidden = false;
  box.classList.remove('is-error', 'is-warning', 'is-success');
  box.classList.add(`is-${kind}`);
  box.textContent = parts.join(' ');
}
function clearImportStatus() {
  const box = getImportStatusBox();
  if (!box) return;
  box.hidden = true;
  box.textContent = '';
  box.classList.remove('is-error', 'is-warning', 'is-success');
}
function normalizeSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
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
function parseCsv(value) {
  return String(value || '').split(',').map((item) => normalizeSlug(item.trim()) || item.trim()).map((item) => item.trim()).filter(Boolean);
}
function parseTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function arrayToInput(value) { return Array.isArray(value) ? value.join(', ') : ''; }
function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return 0;
}
function formatDate(value) {
  const timestamp = getTimestampValue(value);
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}
function safeValue(set, value, fallback) {
  const normalized = String(value || fallback).trim();
  return set.has(normalized) ? normalized : fallback;
}
function safeBool(value) { return value === true; }
function withMetadataDefaults(article = {}) {
  return {
    ...article,
    intentTarget: safeValue(VALID_INTENT_TARGETS, article.intentTarget, DEFAULT_METADATA.intentTarget),
    riskLevel: safeValue(VALID_RISK_LEVELS, article.riskLevel, DEFAULT_METADATA.riskLevel),
    isMedicalSensitive: safeBool(article.isMedicalSensitive),
    isProductSensitive: safeBool(article.isProductSensitive),
    isIslamicSensitive: safeBool(article.isIslamicSensitive),
    relatedArticles: Array.isArray(article.relatedArticles) ? article.relatedArticles : DEFAULT_METADATA.relatedArticles,
    contentDepth: safeValue(VALID_CONTENT_DEPTHS, article.contentDepth, DEFAULT_METADATA.contentDepth),
    primaryAction: safeValue(VALID_PRIMARY_ACTIONS, article.primaryAction, DEFAULT_METADATA.primaryAction),
    reviewerNote: String(article.reviewerNote || DEFAULT_METADATA.reviewerNote)
  };
}

async function loadArticles() {
  const body = getListBody();
  if (body) body.replaceChildren(createEmptyRow('Memuat artikel...'));
  try {
    const snapshot = await getDocs(collection(db, 'articles'));
    state.articles = snapshot.docs.map((item) => withMetadataDefaults({ id: item.id, ...item.data() })).sort((a, b) => getTimestampValue(b.updatedAt) - getTimestampValue(a.updatedAt));
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
    titleCell.append(createSmall(`Intent: ${article.intentTarget} • Risk: ${article.riskLevel}`));
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
    if (article.status !== 'published') actions.append(createActionButton('Publish', 'publish', article.id));
    if (article.status !== 'archived') actions.append(createActionButton('Archive', 'archive', article.id));
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
  const normalized = safeValue(VALID_STATUSES, status, 'draft');
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
  if (button.dataset.articleAction === 'archive') await archiveArticle(article);
}

function getPayloadFromForm() {
  const form = getForm();
  const formData = new FormData(form);
  const status = String(formData.get('status') || 'draft');
  return withMetadataDefaults({
    title: String(formData.get('title') || '').trim(),
    slug: normalizeSlug(formData.get('slug')),
    status: safeValue(VALID_STATUSES, status, 'draft'),
    category: String(formData.get('category') || '').trim(),
    summary: String(formData.get('summary') || '').trim(),
    contentHtml: String(formData.get('contentHtml') || '').trim(),
    bannerUrl: String(formData.get('bannerUrl') || '').trim(),
    pdfUrl: String(formData.get('pdfUrl') || '').trim(),
    readTime: String(formData.get('readTime') || '').trim(),
    tags: parseTags(formData.get('tags')),
    intentTarget: String(formData.get('intentTarget') || DEFAULT_METADATA.intentTarget).trim(),
    riskLevel: String(formData.get('riskLevel') || DEFAULT_METADATA.riskLevel).trim(),
    isMedicalSensitive: form.elements.isMedicalSensitive?.checked === true,
    isProductSensitive: form.elements.isProductSensitive?.checked === true,
    isIslamicSensitive: form.elements.isIslamicSensitive?.checked === true,
    relatedArticles: parseCsv(formData.get('relatedArticles')),
    contentDepth: String(formData.get('contentDepth') || DEFAULT_METADATA.contentDepth).trim(),
    primaryAction: String(formData.get('primaryAction') || DEFAULT_METADATA.primaryAction).trim(),
    reviewerNote: String(formData.get('reviewerNote') || '').trim()
  });
}

function validateArticle(payload, currentId = null) {
  const errors = [];
  const warnings = [];
  const normalizedBody = normalizePlainText(`${payload.summary} ${payload.contentHtml}`);
  const missingDisclaimer = !hasRequiredDisclaimer(payload.contentHtml);
  const riskTerms = RISK_TERMS.filter((term) => normalizedBody.includes(term));
  const hasPromotionalRisk = riskTerms.length > 0;
  const hasFatwaFinalCue = FATWA_FINAL_TERMS.some((term) => normalizedBody.includes(term));

  if (!payload.title) errors.push('Title wajib diisi.');
  if (!payload.slug) errors.push('Slug wajib diisi.');
  if (payload.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) errors.push('Slug hanya boleh huruf kecil, angka, dan tanda minus.');
  if (!payload.summary) errors.push('Summary wajib diisi.');
  if (!VALID_STATUSES.has(payload.status)) errors.push('Status tidak valid.');
  if (!VALID_INTENT_TARGETS.has(payload.intentTarget)) errors.push('Intent Target tidak valid.');
  if (!VALID_RISK_LEVELS.has(payload.riskLevel)) errors.push('Risk Level tidak valid.');
  if (!VALID_CONTENT_DEPTHS.has(payload.contentDepth)) errors.push('Content Depth tidak valid.');
  if (!VALID_PRIMARY_ACTIONS.has(payload.primaryAction)) errors.push('Primary Action tidak valid.');
  if (/<\s*script/i.test(payload.contentHtml)) errors.push('Content HTML tidak boleh mengandung tag script.');

  const duplicate = state.articles.find((article) => article.slug === payload.slug && article.id !== currentId);
  if (duplicate) errors.push('Slug sudah dipakai artikel lain.');

  if (missingDisclaimer) warnings.push('Disclaimer edukasi kesehatan wajib ditambahkan sebelum artikel bisa dipublish.');
  if (hasPromotionalRisk) warnings.push('Ditemukan klaim berisiko. Hindari klaim hasil mutlak, hasil cepat, atau manfaat berlebihan.');
  if (payload.isMedicalSensitive && payload.primaryAction === 'view-products') warnings.push('Artikel medical sensitive tidak boleh langsung mengarah ke view-products.');
  if (payload.riskLevel === 'high' && missingDisclaimer) warnings.push('Artikel high risk wajib punya disclaimer edukasi sebelum publish.');
  if (payload.isProductSensitive && hasPromotionalRisk) warnings.push('Artikel product sensitive mengandung klaim berisiko. Sistem menahan publish agar dikritisi ulang.');
  if (payload.isIslamicSensitive && hasFatwaFinalCue) warnings.push('Artikel Islamic sensitive terdengar seperti fatwa final. Rujukkan hukum rinci kepada ustadz/ulama kompeten.');

  const forceDraft = payload.status === 'published' && (hasPromotionalRisk || (payload.isMedicalSensitive && payload.primaryAction === 'view-products') || (payload.riskLevel === 'high' && missingDisclaimer) || (payload.isProductSensitive && hasPromotionalRisk));
  return { errors, warnings, riskTerms, missingDisclaimer, forceDraft };
}

function initArticleImport() {
  const parseButton = document.querySelector('[data-article-import-parse]');
  const clearButton = document.querySelector('[data-article-import-clear]');
  parseButton?.addEventListener('click', handleArticleImportParse);
  clearButton?.addEventListener('click', clearArticleImport);
}
function clearArticleImport() {
  const textarea = getImportTextarea();
  if (textarea) textarea.value = '';
  clearImportStatus();
}
function handleArticleImportParse() {
  clearImportStatus();
  clearMessage();

  const rawText = getImportTextarea()?.value || '';
  if (!rawText.trim()) {
    setImportStatus('error', 'Import artikel masih kosong.');
    return;
  }

  try {
    const parsed = parseArticleImportText(rawText);
    applyImportedArticleToForm(parsed);
    const message = 'Artikel berhasil diparse ke form. Silakan review ulang sebelum simpan.';
    setImportStatus(parsed.warnings.length ? 'warning' : 'success', message, parsed.warnings);
  } catch (error) {
    setImportStatus('error', error.message || 'Format import tidak terbaca.');
  }
}
function parseArticleImportText(rawText) {
  const sections = extractImportSections(rawText);
  const title = cleanImportSection(sections.title);
  const slug = normalizeSlug(cleanImportSection(sections.slug));
  const summary = cleanImportSection(sections.summary);
  const contentHtml = cleanImportSection(sections.contentHtml);
  const reviewNote = cleanImportSection(sections.reviewNote);
  const metadata = parseImportMetadata(cleanImportSection(sections.metadata));
  const warnings = [];

  if (!title) throw new Error('Judul tidak ditemukan.');
  if (!contentHtml) throw new Error('Section HTML ARTIKEL tidak ditemukan.');

  const imported = {
    title,
    slug: slug || normalizeSlug(title),
    summary,
    contentHtml,
    status: safeValue(VALID_STATUSES, metadata.status || 'draft', 'draft'),
    category: String(metadata.category || '').trim(),
    tags: String(metadata.tags || '').trim(),
    intentTarget: safeValue(VALID_INTENT_TARGETS, metadata.intentTarget || DEFAULT_METADATA.intentTarget, DEFAULT_METADATA.intentTarget),
    riskLevel: safeValue(VALID_RISK_LEVELS, metadata.riskLevel || DEFAULT_METADATA.riskLevel, DEFAULT_METADATA.riskLevel),
    isMedicalSensitive: parseFlexibleBool(metadata.isMedicalSensitive, DEFAULT_METADATA.isMedicalSensitive),
    isProductSensitive: parseFlexibleBool(metadata.isProductSensitive, DEFAULT_METADATA.isProductSensitive),
    isIslamicSensitive: parseFlexibleBool(metadata.isIslamicSensitive, DEFAULT_METADATA.isIslamicSensitive),
    relatedArticles: arrayToInput(parseCsv(metadata.relatedArticles || '')),
    contentDepth: safeValue(VALID_CONTENT_DEPTHS, metadata.contentDepth || DEFAULT_METADATA.contentDepth, DEFAULT_METADATA.contentDepth),
    primaryAction: safeValue(VALID_PRIMARY_ACTIONS, metadata.primaryAction || DEFAULT_METADATA.primaryAction, DEFAULT_METADATA.primaryAction),
    reviewerNote: buildImportedReviewerNote(metadata.reviewerNote, reviewNote),
    slugWasProvided: Boolean(slug),
    warnings
  };

  applyImportSensitivityRules(imported);
  return imported;
}
function extractImportSections(rawText) {
  const sections = {};
  const lines = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let currentKey = '';
  let buffer = [];

  const flush = () => {
    if (!currentKey) return;
    sections[currentKey] = cleanImportSection(buffer.join('\n'));
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^={5,}$/.test(trimmed)) continue;

    const sectionKey = IMPORT_SECTION_ALIASES[normalizeImportHeader(trimmed)];
    if (sectionKey) {
      flush();
      currentKey = sectionKey;
      buffer = [];
      continue;
    }

    if (currentKey) buffer.push(line);
  }

  flush();
  return sections;
}
function cleanImportSection(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\n?={5,}\s*$/g, '').trim();
}
function normalizeImportHeader(value) {
  return String(value || '').trim().replace(/[:：]+$/g, '').replace(/\s+/g, ' ').toLowerCase();
}
function normalizeMetadataKey(value) {
  return String(value || '').trim().replace(/[:：]+$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function parseImportMetadata(metadataText) {
  const source = String(metadataText || '').trim();
  if (!source) return {};

  const metadata = {};
  let knownPairs = 0;
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || /^={5,}$/.test(trimmed)) continue;

    const match = trimmed.match(/^([^:：]{2,80})[:：]\s*(.*)$/);
    if (!match) continue;

    const field = METADATA_FIELD_ALIASES[normalizeMetadataKey(match[1])];
    if (!field) continue;

    let value = match[2].trim();
    if (!value) {
      const collected = [];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        const nextTrimmed = nextLine.trim();
        const nextMatch = nextTrimmed.match(/^([^:：]{2,80})[:：]\s*(.*)$/);
        const nextField = nextMatch ? METADATA_FIELD_ALIASES[normalizeMetadataKey(nextMatch[1])] : null;

        if (nextField) break;
        if (!/^={5,}$/.test(nextTrimmed) && (nextTrimmed || collected.length)) collected.push(nextLine);
        cursor += 1;
      }

      value = collected.join('\n').trim();
      index = cursor - 1;
    }

    metadata[field] = value;
    knownPairs += 1;
  }

  if (!knownPairs) throw new Error('Format metadata tidak terbaca.');
  return metadata;
}
function parseFlexibleBool(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 'ya', 'iya', 'yes', '1', 'benar'].includes(normalized)) return true;
  if (['false', 'tidak', 'no', '0', 'salah'].includes(normalized)) return false;
  return fallback;
}
function buildImportedReviewerNote(metadataReviewerNote, reviewSection) {
  const parts = [];
  const metadataNote = String(metadataReviewerNote || '').trim();
  const reviewNote = String(reviewSection || '').trim();

  if (metadataNote) parts.push(metadataNote);
  if (reviewNote) parts.push(`Catatan Review Amanah:\n${reviewNote}`);

  return parts.join('\n\n');
}
function normalizeImportSensitivityText(contentHtml) {
  const normalized = normalizePlainText(contentHtml);
  const disclaimer = normalizePlainText(REQUIRED_DISCLAIMER);
  return normalized.split(disclaimer).join(' ').replace(/\s+/g, ' ').trim();
}
function applyImportSensitivityRules(imported) {
  const normalizedHtml = normalizeImportSensitivityText(imported.contentHtml);
  const hasIslamicCue = ISLAMIC_IMPORT_TERMS.some((term) => normalizedHtml.includes(term));
  const hasMedicalCue = MEDICAL_IMPORT_TERMS.some((term) => normalizedHtml.includes(term));
  const hasProductCue = PRODUCT_IMPORT_TERMS.some((term) => normalizedHtml.includes(term));

  if (hasIslamicCue) {
    imported.isIslamicSensitive = true;
    imported.status = 'draft';
    imported.warnings.push('Artikel Islami perlu review ustadz/ulama sebelum publish.');
  }

  if (hasMedicalCue) {
    imported.isMedicalSensitive = true;
    imported.status = 'draft';
    imported.warnings.push('Artikel medical sensitive perlu review.');
  }

  if (hasProductCue) {
    imported.isProductSensitive = true;
    imported.status = 'draft';
    imported.warnings.push('Artikel product sensitive perlu audit klaim.');
  }

  if (imported.primaryAction === 'view-products' && (imported.riskLevel === 'high' || imported.isMedicalSensitive || imported.isProductSensitive)) {
    imported.primaryAction = 'read-prinsip-amanah';
    imported.warnings.push('Primary Action diubah ke read-prinsip-amanah karena konten sensitif tidak boleh langsung diarahkan ke view-products.');
  }
}
function applyImportedArticleToForm(imported) {
  const form = getForm();
  if (!form) throw new Error('Form artikel tidak ditemukan.');

  resetForm();

  state.editingId = null;
  state.slugTouched = imported.slugWasProvided;
  state.selectedBannerFile = null;

  form.elements.articleId.value = '';
  form.elements.title.value = imported.title;
  form.elements.slug.value = imported.slug;
  form.elements.category.value = imported.category;
  form.elements.summary.value = imported.summary;
  form.elements.contentHtml.value = imported.contentHtml;
  form.elements.tags.value = imported.tags;
  form.elements.intentTarget.value = imported.intentTarget;
  form.elements.riskLevel.value = imported.riskLevel;
  form.elements.isMedicalSensitive.checked = imported.isMedicalSensitive;
  form.elements.isProductSensitive.checked = imported.isProductSensitive;
  form.elements.isIslamicSensitive.checked = imported.isIslamicSensitive;
  form.elements.relatedArticles.value = imported.relatedArticles;
  form.elements.contentDepth.value = imported.contentDepth;
  form.elements.primaryAction.value = imported.primaryAction;
  form.elements.reviewerNote.value = imported.reviewerNote;
  form.elements.status.value = imported.status || 'draft';

  if (form.elements.bannerFile) form.elements.bannerFile.value = '';
  hideBannerPreview();
  updateDisclaimerStatus();
  document.querySelector('[data-article-form-title]').textContent = 'Tambah Artikel';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validateBannerFile(file) {
  const errors = [];
  if (!file) return errors;
  if (!ALLOWED_BANNER_TYPES.has(file.type)) errors.push('Banner harus berupa gambar JPG, PNG, atau WEBP.');
  if (file.size > MAX_BANNER_BYTES) errors.push('Ukuran banner maksimal 2MB.');
  return errors;
}
function hasRequiredDisclaimer(contentHtml) {
  return normalizePlainText(contentHtml).includes(normalizePlainText(REQUIRED_DISCLAIMER));
}
function withRequiredDisclaimer(contentHtml) {
  const currentContent = String(contentHtml || '').trim();
  if (hasRequiredDisclaimer(currentContent)) return currentContent;
  const separator = currentContent ? '\n\n' : '';
  return `${currentContent}${separator}<p>${REQUIRED_DISCLAIMER}</p>`;
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
  let autoDisclaimerAdded = false;

  if (validation.forceDraft) {
    payload.status = 'draft';
    forcedDraft = true;
  }

  if (payload.status === 'published' && validation.missingDisclaimer && !forcedDraft) {
    payload.contentHtml = withRequiredDisclaimer(payload.contentHtml);
    autoDisclaimerAdded = true;
  }

  const writePayload = { ...payload, updatedAt: serverTimestamp() };
  if (payload.status === 'published' && existing?.status !== 'published') writePayload.publishedAt = serverTimestamp();
  if (payload.status !== 'published') writePayload.publishedAt = null;

  try {
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;

    if (currentId) await updateDoc(doc(db, 'articles', currentId), writePayload);
    else await addDoc(collection(db, 'articles'), { ...writePayload, createdAt: serverTimestamp() });

    if (submitButton) submitButton.disabled = false;
    await loadArticles();
    resetForm();

    const bannerMessage = bannerUploadDisabled ? ' Upload banner via Firebase Storage sedang nonaktif; artikel memakai Banner URL manual.' : '';
    const disclaimerMessage = autoDisclaimerAdded ? ' Disclaimer wajib otomatis ditambahkan.' : '';

    if (forcedDraft) {
      setMessage('warning', `${getValidationMessage(validation)} Artikel disimpan sebagai draft, bukan published.${bannerMessage}`);
      return;
    }

    if (validation.warnings.length) {
      setMessage('warning', `${validation.warnings.join(' ')} Artikel tersimpan sebagai ${payload.status}.${disclaimerMessage}${bannerMessage}`);
      return;
    }

    setMessage('success', `Artikel berhasil disimpan sebagai ${payload.status}.${disclaimerMessage}${bannerMessage}`);
  } catch (error) {
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = false;
    console.error('Gagal menyimpan artikel:', error);
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
  helper.innerHTML = `<div class="article-disclaimer-copy"><strong>Disclaimer wajib</strong><p>${REQUIRED_DISCLAIMER}</p></div><p class="article-disclaimer-status" data-article-disclaimer-status></p><div class="article-disclaimer-actions"><button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-add-disclaimer>Tambahkan Disclaimer</button><button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-copy-disclaimer>Salin disclaimer wajib</button></div>`;

  const helpText = contentInput.closest('label')?.nextElementSibling;
  if (helpText?.classList.contains('article-help')) helpText.after(helper);
  else contentInput.closest('label')?.after(helper);

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
  status.textContent = hasDisclaimer ? 'Disclaimer wajib sudah ada di Content HTML.' : 'Disclaimer wajib belum ada. Saat publish, sistem akan menambahkan disclaimer wajib otomatis jika riskLevel tidak high.';
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

  contentInput.value = withRequiredDisclaimer(contentInput.value);
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

  const safeArticle = withMetadataDefaults(article);
  state.editingId = safeArticle.id;
  state.slugTouched = true;
  state.selectedBannerFile = null;

  form.elements.articleId.value = safeArticle.id;
  form.elements.title.value = safeArticle.title || '';
  form.elements.slug.value = safeArticle.slug || '';
  form.elements.category.value = safeArticle.category || '';
  form.elements.summary.value = safeArticle.summary || '';
  form.elements.contentHtml.value = safeArticle.contentHtml || '';
  form.elements.bannerUrl.value = safeArticle.bannerUrl || '';
  form.elements.pdfUrl.value = safeArticle.pdfUrl || '';
  form.elements.readTime.value = safeArticle.readTime || '';
  form.elements.tags.value = arrayToInput(safeArticle.tags);
  form.elements.intentTarget.value = safeArticle.intentTarget;
  form.elements.riskLevel.value = safeArticle.riskLevel;
  form.elements.isMedicalSensitive.checked = safeArticle.isMedicalSensitive;
  form.elements.isProductSensitive.checked = safeArticle.isProductSensitive;
  form.elements.isIslamicSensitive.checked = safeArticle.isIslamicSensitive;
  form.elements.relatedArticles.value = arrayToInput(safeArticle.relatedArticles);
  form.elements.contentDepth.value = safeArticle.contentDepth;
  form.elements.primaryAction.value = safeArticle.primaryAction;
  form.elements.reviewerNote.value = safeArticle.reviewerNote;
  form.elements.status.value = safeValue(VALID_STATUSES, safeArticle.status, 'draft');

  if (form.elements.bannerFile) form.elements.bannerFile.value = '';
  if (safeArticle.bannerUrl) showExistingBannerPreview(safeArticle.bannerUrl);
  else hideBannerPreview();

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
  form.elements.intentTarget.value = DEFAULT_METADATA.intentTarget;
  form.elements.riskLevel.value = DEFAULT_METADATA.riskLevel;
  form.elements.isMedicalSensitive.checked = DEFAULT_METADATA.isMedicalSensitive;
  form.elements.isProductSensitive.checked = DEFAULT_METADATA.isProductSensitive;
  form.elements.isIslamicSensitive.checked = DEFAULT_METADATA.isIslamicSensitive;
  form.elements.relatedArticles.value = '';
  form.elements.contentDepth.value = DEFAULT_METADATA.contentDepth;
  form.elements.primaryAction.value = DEFAULT_METADATA.primaryAction;
  form.elements.reviewerNote.value = '';
  form.elements.contentHtml.value = `<p>${REQUIRED_DISCLAIMER}</p>`;
  if (form.elements.bannerFile) form.elements.bannerFile.value = '';

  hideBannerPreview();
  updateDisclaimerStatus();
  document.querySelector('[data-article-form-title]').textContent = 'Tambah Artikel';
}
async function publishArticle(article) {
  const safeArticle = withMetadataDefaults(article);
  const payload = { ...safeArticle, status: 'published', contentHtml: safeArticle.contentHtml || '' };
  const validation = validateArticle(payload, safeArticle.id);

  if (validation.errors.length) {
    setMessage('error', validation.errors.join(' '));
    return;
  }

  if (validation.forceDraft) {
    setMessage('warning', getValidationMessage(validation, 'Artikel tidak dipublish. Perbaiki konten lalu simpan ulang.'));
    return;
  }

  const publishContentHtml = validation.missingDisclaimer ? withRequiredDisclaimer(payload.contentHtml) : payload.contentHtml;

  try {
    const updatePayload = { ...withMetadataDefaults(payload), status: 'published', contentHtml: publishContentHtml, updatedAt: serverTimestamp() };
    if (safeArticle.status !== 'published') updatePayload.publishedAt = serverTimestamp();

    await updateDoc(doc(db, 'articles', safeArticle.id), updatePayload);
    await loadArticles();

    const disclaimerMessage = validation.missingDisclaimer ? ' Disclaimer wajib otomatis ditambahkan.' : '';
    if (validation.warnings.length) {
      setMessage('warning', `Artikel berhasil dipublish.${disclaimerMessage} ${validation.warnings.join(' ')}`);
      return;
    }

    setMessage('success', `Artikel berhasil dipublish.${disclaimerMessage}`);
  } catch (error) {
    setMessage('error', error.message || 'Gagal publish artikel.');
  }
}
async function archiveArticle(article) {
  const confirmed = window.confirm(`Archive artikel "${article.title || article.slug}"? Artikel tidak akan dihapus.`);
  if (!confirmed) return;

  try {
    await updateDoc(doc(db, 'articles', article.id), { status: 'archived', updatedAt: serverTimestamp(), publishedAt: null });
    await loadArticles();
    setMessage('success', 'Artikel berhasil di-archive.');
  } catch (error) {
    setMessage('error', error.message || 'Gagal archive artikel.');
  }
}
