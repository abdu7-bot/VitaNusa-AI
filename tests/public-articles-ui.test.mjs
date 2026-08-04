import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [indexHtml, detailHtml, articleCss, controlsSource, publicSource] = await Promise.all([
  read('articles/index.html'),
  read('articles/detail.html'),
  read('articles/articles-style.css'),
  read('articles/articles-main.js'),
  read('assets/js/modules/public-articles.js'),
]);

test('halaman daftar dan detail mempertahankan hierarki heading yang jelas', () => {
  assert.equal((indexHtml.match(/<h1\b/gu) || []).length, 1);
  assert.match(indexHtml, /<h1>Artikel VitaNusa<\/h1>/u);
  assert.equal((detailHtml.match(/<h1\b/gu) || []).length, 0);
  assert.match(publicSource, /header\.append\(el\('h1'/u);
});

test('hanya artikel published yang dimuat dari Firestore', () => {
  assert.match(publicSource, /where\('status', '==', 'published'\)/u);
  assert.match(publicSource, /article\?\.status === 'published'/u);
  assert.doesNotMatch(publicSource, /where\('status', '==', '(?:draft|archived)'\)/u);
});

test('card dinamis mengarah ke slug yang stabil dan metadata tetap plain text', () => {
  assert.match(publicSource, /detail\.html\?slug=\$\{encodeURIComponent\(slug\)\}/u);
  assert.match(publicSource, /node\.textContent = text/u);
  assert.doesNotMatch(publicSource, /\.innerHTML\s*=/u);
  assert.match(publicSource, /setAttribute\('aria-label', `Baca artikel \$\{title\}`\)/u);
});

test('HTML artikel tetap melalui sanitizer resmi', () => {
  assert.match(publicSource, /createSanitizedContentFragment\(article\.contentHtml \|\| '', body\.ownerDocument\)/u);
  assert.match(publicSource, /htmlToPlainText/u);
  assert.doesNotMatch(publicSource, /insertAdjacentHTML|document\.write/u);
});

test('related articles tidak menduplikasi artikel aktif dan dibatasi tiga', () => {
  assert.match(publicSource, /candidateSlug !== activeSlug/u);
  assert.match(publicSource, /candidateId !== activeId/u);
  assert.match(publicSource, /\.slice\(0, 3\)/u);
  assert.match(publicSource, /relatedRoot\.hidden = true/u);
});

test('kontrol daftar tidak memasang event listener ganda atau melakukan auto-scroll', () => {
  assert.match(controlsSource, /publicArticleControlsInitialized/u);
  assert.match(publicSource, /publicArticlesInitialized/u);
  assert.match(publicSource, /publicArticleDetailInitialized/u);
  assert.doesNotMatch(controlsSource, /scrollIntoView/u);
  assert.doesNotMatch(publicSource, /scrollIntoView/u);
});

test('layout mobile satu kolom dan overflow dibatasi pada konten yang memang lebar', () => {
  assert.match(articleCss, /body\.article-page[\s\S]*overflow-x:\s*clip/u);
  assert.match(articleCss, /@media \(max-width: 620px\)[\s\S]*\.article-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(articleCss, /\.article-table-scroll[\s\S]*overflow-x:\s*auto/u);
  assert.match(articleCss, /\.article-detail-body[\s\S]*overflow-wrap:\s*anywhere/u);
});

test('aksesibilitas dasar tersedia untuk pencarian, status, fokus, gambar, dan reduced motion', () => {
  assert.match(indexHtml, /<label for="searchInput">Cari artikel<\/label>/u);
  assert.match(indexHtml, /role="status" aria-live="polite"/u);
  assert.match(detailHtml, /aria-busy="true"/u);
  assert.match(publicSource, /image\.alt = getImageAlt/u);
  assert.match(articleCss, /:focus-visible/u);
  assert.match(articleCss, /prefers-reduced-motion:\s*reduce/u);
});

test('teks Arab diberi dukungan arah tanpa mengubah isi artikel', () => {
  assert.match(publicSource, /isMostlyArabic/u);
  assert.match(publicSource, /setAttribute\('lang', 'ar'\)/u);
  assert.match(publicSource, /setAttribute\('dir', 'rtl'\)/u);
  assert.match(articleCss, /unicode-bidi:\s*isolate/u);
});
