const GITHUB_ARTICLE_MANIFEST_URL = new URL('../../../content/articles/github-knowledge-index.json?v=20260627-github-article-source-v1', import.meta.url);
const CACHE_VERSION = '20260627-github-article-source-v1';
const MAX_MATCHED_ARTICLES = 3;
const MAX_LOADED_ARTICLES = 120;
const MIN_MATCH_SCORE = 5;
const DEFAULT_TITLE_LIMIT = 54;

const STOP_WORDS = new Set(['ada','agar','aku','apa','apakah','atau','bagaimana','bagi','bisa','buat','cara','dan','dari','dengan','di','dong','ini','itu','jadi','jika','kalau','kan','ke','kok','lagi','lebih','mau','membaca','mengenai','menurut','pakai','paling','saja','saya','sebagai','secara','sehari','supaya','tentang','terkait','untuk','yang']);

const TOKEN_SYNONYMS = Object.freeze({
  kesehatan: ['sehat'], sehat: ['kesehatan'], badan: ['tubuh'], tubuh: ['badan'],
  jaga: ['menjaga','merawat'], menjaga: ['jaga','merawat'], merawat: ['jaga','menjaga'],
  klaim: ['testimoni','literasi','produk'], testimoni: ['klaim','testi'], testi: ['testimoni','klaim'],
  produk: ['suplemen','katalog','klaim'], suplemen: ['produk'], habit: ['kebiasaan'],
  kebiasaan: ['habit','rutinitas'], pencernaan: ['perut','makan'], tidur: ['energi','lelah'],
  vitacheck: ['vita','check','kebiasaan'], tawakal: ['ikhtiar','amanah'], tawakkal: ['tawakal','ikhtiar'],
  ikhtiar: ['tawakal','amanah'], amanah: ['tabayyun','tawakal','ikhtiar'], tabayyun: ['amanah','klaim']
});

const INTENT_TARGET_HINTS = Object.freeze({
  'general-health': ['sehat','kesehatan','tubuh','badan','menjaga','merawat','hidup sehat'],
  habit: ['kebiasaan','habit','rutinitas','tidur','makan','minum','gerak','energi','pencernaan'],
  vitacheck: ['vitacheck','vita check','cek kebiasaan','skor kebiasaan'],
  testimonial: ['testimoni','testi','bukti','pengalaman orang'],
  'product-claim': ['klaim','klaim produk','hasil instan','pasti sembuh','katanya ampuh'],
  'product-safety': ['label','aman','batas klaim','cek klik','komposisi','efek samping'],
  'product-general': ['produk','katalog','langfit','deto pro','propolis','reseller'],
  'islamic-reflection': ['tawakal','tawakkal','ikhtiar','syukur','adab','rahmat','islam'],
  amanah: ['amanah','tabayyun','produk belakangan','edukasi dulu','batas promosi'],
  'article-general': ['artikel','edukasi','bacaan','belajar']
});

const NUSA_INTENT_TO_TARGETS = Object.freeze({
  'general-health': ['general-health'],
  habit: ['habit','general-health'],
  'vitacheck-start': ['vitacheck','habit'],
  testimonial: ['testimonial','product-claim'],
  'product-shortcut': ['product-claim','product-safety','amanah'],
  product: ['product-general','product-safety'],
  amanah: ['amanah','islamic-reflection'],
  tawakal: ['islamic-reflection','amanah'],
  'article-specific': ['article-general'],
  article: ['article-general']
});

const REQUIRED_TEXT_FIELDS = Object.freeze(['title','slug','summary','file','category','intentTarget','riskLevel','contentDepth','primaryAction']);
const REQUIRED_BOOLEAN_FIELDS = Object.freeze(['isMedicalSensitive','isProductSensitive','isIslamicSensitive']);
const VALID_RISK_LEVELS = new Set(['low','medium','high']);
const VALID_PRIMARY_ACTIONS = new Set(['read-article','view-products','start-vitacheck','contact-admin']);
const ISLAMIC_HINTS = ['islam','islami','tawakal','tawakkal','ikhtiar','tabayyun','amanah','syukur','adab','tauhid'];

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
    manifestCache = items
      .slice(0, MAX_LOADED_ARTICLES)
      .filter(isEligiblePublishedGitHubArticle)
      .sort(sortNewestFirst);
    return manifestCache;
  })().catch((error) => {
    console.warn('GitHub article manifest fallback:', error);
    manifestCache = [];
    return manifestCache;
  }).finally(() => { manifestLoadPromise = null; });

  return manifestLoadPromise;
}

export async function loadPublishedGitHubArticles() {
  return loadGitHubArticleManifest();
}

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
    const response = await fetch(url);
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
  if (normalizedQuery.length < 8) return false;
  return tokens.length >= 2;
}

function hydrateArticleContentForSearch(article) {
  return fetchGitHubArticleHtml(article).then((contentHtml) => ({ ...article, contentHtml }));
}

function isEligiblePublishedGitHubArticle(article) {
  if (!article || article.status !== 'published') return false;

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!String(article[field] || '').trim()) return false;
  }

  for (const field of REQUIRED_BOOLEAN_FIELDS) {
    if (typeof article[field] !== 'boolean') return false;
  }

  const riskLevel = normalizeSearchText(article.riskLevel);
  if (!VALID_RISK_LEVELS.has(riskLevel)) return false;

  const primaryAction = normalizeSearchText(article.primaryAction);
  if (!VALID_PRIMARY_ACTIONS.has(primaryAction)) return false;

  if (!isSlug(article.slug)) return false;
  if (!normalizeSafeFilePath(article.file)) return false;
  if (!Array.isArray(article.tags) || !article.tags.map(String).some((tag) => tag.trim())) return false;
  if (!Array.isArray(article.relatedArticles) || !article.relatedArticles.every(isSlug)) return false;

  if (looksLikeIslamicArticle(article) && article.isIslamicSensitive !== true) return false;

  if (
    article.isProductSensitive === true &&
    primaryAction === 'view-products' &&
    (riskLevel === 'high' || article.isMedicalSensitive === true)
  ) {
    return false;
  }

  return true;
}

function scoreGitHubArticle(article, queryText, options = {}) {
  if (!isEligiblePublishedGitHubArticle(article)) return 0;
  const normalizedQuery = normalizeSearchText(queryText);
  const queryTokens = getExpandedTokens(normalizedQuery);
  if (!queryTokens.length) return 0;

  const title = normalizeSearchText(article.title);
  const summary = normalizeSearchText(article.summary);
  const category = normalizeSearchText(article.category);
  const slug = normalizeSearchText(article.slug);
  const intentTarget = normalizeSearchText(article.intentTarget);
  const riskLevel = normalizeSearchText(article.riskLevel || 'low');
  const tags = getTags(article.tags).map(normalizeSearchText).filter(Boolean);
  const relatedArticles = getTags(article.relatedArticles).map(normalizeSearchText).filter(Boolean);
  const contentText = normalizeSearchText(stripHtml(article.contentHtml));
  const detectedIntentTargets = getDetectedIntentTargets(normalizedQuery, options.intentId);
  let score = 0;

  if (title && (normalizedQuery.includes(title) || title.includes(normalizedQuery))) score += 8;
  score += countTokenOverlap(queryTokens, getExpandedTokens(title)) * 4;
  if (intentTarget && detectedIntentTargets.includes(intentTarget)) score += 6;
  if (intentTarget) score += countTokenOverlap(queryTokens, getExpandedTokens(intentTarget)) * 3;
  for (const tag of tags) {
    if (tag && (normalizedQuery.includes(tag) || tag.includes(normalizedQuery))) { score += 4; continue; }
    score += countTokenOverlap(queryTokens, getExpandedTokens(tag)) * 4;
  }
  if (category && (normalizedQuery.includes(category) || category.includes(normalizedQuery))) score += 3;
  score += countTokenOverlap(queryTokens, getExpandedTokens(category)) * 3;
  score += Math.min(countTokenOverlap(queryTokens, getExpandedTokens(summary)) * 2, 8);
  score += Math.min(countTokenOverlap(queryTokens, getExpandedTokens(contentText)), 6);
  score += countTokenOverlap(queryTokens, getExpandedTokens(slug)) * 2;
  score += Math.min(countTokenOverlap(queryTokens, relatedArticles.flatMap(getExpandedTokens)) * 1, 3);
  score += getSensitiveMetadataBonus(article, detectedIntentTargets, normalizedQuery);
  score += getContextBonus(queryTokens, [title, summary, category, slug, intentTarget, tags.join(' '), riskLevel]);
  return score;
}

function getDetectedIntentTargets(normalizedQuery, explicitIntentId) {
  const detected = new Set(NUSA_INTENT_TO_TARGETS[explicitIntentId] || []);
  Object.entries(INTENT_TARGET_HINTS).forEach(([target, hints]) => {
    if (hints.some((hint) => normalizedQuery.includes(normalizeSearchText(hint)))) detected.add(target);
  });
  if (!detected.size) detected.add('article-general');
  return [...detected];
}

function getSensitiveMetadataBonus(article, detectedIntentTargets, normalizedQuery) {
  let bonus = 0;
  const targetSet = new Set(detectedIntentTargets);
  const isProductIntent = targetSet.has('testimonial') || targetSet.has('product-claim') || targetSet.has('product-safety') || targetSet.has('product-general');
  const isHealthIntent = targetSet.has('general-health') || targetSet.has('habit') || targetSet.has('vitacheck');
  const isIslamicIntent = targetSet.has('islamic-reflection') || targetSet.has('amanah');

  if (article.isProductSensitive && isProductIntent) bonus += 3;
  if (article.isProductSensitive && !isProductIntent && !normalizedQuery.includes('produk')) bonus -= 1;
  if (article.isMedicalSensitive && isHealthIntent) bonus += 1;
  if (article.isIslamicSensitive && isIslamicIntent) bonus += 3;
  return bonus;
}

function getContextBonus(queryTokens, normalizedFields) {
  const combinedText = normalizedFields.filter(Boolean).join(' ');
  let bonus = 0;
  if (queryTokens.some((token) => ['klaim','testimoni','testi'].includes(token)) && /literasi|klaim|testimoni|produk/.test(combinedText)) bonus += 2;
  if (queryTokens.some((token) => ['sehat','kesehatan','kebiasaan','habit','rutinitas'].includes(token)) && /sehat|kebiasaan|habit|rutinitas|amanah/.test(combinedText)) bonus += 2;
  if (queryTokens.some((token) => ['tawakal','tawakkal','ikhtiar','amanah','tabayyun'].includes(token)) && /tawakal|tawakkal|ikhtiar|amanah|tabayyun|islamic-reflection/.test(combinedText)) bonus += 2;
  return bonus;
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
    if (!article) {
      renderDetailMessage(detailRoot, 'Artikel belum tersedia untuk publik.');
      return;
    }

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

  if (!Array.isArray(tags) || !tags.length) return tagList;

  tags.slice(0, 5).forEach((tag) => {
    const pill = document.createElement('span');
    pill.textContent = String(tag || '').trim();
    tagList.append(pill);
  });

  return tagList;
}

function sanitizeArticleHtml(html) {
  const rawHtml = String(html || '');
  if (!rawHtml) return '';

  if (typeof DOMParser !== 'function') {
    return rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
  const unsafeUrlPrefix = 'java' + 'script:';

  parsed.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((element) => element.remove());

  parsed.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = String(attribute.value || '').trim().toLowerCase();

      if (name.startsWith('on')) element.removeAttribute(attribute.name);
      if ((name === 'href' || name === 'src') && value.startsWith(unsafeUrlPrefix)) element.removeAttribute(attribute.name);
    });
  });

  return parsed.body.innerHTML;
}

function stripHtml(value) {
  const rawHtml = String(value || '');
  if (!rawHtml) return '';
  if (typeof DOMParser === 'function') {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
    parsed.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((element) => element.remove());
    return normalizeWhitespace(parsed.body.textContent || '');
  }
  return normalizeWhitespace(rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, 'dan'));
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
  if (!safeFile) return '';
  if (safeFile.startsWith('/') || safeFile.includes('..') || /^https?:\/\//i.test(safeFile)) return '';
  if (!safeFile.startsWith('content/articles/')) return '';
  if (!safeFile.endsWith('.html')) return '';
  return safeFile;
}

function isSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || '').trim());
}

function looksLikeIslamicArticle(article) {
  const combined = normalizeSearchText([
    article.title,
    article.summary,
    article.category,
    article.intentTarget,
    ...(Array.isArray(article.tags) ? article.tags : []),
  ].filter(Boolean).join(' '));

  return ISLAMIC_HINTS.some((hint) => combined.includes(hint));
}

function getTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function getMeaningfulTokens(normalizedText) {
  return [...new Set(String(normalizedText || '').split(' ').map((token) => token.trim()).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))];
}

function getExpandedTokens(normalizedText) {
  const tokens = getMeaningfulTokens(normalizedText);
  const expanded = new Set(tokens);
  tokens.forEach((token) => { (TOKEN_SYNONYMS[token] || []).forEach((synonym) => expanded.add(synonym)); });
  return [...expanded];
}

function countTokenOverlap(queryTokens, targetTokens) {
  if (!queryTokens.length || !targetTokens.length) return 0;
  const targetSet = new Set(targetTokens);
  return queryTokens.reduce((count, token) => count + (targetSet.has(token) ? 1 : 0), 0);
}

function truncateTitle(title, maxLength) {
  const cleanTitle = normalizeWhitespace(title);
  if (cleanTitle.length <= maxLength) return cleanTitle;
  return `${cleanTitle.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sortScoredArticles(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return getTimestampValue(b.article.publishedAt || b.article.updatedAt) - getTimestampValue(a.article.publishedAt || a.article.updatedAt);
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

initGitHubDetailPage();
