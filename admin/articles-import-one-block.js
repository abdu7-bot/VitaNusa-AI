(() => {
  const REQUIRED_DISCLAIMER = 'Konten ini bersifat edukasi dan refleksi, bukan diagnosis medis. Untuk keluhan serius, segera konsultasikan kepada tenaga kesehatan profesional.';

  const SELECTORS = {
    parseButton: '[data-article-import-parse]',
    textarea: '[data-article-import-text]',
    status: '[data-article-import-status]',
    form: '[data-article-form]'
  };

  function normalizeSlug(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  }

  function stripTags(value) {
    const container = document.createElement('div');
    container.innerHTML = String(value || '');
    return (container.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function firstMatch(value, pattern) {
    const match = String(value || '').match(pattern);
    return match ? match[1].trim() : '';
  }

  function setStatus(kind, message) {
    const box = document.querySelector(SELECTORS.status);
    if (!box) return;
    box.hidden = false;
    box.classList.remove('is-error', 'is-warning', 'is-success');
    box.classList.add(`is-${kind}`);
    box.textContent = message;
  }

  function getKeyValueMap(rawText) {
    const map = {};
    const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');

    for (const line of lines) {
      const match = line.trim().match(/^([A-Za-zÀ-ÿ\s_-]{2,40})[:：]\s*(.*)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const value = match[2].trim();
      if (value) map[key] = value;
    }

    return map;
  }

  function readBlockField(rawText, label) {
    const labels = [
      label,
      label.replace(/\s+/g, ''),
      label.replace(/\s+/g, ' ')
    ].map((item) => item.toLowerCase());
    const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
    const startPattern = new RegExp(`^(${labels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:：]\\s*(.*)$`, 'i');

    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].trim().match(startPattern);
      if (!match) continue;
      const collected = [];
      if (match[2]) collected.push(match[2]);
      let cursor = index + 1;
      while (cursor < lines.length) {
        const next = lines[cursor];
        if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s_-]{1,60}\s*[:：]/.test(next.trim())) break;
        collected.push(next);
        cursor += 1;
      }
      return collected.join('\n').trim();
    }

    return '';
  }

  function extractAfterHeader(rawText, labels) {
    const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
    const labelSet = new Set(labels.map((label) => label.toLowerCase()));

    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      const match = trimmed.match(/^([A-Za-zÀ-ÿ\s_-]{2,40})[:：]\s*(.*)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
      if (!labelSet.has(key)) continue;

      const sameLine = match[2].trim();
      const rest = lines.slice(index + 1).join('\n').trim();
      return [sameLine, rest].filter(Boolean).join('\n').trim();
    }

    return '';
  }

  function extractArticleHtml(rawText) {
    const source = String(rawText || '').trim();
    const contentSection = extractAfterHeader(source, ['content', 'konten', 'html artikel', 'article html']);
    const contentCandidate = contentSection || source;
    const article = contentCandidate.match(/<article\b[^>]*>[\s\S]*?<\/article>/i);
    if (article) return article[0].trim();

    const firstHeading = contentCandidate.search(/<h1\b/i);
    if (firstHeading >= 0) return contentCandidate.slice(firstHeading).trim();

    return contentCandidate.trim();
  }

  function inferSummary(contentHtml, fields) {
    if (fields.summary) return fields.summary;
    if (fields.excerpt) return fields.excerpt;
    if (fields.ringkasan) return fields.ringkasan;

    const summaryParagraph = String(contentHtml || '').match(/<p\b[^>]*>\s*<strong>\s*Ringkasan\s*:\s*<\/strong>\s*([\s\S]*?)<\/p>/i);
    if (summaryParagraph) return stripTags(summaryParagraph[1]).slice(0, 320);

    const firstParagraph = String(contentHtml || '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (firstParagraph) return stripTags(firstParagraph[1]).replace(/^Ringkasan\s*:\s*/i, '').slice(0, 320);

    return stripTags(contentHtml).slice(0, 320);
  }

  function inferMetadata(contentHtml, fields, rawText) {
    const plain = stripTags(contentHtml).toLowerCase();
    const islamic = /(allah|nabi|hadits|hadis|quran|qur'an|al-qur|qs\.|tafsir|fatwa|syahwat|maksiat|zina)/i.test(plain);
    const medical = /(diagnosis|obat|dosis|terapi|keluhan|tenaga kesehatan|medis)/i.test(plain);
    const product = /(produk|testimoni|klaim produk|checkout|langfit|deto pro|propolis)/i.test(plain);

    return {
      category: fields.category || fields.kategori || (islamic ? 'Refleksi Islami' : 'Edukasi Kesehatan'),
      tags: fields.tags || fields.tag || (islamic ? 'Islam, hati, pandangan, akhlak, muhasabah' : 'edukasi, kesehatan, amanah'),
      intentTarget: fields.intenttarget || (islamic ? 'islamic-reflection' : 'article-general'),
      riskLevel: fields.risklevel || 'low',
      isMedicalSensitive: medical,
      isProductSensitive: product,
      isIslamicSensitive: islamic,
      relatedArticles: fields.relatedarticles || fields.artikelterkait || '',
      userQuestions: fields.userquestions || readBlockField(rawText, 'User Questions') || '',
      answerSnippet: fields.answersnippet || fields.answer || readBlockField(rawText, 'Answer Snippet') || '',
      problemTags: fields.problemtags || readBlockField(rawText, 'Problem Tags') || '',
      audience: fields.audience || '',
      doNotUseFor: fields.donotusefor || readBlockField(rawText, 'Do Not Use For') || '',
      whenToSeekHelp: fields.whentoseekhelp || readBlockField(rawText, 'When To Seek Help') || '',
      sources: fields.sources || fields.sumber || readBlockField(rawText, 'Sources') || '',
      contentDepth: fields.contentdepth || 'basic',
      primaryAction: fields.primaryaction || 'read-article',
      reviewerNote: fields.reviewernote || fields.catatanreviewer || ''
    };
  }

  function parseOneBlock(rawText) {
    const source = String(rawText || '').trim();
    if (!source) throw new Error('Import artikel masih kosong.');

    const fields = getKeyValueMap(source);
    const contentHtml = extractArticleHtml(source);
    const title = fields.title || fields.judul || firstMatch(contentHtml, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || firstMatch(source, /^#\s+(.+)$/m);
    if (!title) throw new Error('Judul tidak ditemukan. Pastikan ada Title: atau <h1>Judul</h1>.');
    if (!contentHtml || !/<[a-z][\s\S]*>/i.test(contentHtml)) throw new Error('Content HTML tidak ditemukan. Pastikan ada Content: atau tag <article>.');

    const metadata = inferMetadata(contentHtml, fields, source);
    const summary = inferSummary(contentHtml, fields);
    return {
      title: stripTags(title),
      slug: normalizeSlug(fields.slug || title),
      category: metadata.category,
      summary,
      contentHtml,
      tags: metadata.tags,
      intentTarget: metadata.intentTarget,
      riskLevel: metadata.riskLevel,
      isMedicalSensitive: metadata.isMedicalSensitive,
      isProductSensitive: metadata.isProductSensitive,
      isIslamicSensitive: metadata.isIslamicSensitive,
      relatedArticles: metadata.relatedArticles,
      userQuestions: metadata.userQuestions || '',
      answerSnippet: metadata.answerSnippet || summary,
      problemTags: metadata.problemTags || '',
      audience: metadata.audience || '',
      doNotUseFor: metadata.doNotUseFor || '',
      whenToSeekHelp: metadata.whenToSeekHelp || '',
      sources: metadata.sources || '',
      contentDepth: metadata.contentDepth,
      primaryAction: metadata.primaryAction,
      reviewerNote: metadata.reviewerNote,
      status: 'published'
    };
  }

  function setValue(form, name, value) {
    if (!form.elements[name]) return;
    form.elements[name].value = value || '';
    form.elements[name].dispatchEvent(new Event('input', { bubbles: true }));
    form.elements[name].dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyToForm(article) {
    const form = document.querySelector(SELECTORS.form);
    if (!form) throw new Error('Form artikel tidak ditemukan.');

    setValue(form, 'articleId', '');
    setValue(form, 'title', article.title);
    setValue(form, 'slug', article.slug);
    setValue(form, 'category', article.category);
    setValue(form, 'summary', article.summary);
    setValue(form, 'contentHtml', article.contentHtml);
    setValue(form, 'tags', article.tags);
    setValue(form, 'intentTarget', article.intentTarget);
    setValue(form, 'riskLevel', article.riskLevel);
    setValue(form, 'relatedArticles', article.relatedArticles);
    setValue(form, 'userQuestions', article.userQuestions);
    setValue(form, 'answerSnippet', article.answerSnippet || article.summary);
    setValue(form, 'problemTags', article.problemTags);
    setValue(form, 'audience', article.audience);
    setValue(form, 'doNotUseFor', article.doNotUseFor);
    setValue(form, 'whenToSeekHelp', article.whenToSeekHelp);
    setValue(form, 'sources', article.sources);
    setValue(form, 'contentDepth', article.contentDepth);
    setValue(form, 'primaryAction', article.primaryAction);
    setValue(form, 'reviewerNote', article.reviewerNote);
    setValue(form, 'status', article.status);

    if (form.elements.isMedicalSensitive) form.elements.isMedicalSensitive.checked = article.isMedicalSensitive;
    if (form.elements.isProductSensitive) form.elements.isProductSensitive.checked = article.isProductSensitive;
    if (form.elements.isIslamicSensitive) form.elements.isIslamicSensitive.checked = article.isIslamicSensitive;

    const hasDisclaimer = stripTags(article.contentHtml).toLowerCase().includes(REQUIRED_DISCLAIMER.toLowerCase());
    const warning = hasDisclaimer ? '' : ' Disclaimer wajib akan ditambahkan otomatis saat simpan jika belum ada.';
    setStatus('success', `Artikel berhasil diparse ke form. Status diset published.${warning}`);
    form.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('change', { bubbles: true }));
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleParseClick(event) {
    const button = event.target.closest(SELECTORS.parseButton);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      const rawText = document.querySelector(SELECTORS.textarea)?.value || '';
      applyToForm(parseOneBlock(rawText));
    } catch (error) {
      setStatus('error', error.message || 'Format import tidak terbaca.');
    }
  }

  // expose parser for compatibility with other admin scripts/tests
  window.vitaNusaParseOneBlockArticleImport = parseOneBlock;

  document.addEventListener('click', handleParseClick, true);
})();
