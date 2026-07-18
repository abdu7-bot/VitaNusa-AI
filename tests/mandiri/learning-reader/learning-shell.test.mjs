import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import {
  createMandiriModuleModels,
  createMandiriShellModel,
} from '../../../assets/js/mandiri/shell/app-shell.js';
import {
  createLearningPageModel,
  getBuildLearningFeatureContract,
} from '../../../assets/js/mandiri/learning/ui/learning-shell.js';
import { manifestInput, repositoryRoot } from './fixtures.mjs';

test('Mandiri off selalu membuat learning off', () => {
  assert.equal(getBuildLearningFeatureContract({
    mandiriState: 'off', learningState: 'internal',
  }).enabled, false);
  assert.equal(createMandiriShellModel('off', 'internal').modules.length, 0);
});

test('learning off mempertahankan seluruh card sebagai direncanakan', () => {
  const modules = createMandiriModuleModels({
    mandiriState: 'internal', learningState: 'off',
  });
  assert.ok(modules.every((module) => module.state === 'direncanakan'));
  assert.equal(modules.find((module) => module.name === 'NusaBelajar').href, undefined);
});

test('kedua flag internal mengaktifkan hanya link NusaBelajar', () => {
  const modules = createMandiriModuleModels({
    mandiriState: 'internal', learningState: 'internal',
  });
  const belajar = modules.find((module) => module.name === 'NusaBelajar');
  assert.equal(belajar.state, 'internal');
  assert.equal(belajar.href, './belajar/');
  assert.equal(modules.find((module) => module.name === 'NusaKasir').state, 'direncanakan');
  assert.equal(modules.find((module) => module.name === 'VitaSheet').state, 'direncanakan');
});

test('page state mempunyai loading, ready, empty, not_found, error dan disabled aman', () => {
  for (const state of ['disabled', 'loading', 'ready', 'empty', 'not_found', 'error']) {
    assert.equal(createLearningPageModel(state).state, state);
  }
  assert.equal(createLearningPageModel('unknown').state, 'error');
});

test('modul reader tidak mengimpor auth, storage, atau remote endpoint', async () => {
  const files = [
    'assets/js/mandiri/learning/data/catalog-loader.js',
    'assets/js/mandiri/learning/data/package-loader.js',
    'assets/js/mandiri/learning/services/learning-catalog-service.js',
    'assets/js/mandiri/learning/services/lesson-reader-service.js',
    'assets/js/mandiri/learning/ui/catalog-page.js',
    'assets/js/mandiri/learning/ui/lesson-page.js',
  ];
  const source = (await Promise.all(files.map((file) => readFile(
    new URL(file, repositoryRoot), 'utf8',
  )))).join('\n');
  assert.doesNotMatch(source, /user-auth|workspace-service|indexedDB|localStorage|sessionStorage|firebase/u);
  assert.doesNotMatch(source, /https?:\/\//u);
});

test('build menghasilkan dua halaman dan tiga file runtime content byte-for-byte', async () => {
  const sourceContent = await readFile(new URL(
    'content/mandiri/learning/packages/money-basics-id-v1/content.json', repositoryRoot,
  ));
  const builtContent = await readFile(new URL(
    'dist/content/mandiri/learning/packages/money-basics-id-v1/content.json', repositoryRoot,
  ));
  await Promise.all([
    stat(new URL('dist/mandiri/belajar/index.html', repositoryRoot)),
    stat(new URL('dist/mandiri/belajar/lesson.html', repositoryRoot)),
    stat(new URL('dist/content/mandiri/learning/catalog.json', repositoryRoot)),
    stat(new URL(
      'dist/content/mandiri/learning/packages/money-basics-id-v1/manifest.json',
      repositoryRoot,
    )),
  ]);
  assert.deepEqual(builtContent, sourceContent);
  const checksum = `sha256:${createHash('sha256').update(builtContent).digest('hex')}`;
  assert.equal(checksum, manifestInput.contentSha256);
  assert.equal(builtContent.byteLength, manifestInput.contentBytes);
});

test('build tidak mempublikasikan laporan review manusia', async () => {
  await assert.rejects(
    stat(new URL(
      'dist/content/mandiri/learning/packages/money-basics-id-v1/CONTENT-REVIEW.md',
      repositoryRoot,
    )),
    { code: 'ENOENT' },
  );
});
