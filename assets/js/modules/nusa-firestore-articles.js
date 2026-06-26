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

const MAX_LOADED_ARTICLES = 120;
const MAX_MATCHED_ARTICLES = 3;
const MIN_MATCH_SCORE = 5;
const DEFAULT_TITLE_LIMIT = 54;

const STOP_WORDS = new Set([
  'ada', 'agar', 'aku', 'apa', 'apakah', 'atau', 'bagaimana', 'bagi', 'bisa', 'buat', 'cara', 'dan', 'dari',
  'dengan', 'di', 'dong', 'ini', 'itu', 'jadi', 'jika', 'kalau', 'kan', 'ke', 'kok', 'lagi', 'lebih', 'mau',
  'membaca', 'mengenai', 'menurut', 'pakai', 'paling', 'saja', 'saya', 'sebagai', 'secara', 'sehari',
  'supaya', 'tentang', 'terkait', 'untuk', 'yang'
]);

const TOKEN_SYNONYMS = Object.freeze({
  kesehatan: ['sehat'],
  sehat: ['kesehatan'],
  badan: ['tubuh'],
  tubuh: ['badan'],
  jaga: ['menjaga', 'merawat'],
  menjaga: ['jaga', 'merawat'],
  merawat: ['jaga', 'menjaga'],
  klaim: ['testimoni', 'literasi'],
  testimoni: ['klaim', 'testi'],
  testi: ['testimoni', 'klaim'],
  produk: ['suplemen', 'katalog'],
  suplemen: ['produk'],
  habit: ['kebiasaan'],
  kebiasaan: ['habit', 'rutinitas'],
  pencernaan: ['perut', 'makan'],
  tidur: ['energi', 'lelah'],
  vitacheck: ['vita', 'check', 'kebiasaan']
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
    const publishedQuery = query(
      collection(db, 'articles'),
      where('status', '==', 'published'),
      limit(MAX_LOADED_ARTICLES)
    );
    const snapshot = await getDocs(publishedQuery);

    publishedArticlesCache = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter(isEligiblePublishedArticle)
      .sort(sortNewestFirst);

    return publishedArticlesCache;
  })().finally(() => {
    publishedArticlesLoadPromise = null;
  });

  return publishedArticlesLoadPromise;
}

export async function findMatchingFirestoreArticles(queryText, options = {}) {
  const normalizedQuery = normalizeSearchText(queryText);

  if (!shouldSearchFirestore(normalizedQuery, options)) return [];

  try {
    const articles = await loadPublishedFirestoreArticles();
    return articles
      .map((article) => ({ article, score: scoreArticle(article, normalizedQuery) }))
      .filter((entry) => entry.score >= MIN_MATCH_SCORE)
      .sort(sortScoredArticles)
      .slice(0, MAX_MATCHED_ARTICLES)
      .map((entry) => entry.article);
  } catch (error) {
    console.warn('[Nusa AI] Gagal mencari artikel Firestore:', error);
    return [];
  }
}

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  return normalizeWhitespace(
    rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, 'dan')
  );
}

export function scoreArticle(article, queryText) {
  if (!isEligiblePublishedArticle(article)) return 0;

  const normalizedQuery = normalizeSearchText(queryText);
  const queryTokens = getExpandedTokens(normalizedQuery);
  if (!queryTokens.length) return 0;

  const title = normalizeSearchText(article.title);
  const summary = normalizeSearchText(getArticleSummary(article));
  const category = normalizeSearchText(article.category);
  const slug = normalizeSearchText(article.slug);
  const tags = getTags(article.tags).map(normalizeSearchText).filter(Boolean);
  const contentText = normalizeSearchText(stripHtml(article.contentHtml));

  let score = 0;

  if (title && (normalizedQuery.includes(title) || title.includes(normalizedQuery))) {
    score += 8;
  }

  const titleTokens = getExpandedTokens(title);
  const titleOverlap = countTokenOverlap(queryTokens, titleTokens);
  if (titleOverlap >= Math.min(2, Math.max(1, titleTokens.length))) score += 5;
  score += titleOverlap * 2;

  for (const tag of tags) {
    if (tag && (normalizedQuery.includes(tag) || tag.includes(normalizedQuery))) {
      score += 4;
      continue;
    }
    score += countTokenOverlap(queryTokens, getExpandedTokens(tag)) * 4;
  }

  if (category && (normalizedQuery.includes(category) || category.includes(normalizedQuery))) score += 3;
  score += countTokenOverlap(queryTokens, getExpandedTokens(category)) * 3;

  score += Math.min(countTokenOverlap(queryTokens, getExpandedTokens(summary)) * 2, 8);
  score += Math.min(countTokenOverlap(queryTokens, getExpandedTokens(contentText)), 6);
  score += countTokenOverlap(queryTokens, getExpandedTokens(slug)) * 2;

  score += getContextBonus(queryTokens, [title, summary, category, slug, tags.join(' ')]);

  return score;
}

export function createFirestoreArticleAction(article) {
  if (!isEligiblePublishedArticle(article)) return null;

  return {
    label: `Baca Artikel: ${truncateTitle(article.title, DEFAULT_TITLE_LIMIT)}`,
    href: `articles/detail.html?slug=${encodeURIComponent(String(article.slug).trim())}`,
  };
}

function shouldSearchFirestore(normalizedQuery, options) {
  const tokens = getMeaningfulTokens(normalizedQuery);
  if (options.allowShortQuery) return normalizedQuery.length >= 3 && tokens.length >= 1;
  if (normalizedQuery.length < 8) return false;
  return tokens.length >= 2;
}

function isEligiblePublishedArticle(article) {
  return Boolean(
    article
    && article.status === 'published'
    && String(article.title || '').trim()
    && String(article.slug || '').trim()
  );
}

function getArticleSummary(article) {
  return article?.summary || article?.excerpt || article?.description || '';
}

function getTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function getMeaningfulTokens(normalizedText) {
  return [...new Set(
    String(normalizedText || '')
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  )];
}

function getExpandedTokens(normalizedText) {
  const tokens = getMeaningfulTokens(normalizedText);
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    (TOKEN_SYNONYMS[token] || []).forEach((synonym) => expanded.add(synonym));
  });

  return [...expanded];
}

function countTokenOverlap(queryTokens, targetTokens) {
  if (!queryTokens.length || !targetTokens.length) return 0;
  const targetSet = new Set(targetTokens);
  return queryTokens.reduce((count, token) => count + (targetSet.has(token) ? 1 : 0), 0);
}

function getContextBonus(queryTokens, normalizedFields) {
  const combinedText = normalizedFields.filter(Boolean).join(' ');
  let bonus = 0;

  if (queryTokens.some((token) => ['klaim', 'testimoni', 'testi'].includes(token)) && combinedText.includes('literasi')) {
    bonus += 2;
  }

  if (queryTokens.some((token) => ['sehat', 'kesehatan', 'kebiasaan', 'habit', 'rutinitas'].includes(token)) && /sehat|kebiasaan|habit|rutinitas/.test(combinedText)) {
    bonus += 2;
  }

  return bonus;
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
