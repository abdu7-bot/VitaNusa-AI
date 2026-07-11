import { initNusaUiShell } from './nusa-ui-shell.js?v=20260704-vitanusa-master-map-v1';
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
  setStatus('loading', 'Memuat artikel terbaru...');
  try {
    const publishedQuery = query(collection(db, 'articles'), where('status', '==', 'published'));
    const snapshot = await getDocs(publishedQuery);
    const articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isVisiblePublishedArticle)
      .sort(sortNewestFirst);

    if (!articles.length) {
      setStatus('warning', 'Konten dinamis belum tersedia. Silakan baca artikel pilihan yang sudah tersedia.');
      dispatchRenderEvent({ count: 0 });
      return;
    }

    listRoot.append(...articles.map(createArticleCard));
    hideFirestoreFallbackIfNeeded(articles);
    setStatus('success', `${articles.length} artikel terbaru berhasil ditambahkan.`);
    dispatchRenderEvent({ count: articles.length });
  } catch (error) {
    console.error('Gagal memuat artikel published dari Firestore:', error);
    setStatus('warning', 'Artikel terbaru belum bisa dimuat. Artikel pilihan tetap tersedia. Coba lagi ketika koneksi sudah stabil.');
    dispatchRenderEvent({ count: 0, error: true });
  }
}

async function loadArticleDetail() {
  const slug = new URLSearchParams(window.location.search).get('slug')?.trim();
  if (!slug) {
    renderDetailState('warning', 'Alamat artikel belum lengkap', 'Pilih artikel dari daftar agar halaman yang tepat dapat dibuka.');
    return;
  }

  renderDetailState('loading', 'Memuat artikel...', 'Mohon tunggu sebentar. Bacaan sedang disiapkan.');

  try {
    const detailQuery = query(
      collection(db, 'articles'),
      where('slug', '==', slug),
      where('status', '==', 'published'),
      limit(1),
    );
    const snapshot = await getDocs(detailQuery);

    if (snapshot.empty) {
      renderDetailState('warning', 'Artikel tidak ditemukan', 'Artikel mungkin belum dipublikasikan atau alamatnya sudah berubah.');
      return;
    }

    const article = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .find(isVisiblePublishedArticle);

    if (!article) {
      renderDetailState('warning', 'Artikel tidak ditemukan', 'Artikel mungkin belum dipublikasikan atau alamatnya sudah berubah.');
      return;
    }

    renderArticleDetail(article);
  } catch (error) {
    console.error('Gagal memuat detail artikel dari Firestore:', error);
    renderDetailState('error', 'Artikel belum dapat dimuat', 'Periksa koneksi, lalu kembali ke daftar artikel untuk mencoba lagi.');
  }
}

function createArticleCard(article) {
  const card = el('article', 'article-card article-card-dynamic vn-card');
  const summaryText = getArticleSummary(article);
  const tagList = normalizeTagList(article.tags);
  const bannerUrl = getSafeImageUrl(article.bannerUrl);

  card.dataset.articleCard = '';
  card.dataset.firestoreArticle = 'true';
  card.dataset.title = article.title || '';
  card.dataset.description = summaryText;
  card.dataset.category = buildSearchCategory(article);
  card.dataset.tags = tagList.join(' ');

  if (bannerUrl) card.append(createArticleBanner(bannerUrl, article.title, 'article-card-banner', true));

  if (article.category) card.append(el('p', 'article-badge green', article.category));

  const content = el('div', 'article-content');
  if (article.readTime) content.append(el('p', 'article-meta', article.readTime));
  content.append(el('h3', '', article.title || 'Artikel VitaNusa AI'));
  if (summaryText) content.append(el('p', 'article-card-summary', summaryText));
  card.append(content);

  if (tagList.length) card.append(createTagList(tagList.slice(0, 3)));

  if (article.slug) {
    const footer = el('div', 'article-footer');
    const link = el('a', 'read-link', 'Baca Artikel');
    link.href = `detail.html?slug=${encodeURIComponent(article.slug)}`;
    footer.append(link);
    card.append(footer);
  }

  return card;
}

function renderArticleDetail(article) {
  if (!detailRoot) return;

  const summaryText = getArticleSummary(article);
  const tagList = normalizeTagList(article.tags);
  const bannerUrl = getSafeImageUrl(article.bannerUrl);
  const header = el('header', 'article-detail-header');

  if (article.category) header.append(el('p', 'article-badge', article.category));
  header.append(el('h1', '', article.title || 'Artikel VitaNusa AI'));
  if (summaryText) header.append(el('p', 'article-detail-summary', summaryText));

  const metaItems = [article.readTime].filter(Boolean);
  if (metaItems.length) {
    const meta = el('div', 'article-detail-meta');
    metaItems.forEach((item) => meta.append(el('span', '', item)));
    header.append(meta);
  }
  if (tagList.length) header.append(createTagList(tagList, 'article-detail-tags'));

  const body = el('article', 'article-detail-body');
  body.innerHTML = sanitizeHtml(article.contentHtml || '');
  prepareArticleBody(body);

  const nodes = [header];
  if (bannerUrl) nodes.push(createArticleBanner(bannerUrl, article.title, 'article-detail-banner', false));
  nodes.push(body);

  detailRoot.replaceChildren(...nodes);
  detailRoot.setAttribute('aria-busy', 'false');
  updateDocumentMetadata(article, summaryText, bannerUrl);
}

function renderDetailState(type, title, message) {
  if (!detailRoot) return;

  const state = el('div', `empty-state article-detail-empty is-${type}`);
  state.setAttribute('role', type === 'loading' ? 'status' : 'alert');
  state.append(el('h2', '', title), el('p', '', message));

  const backLink = el('a', 'btn btn-secondary', 'Kembali ke Daftar Artikel');
  backLink.href = 'index.html';
  state.append(backLink);

  detailRoot.replaceChildren(state);
  detailRoot.setAttribute('aria-busy', String(type === 'loading'));
}

function createArticleBanner(url, title, className, lazy) {
  const figure = el('figure', className);
  const image = document.createElement('img');
  image.src = url;
  image.alt = title ? `Banner artikel ${title}` : 'Banner artikel VitaNusa AI';
  image.loading = lazy ? 'lazy' : 'eager';
  image.decoding = 'async';
  image.addEventListener('error', () => figure.remove(), { once: true });
  figure.append(image);
  return figure;
}

function createTagList(tags, extraClass = '') {
  const list = el('div', ['article-tags', extraClass].filter(Boolean).join(' '));
  list.setAttribute('aria-label', 'Topik artikel');
  tags.forEach((tag) => list.append(el('span', '', tag)));
  return list;
}

function prepareArticleBody(body) {
  const contentWrappers = [...body.children].filter((node) => node.matches?.('article.vitanusa-article'));

  contentWrappers.forEach((wrapper) => {
    const contentHeader = [...wrapper.children].find((node) => node.tagName === 'HEADER');
    contentHeader?.remove();
    while (wrapper.firstChild) body.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });

  body.querySelectorAll('h1').forEach((heading) => {
    const replacement = document.createElement('h2');
    [...heading.attributes].forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    while (heading.firstChild) replacement.append(heading.firstChild);
    heading.replaceWith(replacement);
  });

  body.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('article-table-scroll')) return;
    const wrapper = el('div', 'article-table-scroll');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Tabel artikel, dapat digeser mendatar');
    table.before(wrapper);
    wrapper.append(table);
  });

  body.querySelectorAll('img').forEach((image) => {
    image.loading = 'lazy';
    image.decoding = 'async';
  });
}

function updateDocumentMetadata(article, summaryText, bannerUrl) {
  if (article.title) {
    document.title = `${article.title} | VitaNusa AI`;
    setMetaContent('property', 'og:title', article.title);
  }
  if (summaryText) {
    setMetaContent('name', 'description', summaryText);
    setMetaContent('property', 'og:description', summaryText);
  }
  if (bannerUrl) {
    setMetaContent('property', 'og:image', new URL(bannerUrl, document.baseURI).href);
  } else {
    document.querySelector('meta[property="og:image"]')?.remove();
  }
}

function setMetaContent(attribute, key, value) {
  let meta = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.setAttribute('content', value);
}

function setStatus(type, message) {
  if (!statusBox) return;
  statusBox.hidden = false;
  statusBox.className = `article-load-status is-${type}`;
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
  return String(article.summary || stripHtml(article.contentHtml || '').slice(0, 160) || '').trim();
}

function buildSearchCategory(article) {
  return [article.category, getTagText(article.tags)].filter(Boolean).join(' ').toLowerCase();
}

function normalizeTagList(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function getTagText(tags) {
  return normalizeTagList(tags).join(' ');
}

function getSafeImageUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate || /[\u0000-\u001f]/.test(candidate)) return '';
  if (/^(?:javascript|vbscript|data):/i.test(candidate.replace(/\s+/g, ''))) return '';

  try {
    const parsed = new URL(candidate, document.baseURI);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : '';
  } catch {
    return '';
  }
}

function stripHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  template.content.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());

  template.content.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        node.removeAttribute(attribute.name);
        return;
      }

      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name) && !isSafeContentUrl(attribute.value, name)) {
        node.removeAttribute(attribute.name);
      }
    });

    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      const rel = new Set(String(node.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      node.setAttribute('rel', [...rel].join(' '));
    }
  });

  return template.innerHTML;
}

function isSafeContentUrl(value, attributeName) {
  const candidate = String(value || '').trim();
  if (!candidate || /[\u0000-\u001f]/.test(candidate)) return false;
  if (attributeName === 'href' && candidate.startsWith('#')) return true;

  const compact = candidate.replace(/\s+/g, '');
  if (/^(?:javascript|vbscript|data):/i.test(compact)) return false;

  try {
    const parsed = new URL(candidate, document.baseURI);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
    return attributeName === 'href' && (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:');
  } catch {
    return false;
  }
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
