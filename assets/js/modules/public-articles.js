import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

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
    const snapshot = await where('status', '==', 'published')
    const articles = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter(isVisiblePublishedArticle).sort(sortNewestFirst);
    if (!articles.length) {
      setStatus('warning', 'Belum ada artikel published dari Firestore. Artikel statis dan fallback tetap tersedia.');
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
    const detailQuery = query(collection(db, 'articles'), where('slug', '==', slug), limit(3));
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

  const banner = createBannerFigure(article, 'article-card-banner');
  if (banner) card.append(banner);

  const badge = el('div', `article-badge ${getBadgeClass(article.category)}`.trim(), getArticleBadge(article));
  const content = el('div', 'article-content');
  content.append(
    el('p', 'article-meta', `${article.category || 'Artikel VitaNusa AI'} • ${article.readTime || '5 menit baca'}`),
    el('h3', '', article.title || 'Artikel VitaNusa AI'),
    el('p', '', getArticleSummary(article))
  );

  const link = el('a', 'read-link', 'Baca Artikel');
  link.href = `detail.html?slug=${encodeURIComponent(article.slug || article.id)}`;
  const footer = el('div', 'article-footer');
  footer.append(createTagList(article.tags), link);
  card.append(badge, content, footer);
  return card;
}

function isVisiblePublishedArticle(article) {
  return article.status === 'published';
}

function renderArticleDetail(article) {
  detailRoot.replaceChildren();
  const header = el('header', 'article-detail-header');
  header.append(
    el('p', 'eyebrow', article.category || 'Artikel VitaNusa AI'),
    el('h1', '', article.title || 'Artikel VitaNusa AI'),
    el('p', 'article-detail-meta', `VitaNusa AI • ${article.readTime || '5 menit baca'}`),
    createTagList(article.tags)
  );
  const banner = createBannerFigure(article, 'article-detail-banner');
  const body = el('article', 'article-detail-body');
  body.innerHTML = sanitizeArticleHtml(article.contentHtml || '<p>Konten artikel belum tersedia.</p>');
  detailRoot.append(...[header, banner, body].filter(Boolean));
  document.title = `${article.title || 'Artikel'} | VitaNusa AI`;
}

function renderDetailMessage(message) {
  const box = el('div', 'empty-state article-detail-empty');
  box.hidden = false;
  const link = el('a', 'btn-primary', 'Kembali ke Daftar Artikel');
  link.href = 'index.html';
  box.append(el('h3', '', message), link);
  detailRoot.replaceChildren(box);
}

function createTagList(tags) {
  const tagList = el('div', 'article-tags');
  getTags(tags).slice(0, 5).forEach((tag) => tagList.append(el('span', '', tag)));
  return tagList;
}

function createBannerFigure(article, className) {
  if (!article.bannerUrl) return null;
  const figure = el('figure', className);
  const image = el('img');
  image.src = article.bannerUrl;
  image.alt = article.title ? `Banner artikel ${article.title}` : 'Banner artikel VitaNusa AI';
  image.loading = 'lazy';
  image.addEventListener('error', () => figure.remove());
  figure.append(image);
  return figure;
}

function sanitizeArticleHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const unsafeUrlPrefix = 'java' + 'script:';
  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((item) => item.remove());
  parsed.querySelectorAll('*').forEach((item) => [...item.attributes].forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = String(attribute.value || '').trim().toLowerCase();
    if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith(unsafeUrlPrefix))) item.removeAttribute(attribute.name);
  }));
  return parsed.body.innerHTML;
}

function hideFirestoreFallbackIfNeeded(articles) {
  const hasKebiasaanKecil = articles.some((article) => normalizeText(article.title).includes('sehat itu dimulai dari kebiasaan kecil'));
  const fallback = listRoot?.querySelector('[data-firestore-fallback="kebiasaan-kecil"]');
  if (fallback && hasKebiasaanKecil) fallback.hidden = true;
}

function getArticleSummary(article) { return article.excerpt || article.summary || article.description || 'Ringkasan artikel belum tersedia.'; }
function getArticleBadge(article) { return String(article.category || '').trim() || getTags(article.tags)[0] || 'Baru'; }
function getBadgeClass(category) {
  const text = normalizeText(category || '');
  if (text.includes('literasi') || text.includes('produk') || text.includes('mitos')) return 'orange';
  if (text.includes('ai') || text.includes('edukasi')) return 'blue';
  if (text.includes('halal') || text.includes('amanah') || text.includes('sehat')) return 'green';
  return '';
}
function buildSearchCategory(article) { return [article.category, article.title, getArticleSummary(article), ...getTags(article.tags)].filter(Boolean).join(' ').toLowerCase(); }
function getTags(tags) { return Array.isArray(tags) ? tags.filter(Boolean) : []; }
function getTagText(tags) { return getTags(tags).join(' '); }
function sortNewestFirst(a, b) { return getTimestampValue(b.publishedAt || b.updatedAt) - getTimestampValue(a.publishedAt || a.updatedAt); }
function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
function setStatus(kind, message) {
  if (!statusBox) return;
  statusBox.hidden = false;
  statusBox.className = `article-load-status is-${kind}`;
  statusBox.textContent = message;
}
function dispatchRenderEvent(detail = {}) { window.dispatchEvent(new CustomEvent('vitanusa:public-articles-rendered', { detail })); }
function normalizeText(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'dan').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function el(tagName, className = '', text = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
