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
const EDUCATIONAL_RISK_CONTEXT_TERMS = [
  'hindari',
  'jangan percaya',
  'jangan memakai',
  'jangan membuat',
  'jangan menulis',
  'jangan menjanjikan',
  'tidak boleh',
  'tidak berisi',
  'tidak ada',
  'tidak memberi',
  'tidak membuat',
  'tidak menjanjikan',
  'tidak menggantikan',
  'bukan diagnosis',
  'bukan terapi',
  'bukan obat',
  'bukan klaim',
  'bukan bukti',
  'belum tentu',
  'tidak otomatis',
  'tidak berarti',
  'waspada',
  'hati-hati',
  'kritisi',
  'menilai klaim',
  'klaim berlebihan',
  'klaim palsu',
  'klaim mutlak',
  'contoh klaim yang harus dihindari',
  'contoh klaim berisiko',
  'segera konsultasikan'
];
const FATWA_FINAL_TERMS = ['hukum final', 'fatwa final', 'wajib secara mutlak', 'haram secara mutlak', 'pasti halal', 'pasti haram', 'menurut islam pasti'];
const IMPORT_SECTION_ALIASES = Object.freeze({
  title: 'title',
  judul: 'title',
  slug: 'slug',
  summary: 'summary',
  ringkasan: 'summary',
  'metadata tambahan': 'metadata',
  metadata: 'metadata',
  'html artikel': 'contentHtml',
  content: 'contentHtml',
  konten: 'contentHtml',
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
  catatanreviewer: 'reviewerNote',
  userquestions: 'userQuestions',
  pertanyaanuser: 'userQuestions',
  answer: 'answerSnippet',
  answersnippet: 'answerSnippet',
  cuplikanjawaban: 'answerSnippet',
  problemtags: 'problemTags',
  masalah: 'problemTags',
  audience: 'audience',
  targetpembaca: 'audience',
  donotusefor: 'doNotUseFor',
  jangangunakanuntuk: 'doNotUseFor',
  whentoseekhelp: 'whenToSeekHelp',
  kapanmencaribantuan: 'whenToSeekHelp',
  sources: 'sources',
  sumber: 'sources',
  rujukan: 'sources'
});
const IMPORT_DISCLAIMER_PHRASES = [
  'tidak berisi diagnosis',
  'tidak ada diagnosis',
  'bukan diagnosis',
  'tidak berisi dosis',
  'tidak ada dosis',
  'bukan dosis',
  'tidak berisi obat',
  'tidak ada obat',
  'bukan obat',
  'tidak berisi terapi',
  'tidak ada terapi',
  'bukan terapi',
  'tidak berisi fatwa',
  'tidak ada fatwa',
  'bukan fatwa',
  'tidak berisi klaim produk',
  'tidak ada klaim produk',
  'bukan klaim produk',
  'tidak membahas produk',
  'tidak memakai ayat',
  'tidak ada ayat',
  'tidak memakai hadits',
  'tidak ada hadits',
  'tidak memakai hadis',
  'tidak ada hadis',
  'tidak berisi janji hasil instan',
  'tidak ada janji hasil instan',
  'bukan rekomendasi produk',
  'bukan pengganti tenaga kesehatan',
  'bukan pengganti ulama',
  'tidak memberi diagnosis',
  'tidak memberi fatwa',
  'tidak memberi klaim produk',
  'tidak memberi dosis',
  'tidak menjanjikan hasil instan',
  'segera konsultasikan kepada tenaga kesehatan',
  'segera konsultasikan kepada tenaga kesehatan profesional',
  'bertanya kepada ulama',
  'rujuk kepada ulama',
  'konsultasikan kepada ulama'
];
const IMPORT_NEGATION_SENTENCE_PATTERN = /\b(?:tidak\s+(?:berisi|ada|memakai|membahas|memberi|menjanjikan)|bukan)[^.!?]{0,220}\b(?:diagnosis|fatwa|klaim\s+produk|dosis|obat|terapi|ayat|hadits|hadis|janji\s+hasil\s+instan|rekomendasi\s+produk|pengganti\s+tenaga\s+kesehatan|pengganti\s+ulama|hasil\s+instan)\b[^.!?]{0,220}(?:[.!?]|$)/gi;
const ISLAMIC_STRONG_PATTERNS = [
  /ayat\s+al[-\s]?qur/i,
  /\bq\.?s\.?\b/i,
  /al[-\s]?qur['’]?an/i,
  /\bhadits?\b/i,
  /\bhadis\b/i,
  /nabi\s*ﷺ/i,
  /hukum\s+islam/i,
  /halal\s+haram/i,
  /\btafsir\b/i,
  /fatwa\s+final/i
];
const MEDICAL_STRONG_PATTERNS = [
  /\bdiagnosis\b/i,
  /gejala\s+berat/i,
  /\bobat\b/i,
  /\bdosis\b/i,
  /\bterapi\b/i,
  /pemeriksaan\s+medis/i,
  /keluhan\s+medis\s+rinci/i,
  /\b(diabetes|kanker|hipertensi|stroke|asma|jantung|ginjal|autoimun|tuberkulosis|tbc|demam\s+berdarah|gerd|maag\s+kronis)\b/i
];
const PRODUCT_STRONG_PATTERNS = [
  /testimoni\s+produk/i,
  /klaim\s+produk/i,
  /hasil\s+instan/i,
  /pasti\s+sembuh/i,
  /beli\s+produk/i,
  /konsumsi\s+produk/i,
  /\bcheckout\b/i,
  /\blangfit\b/i,
  /\bdeto\s+pro\b/i
];
const DEFAULT_METADATA = Object.freeze({ intentTarget: 'article-general', riskLevel: 'low', isMedicalSensitive: false, isProductSensitive: false, isIslamicSensitive: false, relatedArticles: [], userQuestions: [], answerSnippet: '', problemTags: [], audience: '', doNotUseFor: [], whenToSeekHelp: '', sources: [], contentDepth: 'basic', primaryAction: 'read-article', reviewerNote: '' });
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
  form?.addEventListener('input', handleFormPreviewUpdate);
  form?.addEventListener('change', handleFormPreviewUpdate);
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
function getMetadataPreviewBox() { return document.querySelector('[data-article-metadata-preview]'); }
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
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function splitValidationSentences(value) {
  return String(value || '')
    .split(/[.!?。！？\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasRiskTerm(sentence) {
  return RISK_TERMS.some((term) => sentence.includes(term));
}

function hasEducationalRiskContext(sentence) {
  return EDUCATIONAL_RISK_CONTEXT_TERMS.some((term) => sentence.includes(term));
}

function removeEducationalRiskSentences(normalizedText) {
  return splitValidationSentences(normalizedText)
    .filter((sentence) => !(hasRiskTerm(sentence) && hasEducationalRiskContext(sentence)))
    .join(' ')
    .trim();
}

function getPrimaryRiskTerms(normalizedText) {
  const claimText = removeEducationalRiskSentences(normalizedText);
  return RISK_TERMS.filter((term) => claimText.includes(term));
}

function getEducationalRiskMentions(normalizedText) {
  const claimText = removeEducationalRiskSentences(normalizedText);
  return RISK_TERMS.filter((term) => normalizedText.includes(term) && !claimText.includes(term));
}
function parseCsv(value) {
  return String(value || '').split(',').map((item) => normalizeSlug(item.trim()) || item.trim()).map((item) => item.trim()).filter(Boolean);
}
function parseLooseList(value) {
  return String(value || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}
function parseTags(value) { return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
function arrayToInput(value) { return Array.isArray(value) ? value.join(', ') : ''; }
function arrayToTextarea(value) { return Array.isArray(value) ? value.join('\n') : String(value || ''); }
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
    userQuestions: Array.isArray(article.userQuestions) ? article.userQuestions : DEFAULT_METADATA.userQuestions,
    answerSnippet: String(article.answerSnippet || DEFAULT_METADATA.answerSnippet),
    problemTags: Array.isArray(article.problemTags) ? article.problemTags : DEFAULT_METADATA.problemTags,
    audience: String(article.audience || DEFAULT_METADATA.audience),
    doNotUseFor: Array.isArray(article.doNotUseFor) ? article.doNotUseFor : DEFAULT_METADATA.doNotUseFor,
    whenToSeekHelp: String(article.whenToSeekHelp || DEFAULT_METADATA.whenToSeekHelp),
    sources: Array.isArray(article.sources) ? article.sources : DEFAULT_METADATA.sources,
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
    titleCell.append(createIndicatorGroup(getArticleIndicatorItems(article)));
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
function createIndicatorChip(label, tone = 'neutral') {
  const chip = document.createElement('span');
  chip.className = `article-indicator article-indicator-${tone}`;
  chip.textContent = label;
  return chip;
}
function getArticleIndicatorItems(article, validation = null) {
  const safeArticle = withMetadataDefaults(article);
  const checkedValidation = validation || validateArticle(safeArticle, safeArticle.id || null);
  const status = safeValue(VALID_STATUSES, safeArticle.status, 'draft');
  const items = [
    { label: `status: ${status}`, tone: status === 'published' ? 'success' : status === 'archived' ? 'muted' : 'warning' },
    { label: `risk: ${safeArticle.riskLevel}`, tone: safeArticle.riskLevel === 'high' ? 'danger' : safeArticle.riskLevel === 'medium' ? 'warning' : 'success' },
    { label: `intent: ${safeArticle.intentTarget}`, tone: 'neutral' },
    { label: `action: ${safeArticle.primaryAction}`, tone: safeArticle.primaryAction === 'view-products' ? 'warning' : 'neutral' },
    { label: `depth: ${safeArticle.contentDepth}`, tone: 'neutral' }
  ];

  if (safeArticle.isMedicalSensitive) items.push({ label: 'medical sensitive', tone: 'danger' });
  if (safeArticle.isProductSensitive) items.push({ label: 'product sensitive', tone: 'danger' });
  if (safeArticle.isIslamicSensitive) items.push({ label: 'islamic sensitive', tone: 'warning' });
  if (checkedValidation.missingDisclaimer) items.push({ label: 'missing disclaimer', tone: 'danger' });
  if (checkedValidation.riskTerms?.length) items.push({ label: 'klaim promosi berisiko', tone: 'danger' });
  if (safeArticle.relatedArticles.length) items.push({ label: `related: ${safeArticle.relatedArticles.length}`, tone: 'neutral' });
  if (safeArticle.reviewerNote) items.push({ label: 'reviewer note ada', tone: 'success' });

  return items;
}
function createIndicatorGroup(items) {
  const group = document.createElement('div');
  group.className = 'article-indicator-group';
  items.forEach((item) => group.append(createIndicatorChip(item.label, item.tone)));
  return group;
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
  const status = 'published';
  return withMetadataDefaults({
    title: String(formData.get('title') || '').trim(),
    slug: normalizeSlug(formData.get('slug')),
    status: safeValue(VALID_STATUSES, status, 'published'),
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
    userQuestions: parseLooseList(formData.get('userQuestions')),
    answerSnippet: String(formData.get('answerSnippet') || '').trim(),
    problemTags: parseLooseList(formData.get('problemTags')).map((tag) => tag.toLowerCase()),
    audience: String(formData.get('audience') || '').trim(),
    doNotUseFor: parseLooseList(formData.get('doNotUseFor')),
    whenToSeekHelp: String(formData.get('whenToSeekHelp') || '').trim(),
    sources: parseLooseList(formData.get('sources')),
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
  const riskTerms = getPrimaryRiskTerms(normalizedBody);
  const educationalRiskMentions = getEducationalRiskMentions(normalizedBody);
  const hasPromotionalRisk = riskTerms.length > 0;
  const hasFatwaFinalCue = FATWA_FINAL_TERMS.some((term) => normalizedBody.includes(term));

  if (!payload.title) errors.push('Title wajib diisi.');
  if (!payload.slug) errors.push('Slug wajib diisi.');
  if (payload.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) errors.push('Slug hanya boleh huruf kecil, angka, dan tanda minus.');
  if (!payload.summary) errors.push('Summary wajib diisi.');
  if (!payload.contentHtml) errors.push('Content HTML wajib diisi.');
  if (!VALID_STATUSES.has(payload.status)) errors.push('Status tidak valid.');
  if (!VALID_INTENT_TARGETS.has(payload.intentTarget)) errors.push('Intent Target tidak valid.');
  if (!VALID_RISK_LEVELS.has(payload.riskLevel)) errors.push('Risk Level tidak valid.');
  if (!VALID_CONTENT_DEPTHS.has(payload.contentDepth)) errors.push('Content Depth tidak valid.');
  if (!VALID_PRIMARY_ACTIONS.has(payload.primaryAction)) errors.push('Primary Action tidak valid.');
  if (/<\s*script/i.test(payload.contentHtml)) errors.push('Content HTML tidak boleh mengandung tag script.');
  if (/<\s*\/?\s*(html|head|body)\b/i.test(payload.contentHtml)) errors.push('Content HTML tidak boleh berisi full document HTML seperti html, head, atau body.');

  const duplicate = state.articles.find((article) => article.slug === payload.slug && article.id !== currentId);
  if (duplicate) errors.push('Slug sudah dipakai artikel lain.');

  if (missingDisclaimer) warnings.push('Disclaimer belum ada. Saat simpan, sistem akan menambahkannya otomatis dan status tetap published.');
  if (hasPromotionalRisk) warnings.push('Ditemukan klaim promosi berisiko pada isi utama. Review ulang klaim hasil mutlak, hasil cepat, atau manfaat berlebihan sebelum artikel dipakai publik.');
  if (educationalRiskMentions.length) {
    warnings.push(`Frasa risiko hanya muncul dalam konteks edukasi/penolakan klaim: ${educationalRiskMentions.join(', ')}.`);
  }
  if (payload.isMedicalSensitive) warnings.push('Medical sensitive: rujuk tenaga kesehatan untuk kondisi pribadi. Status tetap published.');
  if (payload.isProductSensitive) warnings.push('Product sensitive: jangan jadikan artikel sebagai klaim promosi. Status tetap published.');
  if (payload.isIslamicSensitive) warnings.push('Islamic sensitive: Review ustadz/ulama disarankan. Status tetap published.');
  if (payload.isMedicalSensitive && payload.primaryAction === 'view-products') warnings.push('Primary Action view-products pada medical sensitive adalah warning; artikel tetap published.');
  if (payload.isProductSensitive && payload.primaryAction === 'view-products') warnings.push('Primary Action view-products pada product sensitive adalah warning; artikel tetap published.');
  if (payload.riskLevel === 'high') warnings.push('Risk level high terdeteksi. Tambahkan warning dan reviewer note; status tetap published.');
  if (payload.isProductSensitive && hasPromotionalRisk) warnings.push('Product sensitive mengandung klaim utama berisiko. Review ulang klaim produk sebelum artikel dipakai publik.');
  if (payload.isIslamicSensitive && hasFatwaFinalCue) warnings.push('Islamic sensitive terdengar seperti fatwa final. Ini warning review, bukan perubahan status otomatis; rujukkan hukum rinci kepada ustadz/ulama kompeten.');

  return { errors, warnings, riskTerms, missingDisclaimer };
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
    const message = 'Artikel berhasil diparse ke form. Status diset published. Tetap review isi, tetapi status tidak akan menjadi draft otomatis.';
    setImportStatus(parsed.warnings.length ? 'warning' : 'success', message, parsed.warnings);
  } catch (error) {
    setImportStatus('error', error.message || 'Format import tidak terbaca.');
  }
}
function parseArticleImportText(rawText) {
  const oneBlockSections = typeof window.vitaNusaParseOneBlockArticleImport === 'function' ? window.vitaNusaParseOneBlockArticleImport(rawText) : null;
  const sections = oneBlockSections || extractImportSections(rawText);
  const title = cleanImportSection(sections.title);
  const slug = normalizeSlug(cleanImportSection(sections.slug));
  const summary = cleanImportSection(sections.summary);
  const contentHtml = cleanImportSection(sections.contentHtml);
  const reviewNote = cleanImportSection(sections.reviewNote);
  const parsedMetadata = parseImportMetadata(cleanImportSection(sections.metadata));
  const directMetadata = oneBlockSections ? {
    category: oneBlockSections.category,
    tags: oneBlockSections.tags,
    intentTarget: oneBlockSections.intentTarget,
    riskLevel: oneBlockSections.riskLevel,
    isMedicalSensitive: oneBlockSections.isMedicalSensitive,
    isProductSensitive: oneBlockSections.isProductSensitive,
    isIslamicSensitive: oneBlockSections.isIslamicSensitive,
    relatedArticles: oneBlockSections.relatedArticles,
    userQuestions: oneBlockSections.userQuestions,
    answerSnippet: oneBlockSections.answerSnippet,
    problemTags: oneBlockSections.problemTags,
    audience: oneBlockSections.audience,
    doNotUseFor: oneBlockSections.doNotUseFor,
    whenToSeekHelp: oneBlockSections.whenToSeekHelp,
    sources: oneBlockSections.sources,
    contentDepth: oneBlockSections.contentDepth,
    primaryAction: oneBlockSections.primaryAction,
    reviewerNote: oneBlockSections.reviewerNote
  } : {};
  const metadata = { ...directMetadata, ...parsedMetadata };
  const explicitFlags = {
    isMedicalSensitive: Object.prototype.hasOwnProperty.call(metadata, 'isMedicalSensitive'),
    isProductSensitive: Object.prototype.hasOwnProperty.call(metadata, 'isProductSensitive'),
    isIslamicSensitive: Object.prototype.hasOwnProperty.call(metadata, 'isIslamicSensitive')
  };
  const warnings = [];

  if (!title) throw new Error('Judul tidak ditemukan.');
  if (!contentHtml) throw new Error('Section HTML ARTIKEL tidak ditemukan.');
  if (metadata.status && safeValue(VALID_STATUSES, metadata.status, '') !== 'published') {
    warnings.push('Status import diubah otomatis menjadi published.');
  }

  const imported = {
    title,
    slug: slug || normalizeSlug(title),
    summary,
    contentHtml,
    status: 'published',
    category: String(metadata.category || '').trim(),
    tags: String(metadata.tags || '').trim(),
    intentTarget: safeValue(VALID_INTENT_TARGETS, metadata.intentTarget || DEFAULT_METADATA.intentTarget, DEFAULT_METADATA.intentTarget),
    riskLevel: safeValue(VALID_RISK_LEVELS, metadata.riskLevel || DEFAULT_METADATA.riskLevel, DEFAULT_METADATA.riskLevel),
    isMedicalSensitive: parseFlexibleBool(metadata.isMedicalSensitive, DEFAULT_METADATA.isMedicalSensitive),
    isProductSensitive: parseFlexibleBool(metadata.isProductSensitive, DEFAULT_METADATA.isProductSensitive),
    isIslamicSensitive: parseFlexibleBool(metadata.isIslamicSensitive, DEFAULT_METADATA.isIslamicSensitive),
    relatedArticles: arrayToInput(parseCsv(metadata.relatedArticles || '')),
    userQuestions: arrayToTextarea(parseLooseList(metadata.userQuestions || '')),
    answerSnippet: String(metadata.answerSnippet || summary || '').trim(),
    problemTags: arrayToInput(parseLooseList(metadata.problemTags || '').map((tag) => tag.toLowerCase())),
    audience: String(metadata.audience || '').trim(),
    doNotUseFor: arrayToTextarea(parseLooseList(metadata.doNotUseFor || '')),
    whenToSeekHelp: String(metadata.whenToSeekHelp || '').trim(),
    sources: arrayToTextarea(parseLooseList(metadata.sources || '')),
    contentDepth: safeValue(VALID_CONTENT_DEPTHS, metadata.contentDepth || DEFAULT_METADATA.contentDepth, DEFAULT_METADATA.contentDepth),
    primaryAction: safeValue(VALID_PRIMARY_ACTIONS, metadata.primaryAction || DEFAULT_METADATA.primaryAction, DEFAULT_METADATA.primaryAction),
    reviewerNote: buildImportedReviewerNote(metadata.reviewerNote, reviewNote),
    slugWasProvided: Boolean(oneBlockSections?.slugWasProvided || slug),
    explicitFlags,
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
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 'ya', 'iya', 'yes', 'y', '1', 'benar'].includes(normalized)) return true;
  if (['false', 'tidak', 'no', 'n', '0', 'salah'].includes(normalized)) return false;
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
function withAutomaticReviewerNote(payload, validation) {
  const needsReview = payload.riskLevel === 'high' || payload.isMedicalSensitive || payload.isProductSensitive || payload.isIslamicSensitive || validation.warnings.length > 0;
  if (!needsReview) return payload.reviewerNote || '';

  const automaticNote = 'PERLU REVIEW AMANAH: Artikel tetap published sesuai kebijakan admin. Konten terdeteksi sensitif sehingga admin perlu memeriksa ayat/hadits/klaim/konteks sebelum dipromosikan lebih luas.';
  const currentNote = String(payload.reviewerNote || '').trim();
  if (currentNote.includes(automaticNote)) return currentNote;
  return [currentNote, automaticNote].filter(Boolean).join('\n\n');
}
function stripImportNonMainHtml(contentHtml) {
  let html = String(contentHtml || '');

  if (typeof DOMParser === 'function') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<article>${html}</article>`, 'text/html');

    doc.querySelectorAll([
      'section.article-note',
      'div.article-note',
      'section.article-references',
      'div.article-references',
      'section[data-review-amanah]',
      'div[data-review-amanah]'
    ].join(',')).forEach((node) => node.remove());

    doc.querySelectorAll('section, div').forEach((node) => {
      const normalizedText = normalizePlainText(node.textContent || '');
      if (normalizedText.startsWith('catatan review amanah')) node.remove();
    });

    return doc.body?.innerHTML || html;
  }

  html = html.replace(/<(section|div)\b[^>]*class=["'][^"']*\barticle-note\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, ' ');
  html = html.replace(/<(section|div)\b[^>]*class=["'][^"']*\barticle-references\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, ' ');
  html = html.replace(/<(section|div)\b[^>]*data-review-amanah[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  html = html.replace(/<(section|div)\b[^>]*>[\s\S]{0,500}?catatan\s+review\s+amanah[\s\S]*?<\/\1>/gi, ' ');

  return html;
}
function removeImportNegationText(normalizedText) {
  let text = String(normalizedText || '');
  text = text.replace(IMPORT_NEGATION_SENTENCE_PATTERN, ' ');

  for (const phrase of IMPORT_DISCLAIMER_PHRASES) {
    text = text.split(normalizePlainText(phrase)).join(' ');
  }

  return text.replace(/\s+/g, ' ').trim();
}
function normalizeImportSensitivityText(contentHtml) {
  let normalized = normalizePlainText(stripImportNonMainHtml(contentHtml));
  const disclaimer = normalizePlainText(REQUIRED_DISCLAIMER);
  normalized = normalized.split(disclaimer).join(' ');
  return removeImportNegationText(normalized);
}
function hasStrongPattern(normalizedText, patterns) {
  return patterns.some((pattern) => pattern.test(normalizedText));
}
function setImportedSensitiveFlag(imported, key, warning) {
  if (imported[key] !== true) imported[key] = true;
  if (!imported.warnings.includes(warning)) imported.warnings.push(warning);
}
function applyImportSensitivityRules(imported) {
  const normalizedMainText = normalizeImportSensitivityText(imported.contentHtml);
  const hasMedicalCue = hasStrongPattern(normalizedMainText, MEDICAL_STRONG_PATTERNS);
  const hasProductCue = hasStrongPattern(normalizedMainText, PRODUCT_STRONG_PATTERNS);
  const hasIslamicCue = hasStrongPattern(normalizedMainText, ISLAMIC_STRONG_PATTERNS);

  if (hasMedicalCue) setImportedSensitiveFlag(imported, 'isMedicalSensitive', 'Medical sensitive diaktifkan karena ditemukan pembahasan dosis/obat di isi utama artikel.');
  if (hasProductCue) setImportedSensitiveFlag(imported, 'isProductSensitive', 'Product sensitive diaktifkan karena ditemukan klaim produk/hasil instan di isi utama artikel.');
  if (hasIslamicCue) setImportedSensitiveFlag(imported, 'isIslamicSensitive', 'Islamic sensitive diaktifkan karena ditemukan ayat/hadits/tafsir di isi utama artikel. Review ustadz/ulama disarankan; status tetap published.');

  if (imported.primaryAction === 'view-products' && (imported.riskLevel === 'high' || imported.isMedicalSensitive || imported.isProductSensitive)) {
    imported.warnings.push('Primary Action view-products pada konten sensitif adalah warning. Artikel tetap published; admin perlu review agar tidak menjadi klaim promosi.');
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
  form.elements.userQuestions.value = imported.userQuestions || '';
  form.elements.answerSnippet.value = imported.answerSnippet || '';
  form.elements.problemTags.value = imported.problemTags || '';
  form.elements.audience.value = imported.audience || '';
  form.elements.doNotUseFor.value = imported.doNotUseFor || '';
  form.elements.whenToSeekHelp.value = imported.whenToSeekHelp || '';
  form.elements.sources.value = imported.sources || '';
  form.elements.contentDepth.value = imported.contentDepth;
  form.elements.primaryAction.value = imported.primaryAction;
  form.elements.reviewerNote.value = imported.reviewerNote;
  form.elements.status.value = 'published';

  if (form.elements.bannerFile) form.elements.bannerFile.value = '';
  hideBannerPreview();
  updateDisclaimerStatus();
  updateArticleFormPreview();
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

function handleFormPreviewUpdate(event) {
  if (event?.target?.name === 'contentHtml') updateDisclaimerStatus();
  updateArticleFormPreview();
}
function updateArticleFormPreview() {
  const box = getMetadataPreviewBox();
  const form = getForm();
  if (!box || !form) return;

  const payload = getPayloadFromForm();
  const validation = validateArticle(payload, state.editingId);
  const summary = document.createElement('div');
  summary.className = 'article-validation-summary';

  if (validation.errors.length) {
    summary.append(createValidationText('error', `Error: ${validation.errors.join(' ')}`));
  } else if (payload.status === 'published' && validation.missingDisclaimer) {
    summary.append(createValidationText('warning', 'Saat simpan, disclaimer wajib akan ditambahkan otomatis dan status tetap published.'));
  } else {
    summary.append(createValidationText('success', 'Validasi dasar siap. Artikel akan disimpan sebagai published.'));
  }

  if (validation.warnings.length) {
    const list = document.createElement('ul');
    list.className = 'article-validation-list';
    validation.warnings.forEach((warning) => {
      const item = document.createElement('li');
      item.textContent = warning;
      list.append(item);
    });
    summary.append(list);
  }

  box.replaceChildren(createIndicatorGroup(getArticleIndicatorItems(payload, validation)), summary);
}
function createValidationText(kind, text) {
  const paragraph = document.createElement('p');
  paragraph.className = `article-validation-text article-validation-${kind}`;
  paragraph.textContent = text;
  return paragraph;
}

async function handleSaveArticle(event) {
  event.preventDefault();
  clearMessage();

  const payload = getPayloadFromForm();
  const currentId = state.editingId;
  const existing = state.articles.find((article) => article.id === currentId);
  payload.status = 'published';
  const validation = validateArticle(payload, currentId);
  const bannerUploadDisabled = Boolean(state.selectedBannerFile);

  if (validation.errors.length) {
    setMessage('error', validation.errors.join(' '));
    return;
  }

  let autoDisclaimerAdded = false;

  if (payload.status === 'published' && validation.missingDisclaimer) {
    payload.contentHtml = withRequiredDisclaimer(payload.contentHtml);
    autoDisclaimerAdded = true;
  }
  payload.status = 'published';
  payload.reviewerNote = withAutomaticReviewerNote(payload, validation);

  const writePayload = { ...payload, status: 'published', updatedAt: serverTimestamp() };
  if (!currentId || existing?.status !== 'published') writePayload.publishedAt = serverTimestamp();

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

    if (validation.warnings.length) {
      setMessage('warning', `Artikel berhasil disimpan sebagai published. Warning: ${validation.warnings.join(' ')}${disclaimerMessage}${bannerMessage}`);
      return;
    }

    setMessage('success', `Artikel berhasil disimpan sebagai published.${disclaimerMessage}${bannerMessage}`);
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
  helper.innerHTML = `<div class="article-disclaimer-copy"><strong>Disclaimer wajib</strong><p>${REQUIRED_DISCLAIMER}</p><small>Semua artikel admin disimpan sebagai published. Jika artikel lolos validasi dasar, sistem bisa menambahkan disclaimer otomatis; warning sensitif tidak mengubah status.</small></div><p class="article-disclaimer-status" data-article-disclaimer-status></p><div class="article-disclaimer-actions"><button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-add-disclaimer>Tambahkan Disclaimer</button><button class="admin-button admin-button-light article-disclaimer-button" type="button" data-article-copy-disclaimer>Salin disclaimer wajib</button></div>`;

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
  status.textContent = hasDisclaimer ? 'Disclaimer wajib sudah ada di Content HTML.' : 'Disclaimer belum ada. Artikel akan mendapat disclaimer otomatis jika lolos validasi dasar; status tetap published.';
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
  form.elements.userQuestions.value = arrayToTextarea(safeArticle.userQuestions);
  form.elements.answerSnippet.value = safeArticle.answerSnippet;
  form.elements.problemTags.value = arrayToInput(safeArticle.problemTags);
  form.elements.audience.value = safeArticle.audience;
  form.elements.doNotUseFor.value = arrayToTextarea(safeArticle.doNotUseFor);
  form.elements.whenToSeekHelp.value = safeArticle.whenToSeekHelp;
  form.elements.sources.value = arrayToTextarea(safeArticle.sources);
  form.elements.contentDepth.value = safeArticle.contentDepth;
  form.elements.primaryAction.value = safeArticle.primaryAction;
  form.elements.reviewerNote.value = safeArticle.reviewerNote;
  form.elements.status.value = 'published';

  if (form.elements.bannerFile) form.elements.bannerFile.value = '';
  if (safeArticle.bannerUrl) showExistingBannerPreview(safeArticle.bannerUrl);
  else hideBannerPreview();

  updateDisclaimerStatus();
  updateArticleFormPreview();
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
  form.elements.status.value = 'published';
  form.elements.intentTarget.value = DEFAULT_METADATA.intentTarget;
  form.elements.riskLevel.value = DEFAULT_METADATA.riskLevel;
  form.elements.isMedicalSensitive.checked = DEFAULT_METADATA.isMedicalSensitive;
  form.elements.isProductSensitive.checked = DEFAULT_METADATA.isProductSensitive;
  form.elements.isIslamicSensitive.checked = DEFAULT_METADATA.isIslamicSensitive;
  form.elements.relatedArticles.value = '';
  form.elements.userQuestions.value = '';
  form.elements.answerSnippet.value = '';
  form.elements.problemTags.value = '';
  form.elements.audience.value = '';
  form.elements.doNotUseFor.value = '';
  form.elements.whenToSeekHelp.value = '';
  form.elements.sources.value = '';
  form.elements.contentDepth.value = DEFAULT_METADATA.contentDepth;
  form.elements.primaryAction.value = DEFAULT_METADATA.primaryAction;
  form.elements.reviewerNote.value = '';
  form.elements.contentHtml.value = `<p>${REQUIRED_DISCLAIMER}</p>`;
  if (form.elements.bannerFile) form.elements.bannerFile.value = '';

  hideBannerPreview();
  updateDisclaimerStatus();
  updateArticleFormPreview();
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

  const publishContentHtml = validation.missingDisclaimer ? withRequiredDisclaimer(payload.contentHtml) : payload.contentHtml;

  try {
    payload.status = 'published';
    payload.reviewerNote = withAutomaticReviewerNote(payload, validation);
    const { id: _removedId, ...articlePayload } = withMetadataDefaults(payload);
    const updatePayload = { ...articlePayload, status: 'published', contentHtml: publishContentHtml, updatedAt: serverTimestamp() };
    if (safeArticle.status !== 'published') updatePayload.publishedAt = serverTimestamp();

    await updateDoc(doc(db, 'articles', safeArticle.id), updatePayload);
    await loadArticles();

    const disclaimerMessage = validation.missingDisclaimer ? ' Disclaimer wajib otomatis ditambahkan.' : '';
    if (validation.warnings.length) {
      setMessage('warning', `Artikel berhasil disimpan sebagai published. Warning: ${validation.warnings.join(' ')}${disclaimerMessage}`);
      return;
    }

    setMessage('success', `Artikel berhasil disimpan sebagai published.${disclaimerMessage}`);
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
