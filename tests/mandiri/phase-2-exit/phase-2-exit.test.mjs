import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('schema Fase 2 tetap dipertahankan setelah migrasi lanjutan non-destruktif', async () => {
  const [schema, migrations, docs] = await Promise.all([
    read('assets/js/mandiri/storage/schema.js'),
    read('assets/js/mandiri/storage/migrations.js'),
    read('docs/vitanusa-mandiri/27-phase-2-exit.md'),
  ]);
  assert.match(schema, /MANDIRI_DATABASE_VERSION = 5/);
  assert.match(schema, /MANDIRI_SCHEMA_V2/);
  assert.doesNotMatch(migrations, /deleteObjectStore|deleteIndex|\.clear\s*\(/u);
  assert.match(docs, /tidak menurunkan IndexedDB v2/iu);
  assert.match(docs, /tidak menghapus data/iu);
});

test('offline hanya meng-cache allowlist statis dan validasi integritas tetap wajib', async () => {
  const [worker, catalogLoader, packageLoader] = await Promise.all([
    read('service-worker.js'),
    read('assets/js/mandiri/learning/data/catalog-loader.js'),
    read('assets/js/mandiri/learning/data/package-loader.js'),
  ]);
  assert.match(worker, /LEARNING_STATIC_PATHS/);
  assert.match(worker, /catalog\.json/);
  assert.match(worker, /manifest\.json/);
  assert.match(worker, /content\.json/);
  assert.doesNotMatch(worker, /localStorage|indexedDB|correctAnswer/u);
  assert.match(catalogLoader, /published/);
  assert.match(packageLoader, /contentBytes/);
  assert.match(packageLoader, /checksum_mismatch/);
  assert.match(packageLoader, /assertEntryManifestMatch/);
});

test('feature off tidak membuat runtime, membuka database, atau memuat paket', async () => {
  const [shell, catalogPage, lessonPage] = await Promise.all([
    read('assets/js/mandiri/learning/ui/learning-shell.js'),
    read('assets/js/mandiri/learning/ui/catalog-page.js'),
    read('assets/js/mandiri/learning/ui/lesson-page.js'),
  ]);
  assert.match(shell, /if \(contract\?\.enabled\)/);
  assert.match(catalogPage, /runtime \|\|= runtimeFactory\(\)/);
  assert.match(lessonPage, /runtime \|\|= createLearningRuntime\(\)/);
  assert.doesNotMatch(shell, /openMandiriDatabase|fetch\s*\(/u);
});

test('correctAnswer tidak masuk renderer, DOM, log, atau URL', async () => {
  const sources = await Promise.all([
    read('assets/js/mandiri/learning/ui/catalog-page.js'),
    read('assets/js/mandiri/learning/ui/lesson-page.js'),
    read('assets/js/mandiri/learning/ui/exercise-renderer.js'),
    read('assets/js/mandiri/learning/ui/learning-routing.js'),
  ]);
  const joined = sources.join('\n');
  assert.doesNotMatch(joined, /correctAnswer|console\.(?:log|info|debug)|[?&](?:answer|correct)=/u);
  assert.doesNotMatch(joined, /innerHTML|insertAdjacentHTML/u);
});

test('restore tetap preview-only dan backup menerima v1 serta v2', async () => {
  const [preview, recovery, backupSchema] = await Promise.all([
    read('assets/js/mandiri/export/restore-preview.js'),
    read('assets/js/mandiri/shell/recovery-page.js'),
    read('assets/js/mandiri/export/backup-schema.js'),
  ]);
  assert.doesNotMatch(preview, /openMandiriDatabase|runTransaction|\.put\s*\(|\.add\s*\(/u);
  assert.doesNotMatch(recovery, /restoreCommit|commitRestore|importBackup/u);
  assert.match(backupSchema, /\[1, 2, 3, MANDIRI_BACKUP_FORMAT_VERSION\]/);
  assert.match(backupSchema, /MANDIRI_BACKUP_FORMAT_VERSION = 5/);
  assert.match(backupSchema, /!\[1, 2, 3, 4, MANDIRI_BACKUP_FORMAT_VERSION\]\.includes/);
});

test('aksesibilitas dan responsive hardening tersedia', async () => {
  const [css, catalogHtml, lessonHtml] = await Promise.all([
    read('assets/css/nusabelajar.css'),
    read('mandiri/belajar/index.html'),
    read('mandiri/belajar/lesson.html'),
  ]);
  assert.match(catalogHtml, /viewport-fit=cover/);
  assert.match(lessonHtml, /viewport-fit=cover/);
  assert.match(catalogHtml, /aria-live="polite"/);
  assert.match(lessonHtml, /aria-live="polite"/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /safe-area-inset/);
});

test('scope Fase 3, cloud, AI grading, leaderboard, sertifikat, kasir, dan sheet tidak dibuka', async () => {
  const docs = await read('docs/vitanusa-mandiri/27-phase-2-exit.md');
  assert.match(docs, /Tidak ada Firestore atau cloud sync/iu);
  assert.match(docs, /Tidak ada AI grading/iu);
  assert.match(docs, /Tidak ada leaderboard atau sertifikat/iu);
  assert.match(docs, /NusaKasir|VitaSheet/u);
  assert.match(docs, /Fase 3 tidak dimulai/iu);
});
