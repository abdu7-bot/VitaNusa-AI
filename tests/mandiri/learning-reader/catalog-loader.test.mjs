import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningCatalogLoader } from '../../../assets/js/mandiri/learning/data/catalog-loader.js';
import { createCatalogPageController } from '../../../assets/js/mandiri/learning/ui/catalog-page.js';
import {
  byteResponse,
  catalogBytes,
  catalogInput,
  clone,
  createSpyView,
  runtimeCatalogUrl,
} from './fixtures.mjs';

function loaderFor(input, options = {}) {
  const bytes = input instanceof Uint8Array
    ? input
    : new TextEncoder().encode(JSON.stringify(input));
  return createLearningCatalogLoader({
    catalogUrl: runtimeCatalogUrl,
    maxBytes: options.maxBytes,
    fetchImpl: options.fetchImpl || (async () => byteResponse(bytes, options.responseOptions)),
  });
}

test('feature off tidak membuat service atau fetch', async () => {
  let calls = 0;
  const controller = createCatalogPageController({
    contract: { enabled: false },
    view: createSpyView(),
    serviceFactory() { calls += 1; throw new Error('should-not-run'); },
  });
  await controller.whenSettled();
  assert.equal(calls, 0);
  assert.equal(controller.getState().state, 'disabled');
});

test('catalog valid memuat entry published dan approved', async () => {
  const result = await loaderFor(catalogBytes).loadCatalog();
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].status, 'published');
  assert.equal(result.entries[0].reviewStatus, 'approved');
});

test('paket draft pending review tidak ditampilkan', async () => {
  const input = clone(catalogInput);
  input.packages[0].status = 'draft';
  input.packages[0].reviewStatus = 'pending_human_review';
  const result = await loaderFor(input).loadCatalog();
  assert.equal(result.entries.length, 0);
});

test('response non-OK ditolak', async () => {
  await assert.rejects(
    loaderFor(catalogBytes, { fetchImpl: async () => byteResponse(catalogBytes, { ok: false }) })
      .loadCatalog(),
    { code: 'catalog_load_failed' },
  );
});

test('JSON catalog rusak ditolak', async () => {
  await assert.rejects(loaderFor(new TextEncoder().encode('{')).loadCatalog(), {
    code: 'catalog_json_invalid',
  });
});

test('catalog melampaui batas ditolak sebelum parse', async () => {
  await assert.rejects(loaderFor(catalogBytes, { maxBytes: 4 }).loadCatalog(), {
    code: 'catalog_too_large',
  });
});

test('catalog URL yang tidak aman ditolak sebelum fetch', () => {
  let calls = 0;
  assert.throws(() => createLearningCatalogLoader({
    catalogUrl: 'https://example.test/elsewhere/catalog.json',
    fetchImpl: async () => { calls += 1; },
  }), { code: 'unsafe_path' });
  assert.equal(calls, 0);
});

test('output catalog immutable', async () => {
  const result = await loaderFor(catalogBytes).loadCatalog();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entries), true);
  assert.throws(() => { result.entries.push({}); }, TypeError);
});
