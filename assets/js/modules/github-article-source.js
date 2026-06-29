const MANIFEST_URL = new URL('../../../articles/github-article-manifest.json', import.meta.url);
const MAX_LOADED_ARTICLES = 12;
const MAX_MATCHED_ARTICLES = 2;
const MIN_MATCH_SCORE = 5;
const DEFAULT_TITLE_LIMIT = 54;
const STOP_WORDS = new Set(['ada','agar','aku','apa','apakah','atau','bagaimana','bagi','bisa','buat','cara','dan','dari','dengan','di','dong','ini','itu','jadi','jika','kalau','kan','ke','kok','lagi','lebih','mau','membaca','mengenai','menurut','pakai','paling','saja','saya','sebagai','secara','sehari','supaya','tentang','terkait','untuk','yang']);
const TOKEN_SYNONYMS = Object.freeze({ kesehatan:['sehat'], sehat:['kesehatan'], badan:['tubuh'], tubuh:['badan'], jaga:['menjaga','merawat'], menjaga:['jaga','merawat'], merawat:['jaga','menjaga'], klaim:['testimoni','literasi','produk'], testimoni:['klaim','testi'], testi:['testimoni','klaim'], produk:['suplemen','katalog','klaim'], suplemen:['produk'], habit:['kebiasaan'], kebiasaan:['habit','rutinitas'], pencernaan:['perut','makan'], tidur:['energi','lelah'], vitacheck:['vita','check','kebiasaan'], tawakal:['ikhtiar','amanah'], amanah:['tabayyun','tawakal','ikhtiar'] });
const INTENT_TARGET_HINTS = Object.freeze({
  'general-health':['sehat','kesehatan','tubuh','badan','menjaga','merawat','hidup sehat'],
  habit:['kebiasaan','habit','rutinitas','tidur','makan','minum','gerak','energi','pencernaan'],
  vitacheck:['vitacheck','vita check','cek kebiasaan','skor kebiasaan'],
  testimonial:['testimoni','testi','bukti','pengalaman orang'],
  'product-claim':['klaim','klaim produk','hasil instan','katanya ampuh','pulih total'],
  'product-safety':['label','aman','batas klaim','cek klik','komposisi','efek samping'],
  'product-general':['produk','katalog','langfit','deto pro','propolis','reseller'],
  'serious-complaint-education':['ahli medis','keluhan berat','memburuk','darurat'],
  'islamic-reflection':['tawakal','ikhtiar','syukur','adab','rahmat','islam'],
  amanah:['amanah','tabayyun','produk belakangan','edukasi dulu','batas promosi'],
  'article-general':['artikel','edukasi','bacaan','belajar']
});
const NUSA_INTENT_TO_TARGETS = Object.freeze({ 'general-health':['general-health'], habit:['habit','general-health'], 'vitacheck-start':['vitacheck','habit'], testimonial:['testimonial','product-claim'], 'product-shortcut':['product-claim','product-safety','amanah'], product:['product-general','product-safety'], amanah:['amanah','islamic-reflection'], tawakal:['islamic-reflection','amanah'], 'article-specific':['article-general'], article:['article-general'] });

let publishedArticlesCache = null;
let publishedArticlesLoadPromise = null;

export async function loadPublishedGithubArticles(){
  if (publishedArticlesCache) return publishedArticlesCache;
  if (publishedArticlesLoadPromise) return publishedArticlesLoadPromise;
  publishedArticlesLoadPromise = (async()=>{
    const manifest = await fetchJson(MANIFEST_URL);
    const entries = Array.isArray(manifest?.articles) ? manifest.articles : [];
    const publishedEntries = entries.filter(isEligibleManifestEntry).slice(0, MAX_LOADED_ARTICLES);
    const articles = await Promise.all(publishedEntries.map(loadArticleContent));
    publishedArticlesCache = articles.filter(isEligiblePublishedArticle);
    return publishedArticlesCache;
  })().finally(()=>{ publishedArticlesLoadPromise = null; });
  return publishedArticlesLoadPromise;
}

export async function findMatchingGithubArticles(queryText, options = {}){
  const normalizedQuery = normalizeSearchText(queryText);
  if (!shouldSearchGithub(normalizedQuery, options)) return [];
  try {
    const articles = await loadPublishedGithubArticles();
    return articles.map((article)=>({ article, score: scoreArticle(article, normalizedQuery, options) })).filter((entry)=>entry.score >= MIN_MATCH_SCORE).sort(sortScoredArticles).slice(0, MAX_MATCHED_ARTICLES).map((entry)=>entry.article);
  } catch (error) {
    console.warn('GitHub article source fallback:', error);
    return [];
  }
}

export function createGithubArticleAction(article){
  if (!isEligiblePublishedArticle(article)) return null;
  return { label: `Baca Artikel: ${truncateTitle(article.title, DEFAULT_TITLE_LIMIT)}`, href: article.href };
}

async function fetchJson(url){
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Manifest gagal dimuat: ${response.status}`);
  return response.json();
}

async function loadArticleContent(entry){
  const articleUrl = getArticleUrl(entry.sourcePath);
  const response = await fetch(articleUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Artikel gagal dimuat: ${entry.sourcePath}`);
  const html = await response.text();
  return {
    ...entry,
    href: entry.sourcePath,
    contentText: stripHtml(extractMainArticleHtml(html))
  };
}

function isEligibleManifestEntry(entry){
  return Boolean(entry && entry.status === 'published' && String(entry.slug || '').trim() && String(entry.title || '').trim() && isAllowedSourcePath(entry.sourcePath) && !isBlockedIslamicProductArticle(entry));
}

function isEligiblePublishedArticle(article){
  return Boolean(article && article.status === 'published' && String(article.title || '').trim() && String(article.slug || '').trim() && isAllowedSourcePath(article.sourcePath) && !isBlockedIslamicProductArticle(article));
}

function isAllowedSourcePath(sourcePath){
  const cleanPath = String(sourcePath || '').trim().replace(/\\/g, '/');
  const lowerPath = cleanPath.toLowerCase();
  if (!cleanPath || cleanPath !== sourcePath) return false;
  if (cleanPath.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(cleanPath)) return false;
  if (!/^articles\/[a-z0-9-]+\.html$/i.test(cleanPath)) return false;
  if (lowerPath.includes('/draft/') || lowerPath.includes('/drafts/') || lowerPath.includes('draft') || lowerPath.includes('archived')) return false;
  if (lowerPath === 'articles/detail.html' || lowerPath === 'articles/index.html') return false;
  return true;
}

function getArticleUrl(sourcePath){
  return new URL(`../../../${sourcePath}`, import.meta.url);
}

function extractMainArticleHtml(html){
  if (typeof DOMParser !== 'function') return html;
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const article = parsed.querySelector('article.vitanusa-article') || parsed.querySelector('main') || parsed.body;
  return article?.innerHTML || '';
}

function scoreArticle(article, queryText, options = {}){
  if (!isEligiblePublishedArticle(article)) return 0;
  const normalizedQuery = normalizeSearchText(queryText);
  const queryTokens = getExpandedTokens(normalizedQuery);
  if (!queryTokens.length) return 0;
  const title = normalizeSearchText(article.title);
  const summary = normalizeSearchText(article.summary || '');
  const category = normalizeSearchText(article.category);
  const slug = normalizeSearchText(article.slug);
  const intentTarget = normalizeSearchText(article.intentTarget);
  const riskLevel = normalizeSearchText(article.riskLevel || 'low');
  const tags = getTags(article.tags).map(normalizeSearchText).filter(Boolean);
  const relatedArticles = getTags(article.relatedArticles).map(normalizeSearchText).filter(Boolean);
  const contentText = normalizeSearchText(article.contentText);
  const detectedIntentTargets = getDetectedIntentTargets(normalizedQuery, options.intentId);
  let score = 0;
  if (title && (normalizedQuery.includes(title) || title.includes(normalizedQuery))) score += 8;
  score += countTokenOverlap(queryTokens, getExpandedTokens(title)) * 4;
  if (intentTarget && detectedIntentTargets.includes(intentTarget)) score += 6;
  if (intentTarget) score += countTokenOverlap(queryTokens, getExpandedTokens(intentTarget)) * 3;
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
  score += Math.min(countTokenOverlap(queryTokens, relatedArticles.flatMap(getExpandedTokens)) * 1, 3);
  score += getSensitiveMetadataBonus(article, detectedIntentTargets, normalizedQuery);
  score += getContextBonus(queryTokens, [title, summary, category, slug, intentTarget, tags.join(' '), riskLevel]);
  return score;
}

function shouldSearchGithub(normalizedQuery, options){ const tokens = getMeaningfulTokens(normalizedQuery); if (options.allowShortQuery) return normalizedQuery.length >= 3 && tokens.length >= 1; return normalizedQuery.length >= 8 && tokens.length >= 2; }
function isBlockedIslamicProductArticle(article){ return article?.isIslamicSensitive === true && String(article.primaryAction || '').trim() === 'view-products'; }
function normalizeSearchText(value){ return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' dan ').replace(/[?!.:,;()[\]{}"'`~_+=/\\|-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function stripHtml(value){
  const rawHtml = String(value || '');
  if (!rawHtml) return '';
  if (typeof DOMParser === 'function') {
    const parsed = new DOMParser().parseFromString(`<div>${rawHtml}</div>`, 'text/html');
    parsed.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el)=>el.remove());
    return normalizeWhitespace(parsed.body.textContent || '');
  }
  return normalizeWhitespace(rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ').replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, 'dan'));
}
function getTags(tags){ if (Array.isArray(tags)) return tags.map((tag)=>String(tag || '').trim()).filter(Boolean); if (typeof tags === 'string') return tags.split(',').map((tag)=>tag.trim()).filter(Boolean); return []; }
function getMeaningfulTokens(text){ return [...new Set(String(text || '').split(' ').map((token)=>token.trim()).filter((token)=>token.length > 2 && !STOP_WORDS.has(token)))]; }
function getExpandedTokens(text){ const tokens = getMeaningfulTokens(text); const expanded = new Set(tokens); tokens.forEach((token)=>(TOKEN_SYNONYMS[token] || []).forEach((synonym)=>expanded.add(synonym))); return [...expanded]; }
function countTokenOverlap(queryTokens, targetTokens){ if (!queryTokens.length || !targetTokens.length) return 0; const targetSet = new Set(targetTokens); return queryTokens.reduce((count, token)=>count + (targetSet.has(token) ? 1 : 0), 0); }
function getDetectedIntentTargets(normalizedQuery, explicitIntentId){ const detected = new Set(NUSA_INTENT_TO_TARGETS[explicitIntentId] || []); Object.entries(INTENT_TARGET_HINTS).forEach(([target, hints])=>{ if (hints.some((hint)=>normalizedQuery.includes(normalizeSearchText(hint)))) detected.add(target); }); if (!detected.size) detected.add('article-general'); return [...detected]; }
function getSensitiveMetadataBonus(article, detectedIntentTargets, normalizedQuery){
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
function getContextBonus(queryTokens, fields){ const text = fields.filter(Boolean).join(' '); let bonus = 0; if (queryTokens.some((token)=>['klaim','testimoni','testi'].includes(token)) && /literasi|klaim|testimoni|produk/.test(text)) bonus += 2; if (queryTokens.some((token)=>['sehat','kesehatan','kebiasaan','habit','rutinitas'].includes(token)) && /sehat|kebiasaan|habit|rutinitas|amanah/.test(text)) bonus += 2; if (queryTokens.some((token)=>['tawakal','ikhtiar','amanah','tabayyun'].includes(token)) && /tawakal|ikhtiar|amanah|tabayyun|islamic-reflection/.test(text)) bonus += 2; return bonus; }
function truncateTitle(title, maxLength){ const clean = normalizeWhitespace(title); return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trimEnd()}...`; }
function normalizeWhitespace(value){ return String(value || '').replace(/\s+/g, ' ').trim(); }
function sortScoredArticles(a,b){ return b.score !== a.score ? b.score - a.score : String(a.article.title || '').localeCompare(String(b.article.title || '')); }
