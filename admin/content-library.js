import { db } from './firebase-auth.js';
import { collection, deleteDoc, doc, getDocs } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const app = document.querySelector('[data-content-library-app]');
const state = { initialized: false, items: [], filters: { search: '', category: '', status: '' } };

const PLACEHOLDER_ITEMS = Object.freeze([
  { id: 'product-placeholder', type: 'product', categoryLabel: 'Produk', title: 'Produk', status: 'development', description: 'Product CRUD belum aktif. Katalog publik masih statis.', panel: 'products' },
  { id: 'video-placeholder', type: 'video', categoryLabel: 'Video', title: 'Video / Media', status: 'development', description: 'Video library belum aktif. Media masih dikelola manual.', panel: 'media' },
  { id: 'story-placeholder', type: 'story', categoryLabel: 'VitaStory / Cerita', title: 'VitaStory / Cerita', status: 'development', description: 'Cerita dan komik masih placeholder di admin.', panel: 'comics' },
  { id: 'faq-placeholder', type: 'faq', categoryLabel: 'FAQ', title: 'FAQ', status: 'development', description: 'FAQ CRUD belum aktif. Halaman publik masih statis.', panel: 'faq' },
  { id: 'prompt-import-placeholder', type: 'prompt-import', categoryLabel: 'Prompt Import', title: 'Import Prompt', status: 'development', description: 'Import tersedia di form Artikel dan Knowledge. Riwayat prompt belum disimpan terpisah.', panel: 'prompt-import' }
]);

if (app) {
  window.addEventListener('vitanusa:admin-ready', initContentLibrary);
  if (window.vitaNusaAdmin?.user) initContentLibrary();
}

function initContentLibrary() {
  if (state.initialized) return;
  state.initialized = true;

  document.querySelector('[data-content-search]')?.addEventListener('input', handleFilterChange);
  document.querySelector('[data-content-category-filter]')?.addEventListener('change', handleFilterChange);
  document.querySelector('[data-content-status-filter]')?.addEventListener('change', handleFilterChange);
  document.querySelector('[data-content-refresh]')?.addEventListener('click', loadContentLibrary);
  document.querySelector('[data-content-library-list]')?.addEventListener('click', handleLibraryAction);
  window.addEventListener('vitanusa:admin-content-filter', handleContentFilterShortcut);

  loadContentLibrary();
}

async function loadContentLibrary() {
  setMessage('success', 'Memuat pustaka konten...');

  const [articlesResult, knowledgeResult] = await Promise.allSettled([
    loadArticles(),
    loadKnowledge()
  ]);

  const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : [];
  const knowledge = knowledgeResult.status === 'fulfilled' ? knowledgeResult.value : [];
  state.items = [...articles, ...knowledge].sort(sortNewestFirst);

  renderSummary();
  renderLibrary();

  const failures = [articlesResult, knowledgeResult].filter((result) => result.status === 'rejected');
  if (failures.length) {
    setMessage('warning', 'Sebagian konten belum bisa dimuat. Periksa koneksi, status admin, dan Firestore rules.');
    return;
  }

  setMessage('success', `Pustaka konten dimuat: ${state.items.length} item aktif dari Firestore.`);
}

async function loadArticles() {
  const snapshot = await getDocs(collection(db, 'articles'));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return normalizeLibraryItem({
      id: entry.id,
      type: 'article',
      categoryLabel: 'Artikel',
      title: data.title || '(tanpa judul)',
      status: data.status || 'draft',
      description: data.summary || stripHtml(data.contentHtml || '').slice(0, 180),
      content: data.contentHtml || '',
      subcategory: data.category || 'Artikel',
      slug: data.slug || '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      collectionName: 'articles'
    });
  });
}

async function loadKnowledge() {
  const snapshot = await getDocs(collection(db, 'nusaKnowledge'));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return normalizeLibraryItem({
      id: entry.id,
      type: 'knowledge',
      categoryLabel: 'Knowledge Q&A',
      title: data.question || '(tanpa pertanyaan)',
      status: data.status || 'draft',
      description: data.shortAnswer || stripHtml(data.answerHtml || '').slice(0, 180),
      content: data.answerHtml || '',
      subcategory: data.category || 'Knowledge Nusa AI',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      collectionName: 'nusaKnowledge'
    });
  });
}

function normalizeLibraryItem(item) {
  const status = ['draft', 'published', 'archived'].includes(item.status) ? item.status : 'draft';
  return {
    ...item,
    status,
    searchText: normalizeSearch([
      item.categoryLabel,
      item.subcategory,
      item.title,
      item.description,
      item.content,
      item.slug,
      status
    ].join(' '))
  };
}

function renderSummary() {
  setCount('article', state.items.filter((item) => item.type === 'article').length);
  setCount('knowledge', state.items.filter((item) => item.type === 'knowledge').length);
  setCount('draft', state.items.filter((item) => item.status !== 'published').length);
}

function setCount(key, count) {
  document.querySelectorAll(`[data-content-count="${key}"]`).forEach((target) => {
    target.textContent = String(count);
  });
}

function renderLibrary() {
  const body = document.querySelector('[data-content-library-list]');
  if (!body) return;

  const rows = getFilteredItems().map(createLibraryRow);
  if (!rows.length) {
    body.replaceChildren(createEmptyRow('Tidak ada konten yang cocok dengan filter.'));
    return;
  }

  body.replaceChildren(...rows);
}

function getFilteredItems() {
  const search = normalizeSearch(state.filters.search);
  const category = state.filters.category;
  const status = state.filters.status;
  const sourceItems = category === 'draft' ? state.items : [...state.items, ...PLACEHOLDER_ITEMS];

  return sourceItems.filter((item) => {
    const matchesCategory = !category
      || item.type === category
      || (category === 'draft' && item.status !== 'published');
    const matchesStatus = !status || item.status === status;
    const matchesSearch = !search || (item.searchText || normalizeSearch(`${item.categoryLabel} ${item.title} ${item.description}`)).includes(search);
    return matchesCategory && matchesStatus && matchesSearch;
  });
}

function createLibraryRow(item) {
  const row = document.createElement('tr');
  const categoryCell = document.createElement('td');
  const contentCell = document.createElement('td');
  const statusCell = document.createElement('td');
  const createdCell = document.createElement('td');
  const updatedCell = document.createElement('td');
  const actionCell = document.createElement('td');

  categoryCell.dataset.label = 'Kategori';
  contentCell.dataset.label = 'Konten';
  statusCell.dataset.label = 'Status';
  createdCell.dataset.label = 'Dibuat';
  updatedCell.dataset.label = 'Update';
  actionCell.dataset.label = 'Aksi';

  categoryCell.textContent = item.categoryLabel;
  contentCell.className = 'article-title-cell';
  contentCell.append(createStrong(item.title));
  contentCell.append(createSmall(item.subcategory || item.description || '-'));
  statusCell.append(createStatusBadge(item.status));
  createdCell.textContent = formatDate(item.createdAt);
  updatedCell.textContent = formatDate(item.updatedAt || item.createdAt);

  const actions = document.createElement('div');
  actions.className = 'article-row-actions';
  if (item.status === 'development') {
    actions.append(createLibraryButton('Buka Panel', 'open-panel', item.type, item.id, item.panel));
  } else {
    actions.append(createLibraryButton('Edit', 'edit', item.type, item.id));
    actions.append(createLibraryButton('Hapus', 'delete', item.type, item.id, '', 'danger'));
  }
  actionCell.append(actions);

  row.append(categoryCell, contentCell, statusCell, createdCell, updatedCell, actionCell);
  return row;
}

function createEmptyRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 6;
  cell.className = 'article-meta-muted';
  cell.textContent = message;
  row.append(cell);
  return row;
}

function createStrong(text) {
  const strong = document.createElement('strong');
  strong.textContent = text || '-';
  return strong;
}

function createSmall(text) {
  const small = document.createElement('small');
  small.textContent = text || '-';
  return small;
}

function createStatusBadge(status) {
  if (status === 'development') {
    const badge = document.createElement('span');
    badge.className = 'admin-status-pill is-development';
    badge.textContent = 'Dalam pengembangan';
    return badge;
  }

  const badge = document.createElement('span');
  badge.className = `article-status article-status-${status}`;
  badge.textContent = status === 'published' ? 'publish' : status === 'archived' ? 'arsip' : 'draft';
  return badge;
}

function createLibraryButton(label, action, type, id, panel = '', tone = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-button admin-button-light article-action-button';
  if (tone === 'danger') button.classList.add('is-danger');
  button.dataset.contentAction = action;
  button.dataset.contentType = type;
  button.dataset.contentId = id;
  if (panel) button.dataset.contentPanel = panel;
  button.textContent = label;
  return button;
}

async function handleLibraryAction(event) {
  const button = event.target.closest('[data-content-action]');
  if (!button) return;

  const type = button.dataset.contentType;
  const id = button.dataset.contentId;
  const action = button.dataset.contentAction;

  if (action === 'open-panel') {
    openPanel(button.dataset.contentPanel);
    return;
  }

  if (action === 'edit') {
    await openEditor(type, id);
    return;
  }

  if (action === 'delete') await deleteLibraryItem(type, id);
}

async function openEditor(type, id) {
  const panel = type === 'article' ? 'articles' : type === 'knowledge' ? 'knowledge' : '';
  if (!panel) return;
  openPanel(panel);

  const api = type === 'article' ? window.vitaNusaArticleAdmin : window.vitaNusaKnowledgeAdmin;
  const focusMethod = type === 'article' ? 'focusArticle' : 'focusKnowledge';
  if (api?.[focusMethod]?.(id)) return;

  if (typeof api?.refresh === 'function') await api.refresh();
  if (api?.[focusMethod]?.(id)) return;
  setMessage('warning', 'Panel sudah dibuka. Jika item belum terpilih, klik Refresh Daftar lalu tekan Edit pada baris terkait.');
}

async function deleteLibraryItem(type, id) {
  const item = state.items.find((entry) => entry.type === type && entry.id === id);
  if (!item) return;

  const confirmed = window.confirm(`Hapus permanen "${item.title}" dari ${item.categoryLabel}? Tindakan ini tidak bisa dibatalkan.`);
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, item.collectionName, item.id));
    await refreshRelatedModule(type);
    await loadContentLibrary();
    setMessage('success', 'Konten berhasil dihapus dari Firestore.');
  } catch (error) {
    setMessage('error', error.message || 'Gagal menghapus konten.');
  }
}

async function refreshRelatedModule(type) {
  if (type === 'article' && typeof window.vitaNusaArticleAdmin?.refresh === 'function') {
    await window.vitaNusaArticleAdmin.refresh();
  }
  if (type === 'knowledge' && typeof window.vitaNusaKnowledgeAdmin?.refresh === 'function') {
    await window.vitaNusaKnowledgeAdmin.refresh();
  }
}

function openPanel(panel) {
  if (!panel) return;
  window.dispatchEvent(new CustomEvent('vitanusa:admin-open-panel', { detail: { panel } }));
}

function handleFilterChange(event) {
  const target = event.target;
  if (target?.matches?.('[data-content-search]')) state.filters.search = target.value || '';
  if (target?.matches?.('[data-content-category-filter]')) state.filters.category = target.value || '';
  if (target?.matches?.('[data-content-status-filter]')) state.filters.status = target.value || '';
  renderLibrary();
}

function handleContentFilterShortcut(event) {
  const category = event.detail?.category || '';
  const categorySelect = document.querySelector('[data-content-category-filter]');
  const statusSelect = document.querySelector('[data-content-status-filter]');
  if (categorySelect) categorySelect.value = category;
  if (statusSelect) statusSelect.value = '';
  state.filters.category = category;
  state.filters.status = '';
  renderLibrary();
}

function setMessage(kind, message) {
  const box = document.querySelector('[data-content-message]');
  if (!box) return;
  box.hidden = false;
  box.classList.remove('is-error', 'is-warning');
  if (kind !== 'success') box.classList.add(`is-${kind}`);
  box.textContent = message;
}

function normalizeSearch(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  return template.content.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function formatDate(value) {
  const timestamp = getTimestampValue(value);
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortNewestFirst(a, b) {
  return getTimestampValue(b.updatedAt || b.createdAt) - getTimestampValue(a.updatedAt || a.createdAt);
}
