import { firebaseConfig } from '../../../admin/firebase-config.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const MAX_LOADED_ARTICLES = 120;
const MAX_MATCHED_ARTICLES = 3;
const MIN_MATCH_SCORE = 5;
const DEFAULT_TITLE_LIMIT = 54;

const STOP_WORDS = new Set(['ada','agar','aku','apa','apakah','atau','bagaimana','bagi','bisa','buat','cara','dan','dari','dengan','di','dong','ini','itu','jadi','jika','kalau','kan','ke','kok','lagi','lebih','mau','membaca','mengenai','menurut','pakai','paling','saja','saya','sebagai','secara','sehari','supaya','tentang','terkait','untuk','yang']);

const TOKEN_SYNONYMS = Object.freeze({
  kesehatan: ['sehat'], sehat: ['kesehatan'], badan: ['tubuh'], tubuh: ['badan'],
  jaga: ['menjaga','merawat'], menjaga: ['jaga','merawat'], merawat: ['jaga','menjaga'],
  klaim: ['testimoni','literasi','produk'], testimoni: ['klaim','testi'], testi: ['testimoni','klaim'],
  produk: ['suplemen','katalog','klaim'], suplemen: ['produk'], habit: ['kebiasaan'],
  kebiasaan: ['habit','rutinitas'], pencernaan: ['perut','makan'], tidur: ['energi','lelah'],
  vitacheck: ['vita','check','kebiasaan'], tawakal: ['ikhtiar','amanah'], amanah: ['tabayyun','tawakal','ikhtiar']
});

const INTENT_TARGET_HINTS = Object.freeze({
  'general-health': ['sehat','kesehatan','tubuh','badan','menjaga','merawat','hidup sehat'],
  habit: ['kebiasaan','habit','rutinitas','tidur','makan','minum','gerak','energi','pencernaan'],
  vitacheck: ['vitacheck','vita check','cek kebiasaan','skor kebiasaan'],
  testimonial: ['testimoni','testi','bukti','katanya ' + 'sembuh','pengalaman orang'],
  'product-claim': ['klaim','klaim produk','hasil ' + 'instan','pasti ' + 'sembuh','katanya ampuh','menyem' + 'buhkan'],
  'product-safety': ['label','aman','batas klaim','cek klik','komposisi','efek samping'],
  'product-general': ['produk','katalog','langfit','deto pro','propolis','reseller'],
  'serious-complaint-education': ['kapan harus ke dokter','tenaga kesehatan','keluhan berat','memburuk','darurat'],
  'islamic-reflection': ['tawakal','ikhtiar','syukur','adab','rahmat','islam'],
  amanah: ['amanah','tabayyun','produk belakangan','edukasi dulu','batas promosi'],
  'article-general': ['artikel','edukasi','bacaan','belajar']
});

const NUSA_INTENT_TO_TARGETS = Object.freeze({
  'general-health': ['general-health'], habit: ['habit','general-health'], 'vitacheck-start': ['vitacheck','habit'],
  testimonial: ['testimonial','product-claim'], 'product-shortcut': ['product-claim','product-safety','amanah'],
  product: ['product-general','product-safety'], amanah: ['amanah','islamic-reflection'], tawakal: ['islamic-reflection','amanah'],
  'article-specific': ['article-general'], article: ['article-general']
});

let publishedArticlesCache = null;
let publishedArticlesLoadPromise = null;

function getDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

export async function loadPublishedFirestoreArticles() {
  if (publishedArticlesCache) return publishedArticlesCache;
  if (publishedArticlesLoadPromise) return publishedArticlesLoadPromise;

  publishedArticlesLoadPromise = (async () => {
    const db = getDb();
    const publishedQuery = query(collection(db, 'articles'), where('status', '==', 'published'), limit(MAX_LOADED_ARTICLES));
    const snapshot = await getDocs(publishedQuery);
    publishedArticlesCache = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter(isEligiblePublishedArticle).sort(sortNewestFirst);
    return publishedArticlesCache;
  })().finally(() => { publishedArticlesLoadPromise = null; });

  return publishedArticlesLoadPromise;
}

export async function findMatchingFirestoreArticles(queryText, options = {}) {
  const normalizedQuery = normalizeSearchText(queryText);
  if (!shouldSearchFirestore(normalizedQuery, options)) return [];
  try {
    const articles = await loadPublishedFirestoreArticles();
    return articles
      .map((article) => ({ article, score: scoreArticle(article, normalizedQuery, options) }))
      .filter((entry) => entry.score >= MIN_MATCH_SCORE)
      .sort(sortScoredArticles)
      .slice(0, MAX_MATCHED_ARTICLES)
      .map((entry) => entry.article);
  } catch (error) {
    console.warn('Firestore article search failed:', error);
    return [];
  }
}

export function normalizeSearchText(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' dan ').replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stripHtml(value) {
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

export function scoreArticle(article, queryText, options = {}) {
  if (!isEligiblePublishedArticle(article)) return 0;
  const normalizedQuery = normalizeSearchText(queryText);
  const queryTokens = getExpandedTokens(normalizedQuery);
  if (!queryTokens.length) return 0;

  const title = normalizeSearchText(article.title);
  const summary = normalizeSearchText(getArticleSummary(article));
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

export function createFirestoreArticleAction(article) {
  if (!isEligiblePublishedArticle(article)) return null;
  return { label: `Baca Artikel: ${truncateTitle(article.title, DEFAULT_TITLE_LIMIT)}`, href: `articles/detail.html?slug=${encodeURIComponent(String(article.slug).trim())}` };
}

function shouldSearchFirestore(normalizedQuery, options) {
  const tokens = getMeaningfulTokens(normalizedQuery);
  if (options.allowShortQuery) return normalizedQuery.length >= 3 && tokens.length >= 1;
  if (normalizedQuery.length < 8) return false;
  return tokens.length >= 2;
}

function isEligiblePublishedArticle(article) {
  return Boolean(article && article.status === 'published' && String(article.title || '').trim() && String(article.slug || '').trim());
}

function getArticleSummary(article) { return article?.summary || article?.excerpt || article?.description || ''; }
function getTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}
function getMeaningfulTokens(normalizedText) { return [...new Set(String(normalizedText || '').split(' ').map((token) => token.trim()).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))]; }
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
function getDetectedIntentTargets(normalizedQuery, explicitIntentId) {
  const detected = new Set(NUSA_INTENT_TO_TARGETS[explicitIntentId] || []);
  Object.entries(INTENT_TARGET_HINTS).forEach(([target, hints]) => { if (hints.some((hint) => normalizedQuery.includes(normalizeSearchText(hint)))) detected.add(target); });
  if (!detected.size) detected.add('article-general');
  return [...detected];
}
function getSensitiveMetadataBonus(article, detectedIntentTargets, normalizedQuery) {
  let bonus = 0;
  const targetSet = new Set(detectedIntentTargets);
  const isProductIntent = targetSet.has('testimonial') || targetSet.has('product-claim') || targetSet.has('product-safety') || targetSet.has('product-general');
  const isHealthIntent = targetSet.has('general-health') || targetSet.has('habit') || targetSet.has('vitacheck') || targetSet.has('serious-complaint-education');
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
  if (queryTokens.some((token) => ['tawakal','ikhtiar','amanah','tabayyun'].includes(token)) && /tawakal|ikhtiar|amanah|tabayyun|islamic-reflection/.test(combinedText)) bonus += 2;
  return bonus;
}
function truncateTitle(title, maxLength) {
  const cleanTitle = normalizeWhitespace(title);
  if (cleanTitle.length <= maxLength) return cleanTitle;
  return `${cleanTitle.slice(0, maxLength - 1).trimEnd()}…`;
}
function normalizeWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function sortScoredArticles(a, b) { if (b.score !== a.score) return b.score - a.score; return getTimestampValue(b.article.publishedAt || b.article.updatedAt) - getTimestampValue(a.article.publishedAt || a.article.updatedAt); }
function sortNewestFirst(a, b) { return getTimestampValue(b.publishedAt || b.updatedAt) - getTimestampValue(a.publishedAt || a.updatedAt); }
function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? 0 : parsed; }
  return 0;
}
