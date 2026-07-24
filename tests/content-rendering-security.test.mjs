import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  htmlToPlainText,
  inspectContentHtml,
  sanitizeContentHtml,
} from '../assets/js/modules/content-sanitizer.js';

const FORBIDDEN_ELEMENTS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'svg',
  'math',
  'style',
  'template',
  'input',
];

const MALFORMED_PAYLOADS = [
  '<p><strong>Tidak seimbang</p></strong>',
  '<p>Belum ditutup',
  '<p class=test>Tanpa quote</p>',
  '<p class="satu" class="dua">Duplikat atribut</p>',
  '<div/>',
  '<!-- komentar ambigu --><p>Isi</p>',
  '<p title="kutip tidak selesai>Isi</p>',
  '<p>Nilai 2 < 3</p>',
  '<p><div>Browser akan menutup p secara implisit</div></p>',
  '<table><tr><td>Browser akan menambah tbody</td></tr></table>',
  '<ul><p>Bukan list item</p></ul>',
  '<a href="/satu"><a href="/dua">Tautan bersarang</a></a>',
];

const OBFUSCATED_URLS = [
  'javascript:alert(1)',
  'java&#x73;cript:alert(1)',
  'java&#115;cript:alert(1)',
  'java&Tab;script:alert(1)',
  'java&#x0a;script:alert(1)',
  'jav%61script:alert(1)',
  '%256a%2561%2576%2561script:alert(1)',
  'j\u200bavascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'd&#97;ta:text/html,unsafe',
  'vbscript:msgbox(1)',
];

test('allowlist mempertahankan struktur artikel dan knowledge normal', () => {
  const normal = [
    '  <article class="vitanusa-article">',
    '    <header><h1>Langkah Sehat &amp; Amanah</h1><p>Ringkasan edukasi.</p></header>',
    '    <section class="article-note"><h2>Catatan Amanah</h2><p>Ini bukan diagnosis atau klaim 100% aman.</p></section>',
    '    <section class="article-references"><h2>Referensi</h2><ol><li><a href="https://example.org/source" target="_blank">Sumber</a></li></ol></section>',
    '    <table><thead><tr><th scope="col">Kebiasaan</th></tr></thead><tbody><tr><td>Minum cukup</td></tr></tbody></table>',
    '</article>',
  ].join('\n');

  const result = inspectContentHtml(normal);

  assert.equal(result.ok, true);
  assert.match(result.html, /<article class="vitanusa-article">/);
  assert.match(result.html, /Langkah Sehat &amp; Amanah/);
  assert.match(result.html, /class="article-note"/);
  assert.match(result.html, /class="article-references"/);
  assert.match(result.html, /target="_blank"/);
  assert.match(result.html, /rel="noopener noreferrer"/);
  assert.match(result.html, /<th scope="col">/);
});

test('konten teks biasa di-escape dan tidak berubah menjadi HTML aktif', () => {
  assert.equal(
    sanitizeContentHtml('Gunakan 2 &gt; 1 dan tulis &lt;contoh&gt;.'),
    'Gunakan 2 &gt; 1 dan tulis &lt;contoh&gt;.',
  );
  assert.equal(sanitizeContentHtml('<p>&copy; 2026 &mdash; VitaNusa</p>'), '<p>© 2026 — VitaNusa</p>');
  assert.equal(htmlToPlainText('<p>Gunakan <strong>langkah kecil</strong>.</p>'), 'Gunakan langkah kecil .');
});

test('elemen executable, form, SVG, MathML, dan elemen di luar allowlist ditolak seluruhnya', () => {
  for (const tag of FORBIDDEN_ELEMENTS) {
    const payload = `<p>Awal</p><${tag}>payload</${tag}><p>Akhir</p>`;
    const result = inspectContentHtml(payload);
    assert.equal(result.ok, false, `${tag} harus ditolak`);
    assert.equal(result.html, '');
  }

  assert.equal(sanitizeContentHtml('<video src="https://example.org/a.mp4"></video>'), '');
  assert.equal(sanitizeContentHtml('<svg><a xlink:href="javascript:alert(1)">x</a></svg>'), '');
});

test('event handler dan atribut berbahaya atau tidak diizinkan ditolak', () => {
  const payloads = [
    '<p onclick="alert(1)">Isi</p>',
    '<img src="https://example.org/a.png" onerror="alert(1)">',
    '<p action="https://evil.example">Isi</p>',
    '<a href="/aman" formaction="https://evil.example">Isi</a>',
    '<p srcdoc="<script>alert(1)</script>">Isi</p>',
    '<a href="/aman" xlink:href="/jahat">Isi</a>',
    '<p style="background:url(javascript:alert(1))">Isi</p>',
    '<p id="target">Isi</p>',
    '<p aria-label="Isi">Isi</p>',
    '<p class="aman<script>">Isi</p>',
  ];

  for (const payload of payloads) {
    assert.equal(sanitizeContentHtml(payload), '', payload);
  }
});

test('javascript, data, vbscript, dan URL encoded atau obfuscated ditolak', () => {
  for (const url of OBFUSCATED_URLS) {
    assert.equal(sanitizeContentHtml(`<a href="${url}">Tautan</a>`), '', url);
    assert.equal(sanitizeContentHtml(`<img src="${url}" alt="Gambar">`), '', url);
  }
});

test('URL normal yang dibutuhkan konten tetap diterima', () => {
  const payloads = [
    '<a href="https://example.org/edukasi">HTTPS</a>',
    '<a href="http://example.org/edukasi">HTTP</a>',
    '<a href="mailto:editor@example.org">Email</a>',
    '<a href="tel:+621234567">Telepon</a>',
    '<a href="/articles/detail.html?slug=amanah">Relatif</a>',
    '<a href="#catatan-amanah">Fragmen</a>',
    '<img src="/images/banner.webp" alt="Banner" width="640" height="360">',
  ];

  for (const payload of payloads) {
    assert.notEqual(sanitizeContentHtml(payload), '', payload);
  }
});

test('HTML malformed ditolak fail-closed', () => {
  for (const payload of MALFORMED_PAYLOADS) {
    const result = inspectContentHtml(payload);
    assert.equal(result.ok, false, payload);
    assert.equal(result.html, '');
  }
});

test('tag berbahaya yang di-encode atau di-percent-encode ditolak', () => {
  const payloads = [
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '&#x3c;iframe src="https://evil.example"&#x3e;',
    '%3Cscript%3Ealert(1)%3C/script%3E',
    '%253Csvg%253E%253C/svg%253E',
  ];

  for (const payload of payloads) {
    assert.equal(sanitizeContentHtml(payload), '', payload);
  }
});

test('renderer publik dan chat hanya memasukkan fragment yang sudah disanitasi', async () => {
  const [articleSource, chatSource, knowledgeSource] = await Promise.all([
    readFile(new URL('../assets/js/modules/public-articles.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/modules/nusa-chat.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/modules/nusa-knowledge.js', import.meta.url), 'utf8'),
  ]);

  assert.match(articleSource, /createSanitizedContentFragment/);
  assert.doesNotMatch(articleSource, /\.innerHTML\s*=/);
  assert.match(chatSource, /createSanitizedContentFragment/);
  assert.doesNotMatch(chatSource, /DOMParser|\.innerHTML\s*=/);
  assert.match(knowledgeSource, /sanitizeContentHtml/);
  assert.doesNotMatch(knowledgeSource, /\.innerHTML\s*=/);
});

test('validasi admin artikel dan knowledge memakai pemeriksaan allowlist bersama', async () => {
  const [articleAdminSource, knowledgeAdminSource] = await Promise.all([
    readFile(new URL('../admin/articles.js', import.meta.url), 'utf8'),
    readFile(new URL('../admin/knowledge.js', import.meta.url), 'utf8'),
  ]);

  assert.match(articleAdminSource, /inspectContentHtml\(payload\.contentHtml\)/);
  assert.match(knowledgeAdminSource, /inspectContentHtml\(payload\.answerHtml\)/);
});
