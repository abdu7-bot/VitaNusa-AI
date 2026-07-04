function normalizeOneBlockSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function cleanOneBlockValue(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim();
}

function stripOneBlockHtml(value) {
  return String(value || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferOneBlockCategory(text) {
  const normalized = stripOneBlockHtml(text).toLowerCase();
  if (/qs\.|hr\.|hadits|hadis|ustadz|ulama|islam|hati|pandangan/.test(normalized)) return 'Refleksi Islami';
  if (/produk|suplemen|katalog|klaim|testimoni|reseller/.test(normalized)) return 'Literasi Produk';
  if (/sehat|kesehatan|keluhan|dokter|tenaga kesehatan|pola makan|tidur/.test(normalized)) return 'Edukasi Kesehatan';
  return 'Edukasi Amanah';
}

function inferOneBlockTags(text) {
  const normalized = stripOneBlockHtml(text).toLowerCase();
  const tags = new Set(['edukasi', 'amanah']);
  if (/qs\.|hr\.|hadits|hadis|islam|hati|pandangan/.test(normalized)) tags.add('refleksi islami');
  if (/produk|suplemen|katalog|klaim|testimoni/.test(normalized)) tags.add('literasi produk');
  if (/sehat|kesehatan|keluhan|dokter|tenaga kesehatan/.test(normalized)) tags.add('kesehatan');
  return [...tags].join(', ');
}

function extractArticleHtml(rawText) {
  const source = String(rawText || '').trim();
  const match = source.match(/<article\b[\s\S]*<\/article>/i);
  return match ? match[0].trim() : '';
}

function getHtmlTextBySelector(html, selector) {
  if (typeof DOMParser !== 'function') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return cleanOneBlockValue(doc.querySelector(selector)?.textContent || '');
}

function parseDirectArticleHtml(rawText) {
  const contentHtml = extractArticleHtml(rawText);
  if (!contentHtml) return null;

  const title = getHtmlTextBySelector(contentHtml, 'h1') || 'Artikel VitaNusa';
  const summary = getHtmlTextBySelector(contentHtml, '.article-summary') || getHtmlTextBySelector(contentHtml, 'p') || stripOneBlockHtml(contentHtml).slice(0, 180);
  return {
    title,
    slug: normalizeOneBlockSlug(title),
    summary,
    contentHtml,
    metadata: [
      `Category: ${inferOneBlockCategory(contentHtml)}`,
      `Tags: ${inferOneBlockTags(contentHtml)}`,
      'Status: published',
      `Answer Snippet: ${summary}`
    ].join('\n'),
    slugWasProvided: false
  };
}

function parseLabeledOneBlock(rawText) {
  const source = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const headerPattern = /^(Title|Slug|Category|Tags|Summary|User Questions|Answer Snippet|Problem Tags|Audience|Do Not Use For|When To Seek Help|Sources|Content):\s*(.*)$/i;
  const fields = {};
  let currentKey = '';
  let buffer = [];

  const flush = () => {
    if (!currentKey) return;
    fields[currentKey] = cleanOneBlockValue(buffer.join('\n'));
  };

  for (const line of source.split('\n')) {
    const match = line.match(headerPattern);
    if (match) {
      flush();
      currentKey = match[1].toLowerCase().replace(/\s+/g, '');
      buffer = [match[2] || ''];
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();

  if (!fields.title && !fields.content) return null;

  const directHtml = fields.content || extractArticleHtml(source);
  const articleFallback = directHtml ? parseDirectArticleHtml(directHtml) : null;
  const title = fields.title || articleFallback?.title || '';
  const summary = fields.summary || articleFallback?.summary || '';
  const category = fields.category || inferOneBlockCategory(directHtml || source);
  const tags = fields.tags || inferOneBlockTags(directHtml || source);

  return {
    title,
    slug: normalizeOneBlockSlug(fields.slug || title),
    summary,
    contentHtml: directHtml,
    metadata: [
      `Category: ${category}`,
      `Tags: ${tags}`,
      `User Questions: ${fields.userquestions || ''}`,
      `Answer Snippet: ${fields.answersnippet || summary}`,
      `Problem Tags: ${fields.problemtags || ''}`,
      `Audience: ${fields.audience || ''}`,
      `Do Not Use For: ${fields.donotusefor || ''}`,
      `When To Seek Help: ${fields.whentoseekhelp || ''}`,
      `Sources: ${fields.sources || ''}`,
      'Status: published'
    ].join('\n'),
    slugWasProvided: Boolean(fields.slug)
  };
}

window.vitaNusaParseOneBlockArticleImport = function vitaNusaParseOneBlockArticleImport(rawText) {
  return parseLabeledOneBlock(rawText) || parseDirectArticleHtml(rawText);
};
