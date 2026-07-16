import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createShareDraftState,
  normalizeShareTarget,
  normalizeSharedUrl,
  setPlainText,
} from '../assets/js/modules/share-target.js';

const shareTargetHtml = await readFile(new URL('../share-target.html', import.meta.url), 'utf8');

test('title dinormalisasi', () => {
  assert.equal(normalizeShareTarget({ title: '  Judul   dibagikan  ' }).title, 'Judul dibagikan');
});

test('text dinormalisasi sebagai plain text', () => {
  assert.equal(normalizeShareTarget({ text: '  baris satu\r\nbaris dua  ' }).text, 'baris satu\nbaris dua');
});

test('URL HTTP diterima', () => {
  assert.equal(normalizeSharedUrl('http://example.test/info'), 'http://example.test/info');
});

test('URL HTTPS diterima', () => {
  assert.equal(normalizeSharedUrl('https://example.test/info'), 'https://example.test/info');
});

test('javascript URL ditolak', () => {
  assert.equal(normalizeSharedUrl('javascript:alert(1)'), '');
});

test('data URL ditolak', () => {
  assert.equal(normalizeSharedUrl('data:text/html,<b>rahasia</b>'), '');
});

test('HTML tetap diperlakukan sebagai teks', () => {
  const element = { textContent: '', innerHTML: 'tidak disentuh' };
  setPlainText(element, '<img src=x onerror=alert(1)>');
  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(element.innerHTML, 'tidak disentuh');
});

test('panjang title, text, dan URL dibatasi', () => {
  const draft = normalizeShareTarget({
    title: 'a'.repeat(400),
    text: 'b'.repeat(5000),
    url: `https://example.test/${'c'.repeat(3000)}`,
  });
  assert.equal(draft.title.length, 200);
  assert.equal(draft.text.length, 4000);
  assert.ok(draft.url.length <= 2048);
});

test('draft tidak dikirim atau dikonfirmasi otomatis', () => {
  const state = createShareDraftState({ title: 'Contoh', text: '', url: '' });
  assert.equal(state.getState().confirmed, false);
  const question = state.confirm();
  assert.equal(state.getState().confirmed, true);
  assert.match(question, /Judul: Contoh/);
});

test('query kosong ditangani', () => {
  assert.deepEqual(normalizeShareTarget(new URLSearchParams()), {
    title: '',
    text: '',
    url: '',
    hasContent: false,
  });
});

test('parameter share tidak diteruskan sebagai referrer aset', () => {
  assert.match(shareTargetHtml, /<meta name="referrer" content="no-referrer">/);
});
