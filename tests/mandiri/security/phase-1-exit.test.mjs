import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => readFile(resolve(ROOT, path), 'utf8');

test('seluruh fondasi struktur Fase 1 tersedia', async () => {
  const paths = [
    'assets/js/mandiri/config/feature-flags.js',
    'assets/js/mandiri/shell/app-shell.js',
    'assets/js/mandiri/domain/workspace.js',
    'assets/js/mandiri/storage/database.js',
    'assets/js/mandiri/repositories/repository-context.js',
    'assets/js/mandiri/services/workspace-service.js',
    'assets/js/mandiri/export/backup.js',
    'mandiri/recovery.html',
    'docs/vitanusa-mandiri/21-phase-1-implementation.md',
    'docs/vitanusa-mandiri/22-phase-1-runbook.md',
  ];
  await Promise.all(paths.map((path) => access(resolve(ROOT, path))));
});

test('Mandiri tidak mengimpor Firestore Rules atau backend', async () => {
  const files = [
    'assets/js/mandiri/export/backup.js',
    'assets/js/mandiri/export/restore-preview.js',
    'assets/js/mandiri/shell/recovery-page.js',
  ];
  const source = (await Promise.all(files.map(read))).join('\n');
  assert.doesNotMatch(source, /firestore\.rules|storage\.rules|backend\//i);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test('NusaBelajar, NusaKasir, XLSX, dan cloud sync belum dibuat', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.equal('xlsx' in (packageJson.dependencies ?? {}), false);
  assert.equal('xlsx' in (packageJson.devDependencies ?? {}), false);
  const schema = await read('assets/js/mandiri/storage/schema.js');
  assert.doesNotMatch(schema, /learningPackages|products:\s*store|sales:\s*store|syncOutbox:\s*store/);
  const html = await read('mandiri/index.html');
  assert.match(html, /NusaBelajar[\s\S]*Direncanakan/);
  assert.match(html, /NusaKasir[\s\S]*Direncanakan/);
});

test('service worker tidak membaca data privat Mandiri', async () => {
  const worker = await read('service-worker.js');
  assert.doesNotMatch(worker, /indexedDB|accountScope|workspaceId|operationReceipts/);
});

test('feature flag tetap default off dan dokumentasi tidak mengklaim produksi', async () => {
  const flags = await read('assets/js/mandiri/config/feature-flags.js');
  assert.match(flags, /return value === MANDIRI_FEATURE_STATES\.INTERNAL[\s\S]*MANDIRI_FEATURE_STATES\.OFF/);
  const docs = `${await read('docs/vitanusa-mandiri/21-phase-1-implementation.md')}\n${await read('docs/vitanusa-mandiri/22-phase-1-runbook.md')}`;
  assert.match(docs, /local-only/i);
  assert.match(docs, /belum siap produksi/i);
  assert.doesNotMatch(docs, /VitaNusa Mandiri siap produksi|NusaKasir sudah selesai/i);
});
