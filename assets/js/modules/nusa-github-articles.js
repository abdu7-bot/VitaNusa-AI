const GITHUB_ARTICLE_MANIFEST_URL = new URL('../../../content/articles/github-knowledge-index.json?v=20260627-github-article-source-v2', import.meta.url);
const CACHE_VERSION = '20260627-github-article-source-v2';
const MAX_MATCHED_ARTICLES = 3;
const MAX_LOADED_ARTICLES = 120;
const MIN_MATCH_SCORE = 3;
const DEFAULT_TITLE_LIMIT = 54;

const STOP_WORDS = new Set(['ada','agar','aku','apa','apakah','atau','bagaimana','bagi','bisa','buat','cara','dan','dari','dengan','di','dong','ini','itu','jadi','jika','kalau','kan','ke','kok','lagi','lebih','mau','membaca','mengenai','menurut','pakai','paling','saja','saya','sebagai','secara','sehari','supaya','tentang','terkait','untuk','yang']);
const REQUIRED_TEXT_FIELDS = Object.freeze(['title','slug','summary','file','category','intentTarget','riskLevel','contentDepth','primaryAction']);
const REQUIRED_BOOLEAN_FIELDS = Object.freeze(['isMedicalSensitive','isProductSensitive','isIslamicSensitive']);
const VALID_RISK_LEVELS = new Set(['low','medium','high']);
const VALID_PRIMARY_ACTIONS = new Set(['read-article','start-vitacheck','read-prinsip-amanah','contact-admin','seek-professional-help','view-products']);
const BLOCKED_PATH_HINTS = Object.freeze(['/draft/','/drafts/','-drafts-','/archived/','/archive/','-archived-']);

let manifestCache = null;
let manifestLoadPromise = null;
const htmlCache = new Map();

export async function loadGitHubArticleManifest() {
  if (manifestCache) return manifestCache;
  if (manifestLoadPromise) return manifestLoadPromise;
  manifestLoadPromise = (async () => {
    const response = await fetch(GITHUB_ARTICLE_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GitHub article manifest failed: ${response.status}`);
    const rawItems = await response.json();
    const items = Array.isArray(rawItems) ? rawItems : [];
    manifestCache = items.slice(0, MAX_LOADED_ARTICLES).filter(isEligiblePublishedGitHubArticle).sort(sortNewestFirst);
    return manifestCache;
  })().catch((error) => {
    console.warn('GitHub article manifest fallback:', error);
    manifestCache = [];
    return manifestCache;
  }).finally(() => { manifestLoadPromise = null; });
  return manifestLoadPromise;
}

export async function loadPublishedGitHubArticles() { return loadGitHubArticleManifest(); }

export async function findMatchingGitHubArticles(queryText, options = {}) {
  const matches = await findScoredMatchingGitHubArticles(queryText, options);
  return matches.map((entry) => entry.article);
}

export async function findScoredMatchingGitHubArticles(queryText, options = {}) {
  const normalizedQuery = normalizeSearchText(queryText);
  if (!shouldSearchGitHubArticles(normalizedQuery, options)) return [];
  try {
    const articles = await loadPublishedGitHubArticles();
    const hydratedArticles = await Promise.all(articles.map(hydrateArticleContentForSearch));
    return hydratedArticles
      .map((article) => ({ source: 'github', article, score: scoreGitHubArticle(article, normalizedQuery, options) }))
      .filter((entry) => entry.score >= MIN_MATCH_SCORE)
      .sort(sortScoredArticles)
      .slice(0, MAX_MATCHED_ARTICLES);
  } catch (error) {
    console.warn('GitHub article search failed:', error);
    return [];
  }
}

export async function loadGitHubArticleBySlug(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;
  const articles = await loadPublishedGitHubArticles();
  const article = articles.find((item) => normalizeSlug(item.slug) === normalizedSlug);
  if (!article || !isEligiblePublishedGitHubArticle(article)) return null;
  const contentHtml = await fetchGitHubArticleHtml(article);
  if (!contentHtml) return null;
  return { ...article, contentHtml };
}

export async function fetchGitHubArticleHtml(article) {
  if (!isEligiblePublishedGitHubArticle(article)) return '';
  const safeFile = normalizeSafeFilePath(article.file);
  if (!safeFile) return '';
  if (htmlCache.has(safeFile)) return htmlCache.get(safeFile);
  try {
    const url = new URL(`../../../${safeFile}`, import.meta.url);
    url.searchParams.set('v', CACHE_VERSION);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GitHub article file failed: ${response.status}`);
    const html = await response.text();
    const sanitizedHtml = sanitizeArticleHtml(html);
    htmlCache.set(safeFile, sanitizedHtml);
    return sanitizedHtml;
  } catch (error) {
    console.warn('GitHub article file fallback:', error);
    htmlCache.set(safeFile, '');
    return '';
  }
}

export function createGitHubArticleAction(article) {
  if (!isEligiblePublishedGitHubArticle(article)) return null;
  return {
    label: `Baca Artikel: ${truncateTitle(article.title, DEFAULT_TITLE_LIMIT)}`,
    href: `articles/detail.html?source=github&slug=${encodeURIComponent(String(article.slug).trim())}`,
  };
}

function shouldSearchGitHubArticles(normalizedQuery, options) {
  const tokens = getMeaningfulTokens(normalizedQuery);
  if (options.allowShortQuery) return normalizedQuery.length >= 3 && tokens.length >= 1;
  return normalizedQuery.length >= 8 && tokens.length >= 2;
}

function hydrateArticleContentForSearch(article) {
  return fetchGitHubArticleHtml(article).then((contentHtml) => ({ ...article, contentHtml }));
}

function isEligiblePublishedGitHubArticle(article) {
  if (!article || article.status !== 'published') return false;
  for (const field of REQUIRED_TEXT_FIELDS) if (!String(article[field] || '').trim()) return false;
  for (const field of REQUIRED_BOOLEAN_FIELDS) if (typeof article[field] !== 'boolean') return false;
  if (!VALID_RISK_LEVELS.has(normalizeSearchText(article.riskLevel))) return false;
  if (!VALID_PRIMARY_ACTIONS.has(normalizeSearchText(article.primaryAction))) return false;
  if (!isSlug(article.slug)) return false;
  if (!normalizeSafeFilePath(article.file)) return false;
  if (!Array.isArray(article.tags) || !article.tags.map(String).some((tag) => tag.trim())) return false;
  if (!Array.isArray(article.relatedArticles) || !article.relatedArticles.every(isSlug)) return false;
  if (article.isProductSensitive === true && article.isMedicalSensitive === true && article.primaryAction === 'view-products') return false;
  return true;
}

function scoreGitHubArticle(article, queryText, options = {}) {
  if (!isEligiblePublishedGitHubArticle(article)) return 0;
  const queryTokens = getMeaningfulTokens(normalizeSearchText(queryText));
  if (!queryTokens.length) return 0;
  const fields = [article.title, article.summary, article.category, article.slug, article.intentTarget, article.riskLevel, ...(Array.isArray(article.tags) ? article.tags : []), ...(Array.isArray(article.relatedArticles) ? article.relatedArticles : []), stripHtml(article.contentHtml)].map(normalizeSearchText);
  const fieldTokens = getMeaningfulTokens(fields.join(' '));
  let score = countTokenOverlap(queryTokens, fieldTokens);
  if (getIntentTargets(options.intentId).includes(normalizeSearchText(article.intentTarget))) score += 4;
  if (article.riskLevel === 'low') score += 1;
  return score;
}

function getIntentTargets(intentId) {
  const map = {
    article: ['article-general'],
    'article-specific': ['article-general'],
    'general-health': ['general-health','article-general'],
    habit: ['habit','general-health'],
    'vitacheck-start': ['vitacheck','habit'],
    testimonial: ['testimonial','product-claim'],
    'product-shortcut': ['product-claim','product-safety'],
    amanah: ['amanah'],
    tawakal: ['islamic-reflection'],
  };
  return map[intentId] || [];
}

function initGitHubDetailPage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const detailRoot = document.querySelector('[data-public-article-detail]');
  if (!detailRoot) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('source') !== 'github') return;
  detailRoot.removeAttribute('data-public-article-detail');
  loadGitHubDetailInto(detailRoot, params.get('slug'));
}

async function loadGitHubDetailInto(detailRoot, slug) {
  renderDetailMessage(detailRoot, 'Memuat artikel...');
  try {
    const article = await loadGitHubArticleBySlug(slug);
    if (!article) return renderDetailMessage(detailRoot, 'Artikel belum tersedia untuk publik.');
    renderArticleDetail(detailRoot, article);
  } catch (error) {
    console.warn('GitHub article detail fallback:', error);
    renderDetailMessage(detailRoot, 'Artikel belum tersedia untuk publik.');
  }
}

function renderArticleDetail(detailRoot, article) {
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
  meta.textContent = `VitaNusa AI • GitHub Article Source • ${article.readTime || '5 menit baca'}`;
  const summary = document.createElement('p');
  summary.className = 'article-summary';
  summary.textContent = article.summary || '';
  header.append(category, title, meta, createTagList(article.tags), summary);
  const body = document.createElement('article');
  body.className = 'article-detail-body';
  body.innerHTML = sanitizeArticleHtml(article.contentHtml || '<p>Konten artikel belum tersedia.</p>');
  detailRoot.append(header, body);
  document.title = `${article.title || 'Artikel'} | VitaNusa AI`;
}

function renderDetailMessage(detailRoot, message) {
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

function createTagList(tags) {
  const tagList = document.createElement('div');
  tagList.className = 'article-tags';
  if (!Array.isArray(tags)) return tagList;
  tags.slice(0, 5).forEach((tag) => {
    const pill = document.createElement('span');
    pill.textContent = String(tag || '').trim();
    tagList.append(pill);
  });
  return tagList;
}

function sanitizeArticleHtml(html) {
  if (typeof DOMParser !== 'function') return '';
  const parsed = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((element) => element.remove());
  parsed.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = String(attribute.value || '').trim().toLowerCase();
      if (name.startsWith('on')) element.removeAttribute(attribute.name);
      if ((name === 'href' || name === 'src') && !(value.startsWith('http://') || value.startsWith('https://') || value.startsWith('#') || value.startsWith('/'))) element.removeAttribute(attribute.name);
    });
  });
  return parsed.body.innerHTML;
}

function stripHtml(value) {
  if (typeof DOMParser !== 'function') return '';
  const parsed = new DOMParser().parseFromString(`<div>${String(value || '')}</div>`, 'text/html');
  parsed.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((element) => element.remove());
  return normalizeWhitespace(parsed.body.textContent || '');
}

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' dan ').replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSlug(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return isSlug(normalized) ? normalized : '';
}

function normalizeSafeFilePath(filePath) {
  const safeFile = String(filePath || '').trim();
  const normalized = safeFile.toLowerCase();
  if (!safeFile) return '';
  if (safeFile.startsWith('/') || safeFile.includes('..') || safeFile.includes('://')) return '';
  if (!safeFile.startsWith('content/articles/')) return '';
  if (!safeFile.endsWith('.html')) return '';
  if (BLOCKED_PATH_HINTS.some((hint) => normalized.includes(hint))) return '';
  return safeFile;
}

function isSlug(value) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || '').trim()); }
function getMeaningfulTokens(text) { return [...new Set(String(text || '').split(' ').map((token) => token.trim()).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))]; }
function countTokenOverlap(queryTokens, targetTokens) { const targetSet = new Set(targetTokens); return queryTokens.reduce((count, token) => count + (targetSet.has(token) ? 1 : 0), 0); }
function truncateTitle(title, maxLength) { const cleanTitle = normalizeWhitespace(title); return cleanTitle.length <= maxLength ? cleanTitle : `${cleanTitle.slice(0, maxLength - 1).trimEnd()}…`; }
function normalizeWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function sortScoredArticles(a, b) { if (b.score !== a.score) return b.score - a.score; return getTimestampValue(b.article.publishedAt || b.article.updatedAt) - getTimestampValue(a.article.publishedAt || a.article.updatedAt); }
function sortNewestFirst(a, b) { return getTimestampValue(b.publishedAt || b.updatedAt) - getTimestampValue(a.publishedAt || a.updatedAt); }
function getTimestampValue(value) { if (!value) return 0; if (typeof value.toMillis === 'function') return value.toMillis(); if (value.seconds) return value.seconds * 1000; if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? 0 : parsed; } return 0; }

initGitHubDetailPage();
