import { initNusaUiShell } from './nusa-ui-shell.js?v=20260704-vitanusa-master-map-v1';
import {
  createSanitizedContentFragment,
  htmlToPlainText,
} from './content-sanitizer.js?v=20260725-content-rendering-security-v1';
import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

initNusaUiShell();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const listRoot = document.querySelector('[data-public-article-list]');
const detailRoot = document.querySelector('[data-public-article-detail]');
const statusBox = document.querySelector('[data-public-article-status]');
const relatedRoot = document.querySelector('[data-related-articles]');
const relatedList = document.querySelector('[data-related-articles-list]');

let publishedArticlesPromise = null;

if (listRoot && listRoot.dataset.publicArticlesInitialized !== 'true') {
  listRoot.dataset.publicArticlesInitialized = 'true';
  loadPublishedArticles();
}

if (detailRoot && detailRoot.dataset.publicArticleDetailInitialized !== 'true') {
  detailRoot.dataset.publicArticleDetailInitialized = 'true';
  loadArticleDetail();
}

async function getPublishedArticles() {
  if (publishedArticlesPromise) return publishedArticlesPromise;

  publishedArticlesPromise = (async () => {
    const publishedQuery = query(collection(db, 'articles'), where('status', '==', 'published'));
    const snapshot = await getDocs(publishedQuery);
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isVisiblePublishedArticle)
      .sort(sortNewestFirst);
  })().catch((error) => {
    publishedArticlesPromise = null;
    throw error;
  });

  return publishedArticlesPromise;
}

async function loadPublishedArticles() {
  setStatus('loading', 'Memuat artikel terbaru…');

  try {
    const articles = await getPublishedArticles();

    if (!articles.length) {
      setStatus('warning', 'Belum ada artikel terbaru dari sumber dinamis. Bacaan pilihan tetap tersedia.');
      dispatchRenderEvent({ count: 0 });
      return;
    }

    listRoot.append(...articles.map(createArticleCard));
    setStatus('success', `${articles.length} artikel terbaru telah dimuat.`);
    dispatchRenderEvent({ count: articles.length });
  } catch (error) {
    console.error('Gagal memuat artikel published dari Firestore:', error);
    setStatus('error', 'Artikel terbaru belum dapat dimuat. Bacaan pilihan tetap tersedia; silakan coba lagi saat koneksi stabil.');
    dispatchRenderEvent({ count: 0, error: true });
  }
}

async function loadArticleDetail() {
  const slug = new URLSearchParams(window.location.search).get('slug')?.trim();

  if (!slug) {
    renderDetailState('warning', 'Alamat artikel belum lengkap', 'Buka artikel melalui daftar agar alamat yang tepat digunakan.');
    return;
  }

  renderDetailState('loading', 'Menyiapkan artikel…', 'Bacaan sedang dimuat.');

  try {
    const articles = await getPublishedArticles();
    const article = articles.find((item) => String(item.slug || '').trim() === slug);

    if (!article) {
      renderDetailState('warning', 'Artikel tidak ditemukan', 'Artikel mungkin belum dipublikasikan atau alamatnya tidak lagi tersedia.');
      return;
    }

    renderArticleDetail(article);
    renderRelatedArticles(article, articles);
  } catch (error) {
    console.error('Gagal memuat detail artikel dari Firestore:', error);
    renderDetailState('error', 'Artikel belum dapat dimuat', 'Periksa koneksi, lalu kembali ke daftar artikel untuk mencoba kembali.');
  }
}

function createArticleCard(article) {
  const card = el('article', 'article-card article-card-dynamic');
  const title = cleanText(article.title) || 'Artikel VitaNusa';
  const summaryText = getArticleSummary(article);
  const tagList = normalizeTagList(article.tags);
  const bannerUrl = getSafeImageUrl(article.bannerUrl);
  const category = cleanText(article.category);

  card.dataset.articleCard = '';
  card.dataset.firestoreArticle = 'true';
  card.dataset.title = title;
  card.dataset.description = summaryText;
  card.dataset.category = buildSearchCategory(article);
  card.dataset.tags = tagList.join(' ');

  card.append(createArticleCardMedia(bannerUrl, article, title));

  const content = el('div', 'article-card-content');
  if (category) content.append(el('p', 'article-category', category));
  content.append(el('h3', '', title));
  if (summaryText) content.append(el('p', 'article-card-summary', summaryText));

  const metadata = getCardMetadata(article);
  if (metadata.length) content.append(createMetadata(metadata, 'article-card-meta'));

  const slug = cleanText(article.slug);
  if (slug) {
    const link = el('a', 'read-link', 'Baca artikel');
    link.href = `detail.html?slug=${encodeURIComponent(slug)}`;
    link.setAttribute('aria-label', `Baca artikel ${title}`);
    content.append(link);
  }

  card.append(content);
  return card;
}

function createArticleCardMedia(bannerUrl, article, title) {
  const media = el('div', 'article-card-media');

  if (!bannerUrl) {
    media.classList.add('article-card-placeholder');
    media.setAttribute('aria-hidden', 'true');
    media.append(el('span', '', 'VitaNusa'));
    return media;
  }

  const image = document.createElement('img');
  image.src = bannerUrl;
  image.alt = getImageAlt(article, title);
  image.loading = 'lazy';
  image.decoding = 'async';
  image.width = 1200;
  image.height = 675;
  image.addEventListener('error', () => {
    media.replaceChildren(el('span', '', 'VitaNusa'));
    media.classList.add('article-card-placeholder');
    media.setAttribute('aria-hidden', 'true');
  }, { once: true });
  media.append(image);
  return media;
}

function renderArticleDetail(article) {
  if (!detailRoot) return;

  const title = cleanText(article.title) || 'Artikel VitaNusa';
  const summaryText = getArticleSummary(article);
  const bannerUrl = getSafeImageUrl(article.bannerUrl);
  const category = cleanText(article.category);
  const header = el('header', 'article-detail-header');

  if (category) header.append(el('p', 'article-category', category));
  header.append(el('h1', '', title));
  if (summaryText) header.append(el('p', 'article-detail-summary', summaryText));

  const metadata = getDetailMetadata(article);
  if (metadata.length) header.append(createMetadata(metadata, 'article-detail-meta'));

  const body = el('article', 'article-detail-body');
  body.append(createSanitizedContentFragment(article.contentHtml || '', body.ownerDocument));
  prepareArticleBody(body);

  const nodes = [header];
  if (bannerUrl) nodes.push(createArticleBanner(bannerUrl, article, title));
  nodes.push(body);

  detailRoot.replaceChildren(...nodes);
  detailRoot.setAttribute('aria-busy', 'false');
  updateDocumentMetadata(article, title, summaryText, bannerUrl);
}

function renderRelatedArticles(activeArticle, articles) {
  if (!relatedRoot || !relatedList) return;

  const activeSlug = cleanText(activeArticle.slug);
  const activeId = cleanText(activeArticle.id);
  const related = articles
    .filter((article) => isVisiblePublishedArticle(article))
    .filter((article) => {
      const candidateSlug = cleanText(article.slug);
      const candidateId = cleanText(article.id);
      return candidateSlug !== activeSlug && (!activeId || candidateId !== activeId);
    })
    .map((article) => ({ article, score: getRelatedScore(activeArticle, article) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || sortNewestFirst(a.article, b.article))
    .slice(0, 3)
    .map((entry) => entry.article);

  if (!related.length) {
    relatedList.replaceChildren();
    relatedRoot.hidden = true;
    return;
  }

  relatedList.replaceChildren(...related.map(createRelatedArticleCard));
  relatedRoot.hidden = false;
}

function createRelatedArticleCard(article) {
  const card = el('article', 'related-article-card');
  const title = cleanText(article.title) || 'Artikel VitaNusa';
  const category = cleanText(article.category);
  const slug = cleanText(article.slug);

  if (category) card.append(el('p', '', category));
  card.append(el('h3', '', title));

  if (slug) {
    const link = el('a', '', 'Baca artikel');
    link.href = `detail.html?slug=${encodeURIComponent(slug)}`;
    link.setAttribute('aria-label', `Baca artikel ${title}`);
    card.append(link);
  }

  return card;
}

function renderDetailState(type, title, message) {
  if (!detailRoot) return;

  const state = el('div', `article-state is-${type}`);
  state.setAttribute('role', type === 'loading' ? 'status' : 'alert');
  state.append(el('h2', '', title), el('p', '', message));

  if (type !== 'loading') {
    const backLink = el('a', '', 'Kembali ke daftar artikel');
    backLink.href = 'index.html';
    state.append(backLink);
  }

  detailRoot.replaceChildren(state);
  detailRoot.setAttribute('aria-busy', String(type === 'loading'));

  if (relatedRoot) relatedRoot.hidden = true;
}

function createArticleBanner(url, article, title) {
  const figure = el('figure', 'article-detail-banner');
  const image = document.createElement('img');
  image.src = url;
  image.alt = getImageAlt(article, title);
  image.loading = 'eager';
  image.decoding = 'async';
  image.width = 1200;
  image.height = 675;
  image.addEventListener('error', () => figure.remove(), { once: true });
  figure.append(image);
  return figure;
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
    if (!image.hasAttribute('alt')) image.alt = '';
  });

  body.querySelectorAll('p, blockquote, li').forEach((node) => {
    if (!isMostlyArabic(node.textContent)) return;
    node.classList.add('article-arabic');
    if (!node.hasAttribute('lang')) node.setAttribute('lang', 'ar');
    if (!node.hasAttribute('dir')) node.setAttribute('dir', 'rtl');
  });
}

function updateDocumentMetadata(article, title, summaryText, bannerUrl) {
  document.title = `${title} | VitaNusa AI`;
  setMetaContent('property', 'og:title', title);
  setMetaContent('property', 'og:type', 'article');

  if (summaryText) {
    setMetaContent('name', 'description', summaryText);
    setMetaContent('property', 'og:description', summaryText);
  }

  const publishedDate = getDate(article.publishedAt || article.createdAt);
  const updatedDate = getDate(article.updatedAt);
  if (publishedDate) setMetaContent('property', 'article:published_time', publishedDate.toISOString());
  if (updatedDate) setMetaContent('property', 'article:modified_time', updatedDate.toISOString());

  if (bannerUrl) {
    setMetaContent('property', 'og:image', new URL(bannerUrl, document.baseURI).href);
  } else {
    document.querySelector('meta[property="og:image"]')?.remove();
  }
}

function getCardMetadata(article) {
  return [formatArticleDate(article), getReadTime(article)].filter(Boolean);
}

function getDetailMetadata(article) {
  const author = getAuthorName(article);
  return [formatArticleDate(article, true), author ? `Oleh ${author}` : '', getReadTime(article)].filter(Boolean);
}

function createMetadata(items, className) {
  const metadata = el('p', className);
  items.forEach((item) => metadata.append(el('span', '', item)));
  return metadata;
}

function formatArticleDate(article, includeLabel = false) {
  const published = getDate(article?.publishedAt || article?.createdAt);
  const updated = getDate(article?.updatedAt);
  const useUpdated = updated && (!published || updated.getTime() > published.getTime() + 60_000);
  const selected = useUpdated ? updated : published;
  if (!selected) return '';

  const formatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(selected);

  if (!includeLabel) return formatted;
  return `${useUpdated ? 'Diperbarui' : 'Terbit'} ${formatted}`;
}

function getDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis());
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getReadTime(article) {
  const supplied = article?.readTime;
  if (typeof supplied === 'number' && Number.isFinite(supplied) && supplied > 0) {
    return `${Math.ceil(supplied)} menit baca`;
  }
  if (typeof supplied === 'string' && supplied.trim()) return supplied.trim();

  const text = htmlToPlainText(article?.contentHtml || '');
  const wordCount = text.split(/\s+/u).filter(Boolean).length;
  if (!wordCount) return '';
  return `${Math.max(1, Math.ceil(wordCount / 200))} menit baca`;
}

function getAuthorName(article) {
  const candidates = [article?.authorName, article?.author, article?.createdByName];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return cleanText(value);
}

function getRelatedScore(activeArticle, candidate) {
  let score = 0;
  const activeCategory = cleanText(activeArticle?.category).toLowerCase();
  const candidateCategory = cleanText(candidate?.category).toLowerCase();

  if (activeCategory && candidateCategory && activeCategory === candidateCategory) score += 5;

  const activeTags = new Set(normalizeTagList(activeArticle?.tags).map((tag) => tag.toLowerCase()));
  normalizeTagList(candidate?.tags).forEach((tag) => {
    if (activeTags.has(tag.toLowerCase())) score += 2;
  });

  return score;
}

function getImageAlt(article, title) {
  return cleanText(article?.bannerAlt || article?.imageAlt) || `Gambar utama artikel ${title}`;
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

function isVisiblePublishedArticle(article) {
  return article?.status === 'published';
}

function sortNewestFirst(a, b) {
  return getComparableDate(b) - getComparableDate(a);
}

function getComparableDate(article) {
  return getDate(article?.publishedAt || article?.updatedAt || article?.createdAt)?.getTime() || 0;
}

function getArticleSummary(article) {
  const source = cleanText(article?.summary) || htmlToPlainText(article?.contentHtml || '');
  return truncateText(source, 180);
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSearchCategory(article) {
  return [cleanText(article?.category), normalizeTagList(article?.tags).join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeTagList(tags) {
  if (Array.isArray(tags)) return tags.map(cleanText).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map(cleanText).filter(Boolean);
  return [];
}

function getSafeImageUrl(value) {
  const candidate = cleanText(value);
  if (!candidate || /[\u0000-\u001f]/u.test(candidate)) return '';
  if (/^(?:javascript|vbscript|data):/iu.test(candidate.replace(/\s+/gu, ''))) return '';

  try {
    const parsed = new URL(candidate, document.baseURI);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : '';
  } catch {
    return '';
  }
}

function isMostlyArabic(value) {
  const text = cleanText(value);
  if (!text) return false;
  const arabicCharacters = text.match(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/gu)?.length || 0;
  const letterCharacters = text.match(/[\p{L}\p{N}]/gu)?.length || 0;
  return arabicCharacters >= 4 && arabicCharacters / Math.max(letterCharacters, 1) >= 0.35;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
