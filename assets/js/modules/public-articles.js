import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const listRoot = document.querySelector('[data-public-article-list]');
const detailRoot = document.querySelector('[data-public-article-detail]');
const statusBox = document.querySelector('[data-public-article-status]');

if (listRoot) {
  loadPublishedArticles();
}

if (detailRoot) {
  loadArticleDetail();
}

async function loadPublishedArticles() {
  setStatus('loading', 'Memuat artikel published dari Firestore...');

  try {
    const snapshot = await getDocs(collection(db, 'articles'));
    const articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isVisiblePublishedArticle)
      .sort(sortNewestFirst);

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

  if (!slug) {
    renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
    return;
  }

  renderDetailMessage('Memuat artikel...');

  try {
    const detailQuery = query(
      collection(db, 'articles'),
      where('slug', '==', slug),
      limit(3)
    );
    const snapshot = await getDocs(detailQuery);

    if (snapshot.empty) {
      renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
      return;
    }

    const article = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .find(isVisiblePublishedArticle);

    if (!article) {
      renderDetailMessage('Artikel tidak ditemukan atau belum dipublikasikan.');
      return;
    }

    renderArticleDetail(article);
  } catch (error) {
    console.error('Gagal memuat detail artikel dari Firestore:', error);
    renderDetailMessage('Artikel gagal dimuat. Periksa koneksi atau Firestore rules, lalu coba lagi.');
  }
}

function createArticleCard(article) {
  const card = document.createElement('article');
  card.className = 'article-card article-card-dynamic';
  card.dataset.articleCard = '';
  card.dataset.firestoreArticle = 'true';
  card.dataset.title = article.title || '';
  card.dataset.description = getArticleSummary(article);
  card.dataset.category = buildSearchCategory(article);
  card.dataset.tags = getTagText(article.tags);

  const banner = createBannerFigure(article, 'article-card-banner');
  if (banner) card.append(banner);

  const badge = document.createElement('div');
  badge.className = `article-badge ${getBadgeClass(article.category)}`.trim();
  badge.textContent = getArticleBadge(article);

  const content = document.createElement('div');
  content.className = 'article-content';

  const meta = document.createElement('p');
  meta.className = 'article-meta';
  meta.textContent = `${article.category || 'Artikel VitaNusa AI'} • ${article.readTime || '5 menit baca'}`;

  const title = document.createElement('h3');
  title.textContent = article.title || 'Artikel VitaNusa AI';

  const summary = document.createElement('p');
  summary.textContent = getArticleSummary(article);

  content.append(meta, title, summary);

  const footer = document.createElement('div');
  footer.className = 'article-footer';

  const link = document.createElement('a');
  link.className = 'read-link';
  link.href = `detail.html?slug=${encodeURIComponent(article.slug || article.id)}`;
  link.textContent = 'Baca Artikel';

  footer.append(createTagList(article.tags), link);
  card.append(badge, content, footer);
  return card;
}

function isVisiblePublishedArticle(article) {
  if (!article || !article.title) return false;
  if (article.status && article.status !== 'published') return false;
  return true;
}

function getArticleSummary(article) {
  return article.excerpt || article.summary || article.description || 'Ringkasan artikel belum tersedia.';
}

function getArticleBadge(article) {
  const category = String(article.category || '').trim();
  if (category) return category;
  if (Array.isArray(article.tags) && article.tags.length) return article.tags[0];
  return 'Baru';
}

function getBadgeClass(category) {
  const normalized = normalizeText(category || '');
  if (normalized.includes('literasi') || normalized.includes('produk') || normalized.includes('mitos')) return 'orange';
  if (normalized.includes('ai') || normalized.includes('edukasi')) return 'blue';
  if (normalized.includes('halal') || normalized.includes('amanah') || normalized.includes('sehat')) return 'green';
  return '';
}

function createTagList(tags) {
  const tagList = document.createElement('div');
  tagList.className = 'article-tags';

  if (!Array.isArray(tags) || !tags.length) return tagList;

  tags.slice(0, 5).forEach((tag) => {
    const pill = document.createElement('span');
    pill.textContent = tag;
    tagList.append(pill);
  });

  return tagList;
}

function createBannerFigure(article, className) {
  if (!article.bannerUrl) return null;

  const figure = document.createElement('figure');
  figure.className = className;

  const image = document.createElement('img');
  image.src = article.bannerUrl;
  image.alt = article.title ? `Banner artikel ${article.title}` : 'Banner artikel VitaNusa AI';
  image.loading = 'lazy';

  image.addEventListener('error', () => {
    figure.remove();
  });

  figure.append(image);
  return figure;
}

function hideFirestoreFallbackIfNeeded(articles) {
  const hasKebiasaanKecil = articles.some((article) => normalizeText(article.title).includes('sehat itu dimulai dari kebiasaan kecil'));
  const fallback = listRoot?.querySelector('[data-firestore-fallback="kebiasaan-kecil"]');

  if (fallback && hasKebiasaanKecil) {
    fallback.hidden = true;
  }
}

function renderArticleDetail(article) {
  detailRoot.replaceChildren();

  const header = document.createElement('header');
  header.className = 'article-detail-header';

  const category = document.createElement('p');
  category.className = 'eyebrow';
  category.textContent = article.category || 'Artikel VitaNusa AI';

  const title = document.createElement('h1');
  title.textContent = article.title || 'Artikel VitaNusa AI';

  const meta = document.createElement('p');
  meta.className = 'article-detail-meta';
  meta.textContent = `VitaNusa AI • ${article.readTime || '5 menit baca'}`;

  header.append(category, title, meta, createTagList(article.tags));

  const banner = createBannerFigure(article, 'article-detail-banner');

  const body = document.createElement('article');
  body.className = 'article-detail-body';
  body.innerHTML = sanitizeArticleHtml(article.contentHtml || '<p>Konten artikel belum tersedia.</p>');

  if (banner) {
    detailRoot.append(header, banner, body);
  } else {
    detailRoot.append(header, body);
  }

  document.title = `${article.title || 'Artikel'} | VitaNusa AI`;
}

function renderDetailMessage(message) {
  const box = document.createElement('div');
  box.className = 'empty-state article-detail-empty';
  box.hidden = false;

  const title = document.createElement('h3');
  title.textContent = message;

  const link = document.createElement('a');
  link.className = 'btn-primary';
  link.href = 'index.html';
  link.textContent = 'Kembali ke Daftar Artikel';

  box.append(title, link);
  detailRoot.replaceChildren(box);
}

function sanitizeArticleHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const unsafeUrlPrefix = 'java' + 'script:';

  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((element) => element.remove());

  parsed.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = String(attribute.value || '').trim().toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
      }

      if ((name === 'href' || name === 'src') && value.startsWith(unsafeUrlPrefix)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return parsed.body.innerHTML;
}

function buildSearchCategory(article) {
  const parts = [
    article.category,
    article.title,
    getArticleSummary(article),
    ...getTags(article.tags),
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}

function getTagText(tags) {
  return getTags(tags).join(' ');
}

function sortNewestFirst(a, b) {
  return getTimestampValue(b.publishedAt || b.updatedAt) - getTimestampValue(a.publishedAt || a.updatedAt);
}

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

function dispatchRenderEvent(detail = {}) {
  window.dispatchEvent(new CustomEvent('vitanusa:public-articles-rendered', { detail }));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'dan')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
