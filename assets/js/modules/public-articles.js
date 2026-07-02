import { initNusaUiShell } from './nusa-ui-shell.js?v=20260703-sidebar-solid-v2';
import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

initNusaUiShell();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const listRoot = document.querySelector('[data-public-article-list]');
const detailRoot = document.querySelector('[data-public-article-detail]');
const statusBox = document.querySelector('[data-public-article-status]');

if (listRoot) loadPublishedArticles();
if (detailRoot) loadArticleDetail();

async function loadPublishedArticles() {
  setStatus('loading', 'Memuat artikel published dari Firestore...');
  try {
    const publishedQuery = query(collection(db, 'articles'), where('status', '==', 'published'));
    const snapshot = await getDocs(publishedQuery);
    const articles = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter(isVisiblePublishedArticle).sort(sortNewestFirst);
    if (!articles.length) {
      setStatus('warning', 'Konten dinamis belum tersedia. Silakan baca artikel pilihan yang sudah tersedia.');
      dispatchRenderEvent({ count: 0 });
      return;
    }
    listRoot.append(...articles.map(createArticleCard));
    hideFirestoreFallbackIfNeeded(articles);
    setStatus('success', `${articles.length} artikel dari Firestore berhasil ditambahkan.`);
    dispatchRenderEvent({ count: articles.length });
  } catch (error) {
    console.error('Gagal memuat artikel published dari Firestore:', error);
    setStatus('warning', 'Firestore gagal dimuat. Artikel statis dan fallback tetap tersedia. Coba refresh halaman jika koneksi sudah stabil.');
    dispatchRenderEvent({ count: 0, error: true });
  }
}

async function loadArticleDetail() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) return renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
  renderDetailMessage('Memuat artikel...');
  try {
    const detailQuery = query(collection(db, 'articles'), where('slug', '==', slug), where('status', '==', 'published'), limit(1));
    const snapshot = await getDocs(detailQuery);
    if (snapshot.empty) return renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
    const article = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).find(isVisiblePublishedArticle);
    if (!article) return renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
    renderArticleDetail(article);
  } catch (error) {
    console.error('Gagal memuat detail artikel dari Firestore:', error);
    renderDetailMessage('Artikel gagal dimuat. Periksa koneksi atau Firestore rules, lalu coba lagi.');
  }
}

function createArticleCard(article) {
  const card = el('article', 'article-card article-card-dynamic');
  card.dataset.articleCard = '';
  card.dataset.firestoreArticle = 'true';
  card.dataset.title = article.title || '';
  card.dataset.description = getArticleSummary(article);
  card.dataset.category = buildSearchCategory(article);
  card.dataset.tags = getTagText(article.tags);

  const badge = el('div', 'article-badge green', article.category || 'Artikel');
  const content = el('div', 'article-content');
  const meta = el('p', 'article-meta', `${article.category || 'Edukasi'} • ${article.readTime || 'Baca santai'}`);
  const title = el('h3', '', article.title || 'Artikel VitaNusa AI');
  const summary = el('p', '', getArticleSummary(article));
  content.append(meta, title, summary);

  const footer = el('div', 'article-footer');
  const link = el('a', 'read-link', 'Baca Artikel');
  link.href = article.slug ? `detail.html?slug=${encodeURIComponent(article.slug)}` : '#';
  footer.append(link);

  card.append(badge, content, footer);
  return card;
}

function renderArticleDetail(article) {
  if (!detailRoot) return;
  detailRoot.innerHTML = '';
  const title = el('h1', '', article.title || 'Artikel VitaNusa AI');
  const meta = el('p', 'article-meta', `${article.category || 'Edukasi'} • ${article.readTime || 'Baca santai'}`);
  const summary = el('p', 'article-summary', getArticleSummary(article));
  const body = el('article', 'article-body');
  body.innerHTML = sanitizeHtml(article.contentHtml || '<p>Konten belum tersedia.</p>');
  detailRoot.append(title, meta, summary, body);
}

function renderDetailMessage(message) {
  if (!detailRoot) return;
  detailRoot.innerHTML = '';
  detailRoot.append(el('p', 'article-load-status warning', message));
}

function setStatus(type, message) {
  if (!statusBox) return;
  statusBox.hidden = false;
  statusBox.className = `article-load-status ${type}`;
  statusBox.textContent = message;
}

function dispatchRenderEvent(detail = {}) {
  document.dispatchEvent(new CustomEvent('vitanusa:public-articles-rendered', { detail }));
}

function hideFirestoreFallbackIfNeeded(articles) {
  const fallback = document.querySelector('[data-firestore-fallback="kebiasaan-kecil"]');
  if (!fallback) return;
  const hasRelated = articles.some((article) => {
    const text = `${article.title || ''} ${article.category || ''} ${getTagText(article.tags)}`.toLowerCase();
    return text.includes('kebiasaan') || text.includes('habit') || text.includes('sehat');
  });
  if (hasRelated) fallback.hidden = true;
}

function isVisiblePublishedArticle(article) {
  return article?.status === 'published';
}

function sortNewestFirst(a, b) {
  return getComparableDate(b) - getComparableDate(a);
}

function getComparableDate(article) {
  const value = article?.publishedAt || article?.updatedAt || article?.createdAt;
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getArticleSummary(article) {
  return article.summary || stripHtml(article.contentHtml || '').slice(0, 160) || 'Artikel edukatif VitaNusa AI.';
}

function buildSearchCategory(article) {
  return [article.category, getTagText(article.tags), article.intentTarget, article.riskLevel].filter(Boolean).join(' ').toLowerCase();
}

function getTagText(tags) {
  return Array.isArray(tags) ? tags.join(' ') : '';
}

function stripHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
