import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeLearningContentPath,
  resolveLearningCatalogUrl,
  resolveLearningContentUrl,
} from '../../../assets/js/mandiri/learning/data/safe-content-path.js';
import { runtimeCatalogUrl } from './fixtures.mjs';

test('path relatif paket yang valid diterima di bawah root catalog', () => {
  assert.equal(
    resolveLearningContentUrl('packages/money-basics-id-v1/manifest.json', {
      catalogUrl: runtimeCatalogUrl,
    }),
    'https://example.test/VitaNusa-AI/content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
  );
});

for (const [name, value] of [
  ['traversal', '../manifest.json'],
  ['encoded traversal', '%2e%2e/manifest.json'],
  ['double-encoded traversal', '%252e%252e/manifest.json'],
  ['absolute path', '/content.json'],
  ['protocol-relative URL', '//evil.test/content.json'],
  ['HTTP URL', 'http://evil.test/content.json'],
  ['HTTPS URL', 'https://evil.test/content.json'],
  ['file URL', 'file:///tmp/content.json'],
  ['data URL', 'data:application/json,{}'],
  ['JavaScript URL', 'javascript:alert(1)'],
  ['backslash traversal', '..\\content.json'],
  ['null byte', 'packages/content.json\0'],
]) {
  test(`${name} ditolak`, () => {
    assert.throws(() => assertSafeLearningContentPath(value), { code: 'unsafe_path' });
  });
}

test('catalog URL diturunkan dari URL halaman dan mempertahankan project path', () => {
  assert.equal(
    resolveLearningCatalogUrl('https://example.test/VitaNusa-AI/mandiri/belajar/index.html'),
    runtimeCatalogUrl,
  );
});

test('base URL origin berbeda ditolak', () => {
  assert.throws(() => resolveLearningContentUrl('content.json', {
    catalogUrl: runtimeCatalogUrl,
    baseUrl: 'https://evil.test/manifest.json',
  }), { code: 'unsafe_path' });
});
