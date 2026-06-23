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

const state = {
  initialized: false,
  articles: [],
  editingId: null,
  slugTouched: false
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

  document.querySelector('[data-article-new]')?.addEventListener('click', () => resetForm());
  document.querySelector('[data-article-refresh]')?.addEventListener('click', () => loadArticles());
  document.querySelector('[data-article-reset]')?.addEventListener('click', () => resetForm());
  document.querySelector('[data-article-list]')?.addEventListener('click', handleListAction);
  form?.addEventListener('submit', handleSaveArticle);

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
    console.error("Gagal memuat artikel dari Firestore:", error);
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
    titleCell.append(createStrong(article.title || '(tanpa judul)'));
    titleCell.append(createSmall(article.slug || '-'));

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
  const riskTerms = findRiskTerms(`${payload.summary} ${payload.contentHtml}`);
  const missingDisclaimer = !payload.contentHtml.toLowerCase().includes(REQUIRED_DISCLAIMER.toLowerCase());

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

  if (riskTerms.length) {
    warnings.push(`Ditemukan kata berisiko: ${riskTerms.join(', ')}.`);
  }

  if (missingDisclaimer) {
    warnings.push('Disclaimer edukasi kesehatan wajib dipertahankan sebelum publish.');
  }

  return { errors, warnings, riskTerms, missingDisclaimer };
}

function findRiskTerms(text) {
  const lowerText = String(text || '').toLowerCase();
  return RISK_TERMS.filter((term) => lowerText.includes(term));
}

async function handleSaveArticle(event) {
  event.preventDefault();
  clearMessage();

  const payload = getPayloadFromForm();
  const currentId = state.editingId;
  const existing = state.articles.find((article) => article.id === currentId);
  const validation = validateArticle(payload, currentId);

  if (validation.errors.length) {
    setMessage('error', validation.errors.join(' '));
    return;
  }

  let forcedDraft = false;
  if (payload.status === 'published' && (validation.riskTerms.length || validation.missingDisclaimer)) {
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
    if (currentId) {
      await updateDoc(doc(db, 'articles', currentId), writePayload);
    } else {
      await addDoc(collection(db, 'articles'), {
        ...writePayload,
        createdAt: serverTimestamp()
      });
    }

    await loadArticles();
    resetForm();

    if (forcedDraft) {
      setMessage('warning', `${validation.warnings.join(' ')} Artikel disimpan sebagai draft, bukan published.`);
      return;
    }

    if (validation.warnings.length) {
      setMessage('warning', `${validation.warnings.join(' ')} Artikel tersimpan sebagai ${payload.status}.`);
      return;
    }

    setMessage('success', `Artikel berhasil disimpan sebagai ${payload.status}.`);
  } catch (error) {
    setMessage('error', error.message || 'Gagal menyimpan artikel.');
  }
}

function fillForm(article) {
  const form = getForm();
  if (!form) return;

  state.editingId = article.id;
  state.slugTouched = true;

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

  document.querySelector('[data-article-form-title]').textContent = 'Edit Artikel';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  const form = getForm();
  if (!form) return;

  state.editingId = null;
  state.slugTouched = false;
  form.reset();
  form.elements.status.value = 'draft';
  form.elements.contentHtml.value = `<p>${REQUIRED_DISCLAIMER}</p>`;
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

  if (validation.errors.length || validation.riskTerms.length || validation.missingDisclaimer) {
    const message = [...validation.errors, ...validation.warnings, 'Artikel tidak dipublish. Perbaiki konten lalu simpan ulang.'].join(' ');
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
