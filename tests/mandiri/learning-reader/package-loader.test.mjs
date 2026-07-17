import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createLearningPackageLoader } from '../../../assets/js/mandiri/learning/data/package-loader.js';
import { createBrowserSha256 } from '../../../assets/js/mandiri/learning/data/browser-checksum.js';
import {
  byteResponse,
  clone,
  contentBytes,
  contentInput,
  createStaticFetch,
  manifestInput,
  runtimeCatalogUrl,
  runtimeContentUrl,
  runtimeManifestUrl,
} from './fixtures.mjs';

const publishedEntry = Object.freeze({
  packageId: 'money-basics-id-v1',
  manifestPath: 'packages/money-basics-id-v1/manifest.json',
  locale: 'id-ID',
  status: 'published',
  reviewStatus: 'approved',
});

function encodedJson(value) {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function packageFixture({ content = contentInput, manifest = manifestInput } = {}) {
  const nextContentBytes = encodedJson(content);
  const nextManifest = { ...clone(manifest) };
  nextManifest.contentBytes = nextContentBytes.byteLength;
  nextManifest.contentSha256 = `sha256:${createHash('sha256').update(nextContentBytes).digest('hex')}`;
  return {
    content: nextContentBytes,
    manifest: encodedJson(nextManifest),
    manifestObject: nextManifest,
  };
}

function loaderFor(options = {}) {
  const fixture = options.fixture || { content: contentBytes, manifest: encodedJson(manifestInput) };
  const calls = [];
  const fetchImpl = options.fetchImpl || createStaticFetch({
    manifest: fixture.manifest,
    content: fixture.content,
    calls,
  });
  return {
    calls,
    loader: createLearningPackageLoader({
      fetchImpl,
      digestFactory: options.digestFactory || ((bytes) => createBrowserSha256(bytes, webcrypto)),
    }),
  };
}

test('manifest, checksum, dan graph valid dimuat lengkap', async () => {
  const { loader } = loaderFor();
  const result = await loader.loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl });
  assert.equal(result.manifest.packageId, publishedEntry.packageId);
  assert.equal(result.checksum, manifestInput.contentSha256);
  assert.equal(result.index.listLessons().length, 3);
});

for (const [name, status, reviewStatus] of [
  ['manifest draft', 'draft', 'pending_human_review'],
  ['manifest pending review', 'draft', 'pending_human_review'],
]) {
  test(`${name} ditolak`, async () => {
    const manifest = { ...clone(manifestInput), status, reviewStatus };
    const fixture = packageFixture({ manifest });
    const entry = { ...publishedEntry, status, reviewStatus };
    await assert.rejects(
      loaderFor({ fixture }).loader.loadPackage(entry, { catalogUrl: runtimeCatalogUrl }),
      { code: 'package_not_published' },
    );
  });
}

test('checksum mismatch ditolak tanpa partial fallback', async () => {
  const fixture = packageFixture();
  fixture.content = new Uint8Array(fixture.content);
  fixture.content[20] ^= 1;
  await assert.rejects(
    loaderFor({ fixture }).loader.loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'checksum_mismatch' },
  );
});

test('contentBytes mismatch ditolak sebelum checksum', async () => {
  const overrides = new Map([
    [runtimeManifestUrl, byteResponse(encodedJson(manifestInput))],
    [runtimeContentUrl, byteResponse(contentBytes.subarray(0, contentBytes.length - 1))],
  ]);
  await assert.rejects(
    loaderFor({ fetchImpl: createStaticFetch({ overrides }) }).loader
      .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'content_size_mismatch' },
  );
});

test('format checksum manifest invalid ditolak', async () => {
  const manifest = { ...clone(manifestInput), contentSha256: 'sha256:INVALID' };
  const fixture = { content: contentBytes, manifest: encodedJson(manifest) };
  await assert.rejects(
    loaderFor({ fixture }).loader.loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'manifest_invalid' },
  );
});

test('content graph invalid ditolak', async () => {
  const content = clone(contentInput);
  content.lessons[0].moduleId = 'module-missing-id';
  await assert.rejects(
    loaderFor({ fixture: packageFixture({ content }) }).loader
      .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'content_graph_invalid' },
  );
});

test('entity draft ditolak setelah graph validasi', async () => {
  const content = clone(contentInput);
  content.lessons[0].status = 'draft';
  await assert.rejects(
    loaderFor({ fixture: packageFixture({ content }) }).loader
      .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'content_graph_invalid' },
  );
});

for (const [field, value] of [
  ['packageId', 'different-package-id'],
  ['locale', 'en-US'],
]) {
  test(`${field} mismatch ditolak`, async () => {
    const manifest = { ...clone(manifestInput), [field]: value };
    await assert.rejects(
      loaderFor({ fixture: { content: contentBytes, manifest: encodedJson(manifest) } }).loader
        .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
      { code: 'manifest_invalid' },
    );
  });
}

test('contentVersion mismatch ditolak', async () => {
  const content = clone(contentInput);
  content.programs[0].contentVersion = 2;
  await assert.rejects(
    loaderFor({ fixture: packageFixture({ content }) }).loader
      .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'content_graph_invalid' },
  );
});

test('output package dan graph immutable', async () => {
  const result = await loaderFor().loader.loadPackage(publishedEntry, {
    catalogUrl: runtimeCatalogUrl,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.graph.lessons), true);
  assert.throws(() => { result.graph.lessons[0].title = 'ubah'; }, TypeError);
});

test('Web Crypto tidak tersedia gagal aman', async () => {
  await assert.rejects(
    loaderFor({ digestFactory: (bytes) => createBrowserSha256(bytes, {}) }).loader
      .loadPackage(publishedEntry, { catalogUrl: runtimeCatalogUrl }),
    { code: 'checksum_unavailable' },
  );
});
