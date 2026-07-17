import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizeLearningPackageCatalog,
  validateLearningPackageCatalog,
} from '../../../assets/js/mandiri/learning/content/package-catalog.js';

const catalogPath = new URL('../../../content/mandiri/learning/catalog.json', import.meta.url);
const manifestPath = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
  import.meta.url,
);

async function loadFiles() {
  const [catalogText, manifestText] = await Promise.all([
    readFile(catalogPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);
  return {
    catalog: JSON.parse(catalogText),
    manifest: JSON.parse(manifestText),
  };
}

function manifestMap(manifest) {
  return new Map([['packages/money-basics-id-v1/manifest.json', manifest]]);
}

test('catalog valid memakai relative manifest path dan cocok dengan manifest', async () => {
  const { catalog, manifest } = await loadFiles();
  const before = structuredClone(catalog);
  const normalized = normalizeLearningPackageCatalog(catalog, {
    manifestsByPath: manifestMap(manifest),
  });

  assert.equal(validateLearningPackageCatalog(catalog), true);
  assert.equal(normalized.packages[0].manifestPath, 'packages/money-basics-id-v1/manifest.json');
  assert.equal(Object.isFrozen(normalized.packages), true);
  assert.deepEqual(catalog, before);
});

test('catalog menolak package ID duplicate', async () => {
  const { catalog } = await loadFiles();
  catalog.packages.push(structuredClone(catalog.packages[0]));
  assert.throws(() => normalizeLearningPackageCatalog(catalog), {
    code: 'duplicate_package_id',
  });
});

test('catalog menolak absolute path, traversal, backslash, dan URL', async () => {
  for (const manifestPathValue of [
    '/packages/money-basics-id-v1/manifest.json',
    '../money-basics-id-v1/manifest.json',
    'packages/../money-basics-id-v1/manifest.json',
    'packages\\money-basics-id-v1\\manifest.json',
    'https://example.test/manifest.json',
    'file:manifest.json',
  ]) {
    const { catalog } = await loadFiles();
    catalog.packages[0].manifestPath = manifestPathValue;
    assert.throws(() => normalizeLearningPackageCatalog(catalog), {
      code: 'unsafe_manifest_path',
    });
  }
});

test('catalog menolak path relatif yang tidak cocok dengan package ID', async () => {
  const { catalog } = await loadFiles();
  catalog.packages[0].manifestPath = 'packages/other-package/manifest.json';
  assert.throws(() => normalizeLearningPackageCatalog(catalog), {
    code: 'manifest_path_mismatch',
  });
});

test('catalog menolak package yang manifest-nya hilang', async () => {
  const { catalog } = await loadFiles();
  assert.throws(() => normalizeLearningPackageCatalog(catalog, {
    manifestsByPath: new Map(),
  }), { code: 'manifest_missing' });
});

test('catalog menolak status atau reviewStatus yang berbeda dari manifest', async () => {
  const { catalog, manifest } = await loadFiles();
  const publishedManifest = structuredClone(manifest);
  publishedManifest.status = 'published';
  publishedManifest.reviewStatus = 'approved';

  assert.throws(() => normalizeLearningPackageCatalog(catalog, {
    manifestsByPath: manifestMap(publishedManifest),
  }), { code: 'catalog_manifest_mismatch' });
});

test('catalog menolak field tambahan dan format yang tidak dikenal', async () => {
  const { catalog } = await loadFiles();
  catalog.packages[0].workspaceId = 'workspace-test';
  assert.throws(() => normalizeLearningPackageCatalog(catalog), { code: 'unknown_field' });

  const { catalog: wrongFormat } = await loadFiles();
  wrongFormat.catalogFormat = 'other-catalog';
  assert.throws(() => normalizeLearningPackageCatalog(wrongFormat), {
    code: 'catalog_format_unknown',
  });
});

test('catalog menolak dangerous key dan review gate yang tidak konsisten', async () => {
  const { catalog } = await loadFiles();
  const dangerous = JSON.parse(JSON.stringify(catalog).replace(
    /"catalogFormat"/,
    '"prototype":{},"catalogFormat"',
  ));
  assert.throws(() => normalizeLearningPackageCatalog(dangerous), { code: 'dangerous_key' });

  const { catalog: bypass } = await loadFiles();
  bypass.packages[0].reviewStatus = 'approved';
  assert.throws(() => normalizeLearningPackageCatalog(bypass), {
    code: 'review_gate_mismatch',
  });
});
