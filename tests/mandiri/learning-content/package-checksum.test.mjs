import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createContentSha256,
  verifyLearningPackages,
} from '../../../scripts/mandiri/learning/verify-learning-packages.mjs';

const learningRoot = new URL('../../../content/mandiri/learning/', import.meta.url);
const catalogPath = new URL('catalog.json', learningRoot);
const manifestPath = new URL('packages/money-basics-id-v1/manifest.json', learningRoot);
const contentPath = new URL('packages/money-basics-id-v1/content.json', learningRoot);
const verifyScript = fileURLToPath(new URL(
  '../../../scripts/mandiri/learning/verify-learning-packages.mjs',
  import.meta.url,
));

test('checksum manifest cocok dengan byte content aktual dan memakai lowercase SHA-256', async () => {
  const [manifestText, contentBytes] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(contentPath),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.contentSha256, createContentSha256(contentBytes));
  assert.equal(manifest.contentBytes, contentBytes.byteLength);
  assert.match(manifest.contentSha256, /^sha256:[a-f0-9]{64}$/);
});

test('perubahan satu byte menghasilkan checksum berbeda', async () => {
  const bytes = await readFile(contentPath);
  const changed = Buffer.from(bytes);
  changed[0] ^= 1;
  assert.notEqual(createContentSha256(bytes), createContentSha256(changed));
});

test('verifyLearningPackages memvalidasi satu package secara penuh', async () => {
  const result = await verifyLearningPackages({
    catalogPath: fileURLToPath(catalogPath),
    quiet: true,
  });
  assert.equal(result.packages.length, 1);
  assert.equal(result.packages[0].manifest.packageId, 'money-basics-id-v1');
  assert.equal(result.packages[0].graph.lessons.length, 3);
  assert.equal(result.packages[0].safetyFindings.length, 0);
});

test('script verify exit sukses untuk package valid', () => {
  const result = spawnSync(process.execPath, [verifyScript], {
    cwd: dirname(fileURLToPath(learningRoot)),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK money-basics-id-v1/);
});

test('script verify exit non-zero untuk fixture dengan satu byte berubah', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'vitanusa-learning-content-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const copiedLearningRoot = join(temporaryRoot, 'learning');
  await cp(fileURLToPath(learningRoot), copiedLearningRoot, { recursive: true });
  const copiedContentPath = join(
    copiedLearningRoot,
    'packages/money-basics-id-v1/content.json',
  );
  const content = await readFile(copiedContentPath);
  const changed = Buffer.concat([content, Buffer.from(' ')]);
  await writeFile(copiedContentPath, changed);

  const result = spawnSync(process.execPath, [verifyScript, join(copiedLearningRoot, 'catalog.json')], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /content_bytes_mismatch|content_checksum_mismatch/);
});

test('checksum stabil pada checkout yang sama', async () => {
  const bytes = await readFile(contentPath);
  assert.equal(createContentSha256(bytes), createContentSha256(Buffer.from(bytes)));
});
