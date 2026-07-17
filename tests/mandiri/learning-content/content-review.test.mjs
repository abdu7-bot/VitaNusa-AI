import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createContentReviewText } from '../../../scripts/mandiri/learning/print-content-review.mjs';

const packageRoot = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/',
  import.meta.url,
);
const manifestPath = new URL('manifest.json', packageRoot);
const contentPath = new URL('content.json', packageRoot);
const reviewPath = new URL('CONTENT-REVIEW.md', packageRoot);
const verifyScriptPath = new URL(
  '../../../scripts/mandiri/learning/verify-learning-packages.mjs',
  import.meta.url,
);
const reviewScriptPath = new URL(
  '../../../scripts/mandiri/learning/print-content-review.mjs',
  import.meta.url,
);

test('package dan seluruh entity published setelah persetujuan manusia', async () => {
  const [manifest, content] = await Promise.all([
    readFile(manifestPath, 'utf8').then(JSON.parse),
    readFile(contentPath, 'utf8').then(JSON.parse),
  ]);
  assert.equal(manifest.status, 'published');
  assert.equal(manifest.reviewStatus, 'approved');
  for (const collection of [
    content.programs,
    content.courses,
    content.modules,
    content.lessons,
    content.activities,
    content.exercises,
    content.quizzes,
  ]) {
    collection.forEach((entity) => assert.equal(entity.status, 'published'));
  }
});

test('CONTENT-REVIEW memuat seluruh exercise, jawaban, explanation, dan threshold', async () => {
  const [review, content] = await Promise.all([
    readFile(reviewPath, 'utf8'),
    readFile(contentPath, 'utf8').then(JSON.parse),
  ]);
  for (const exercise of content.exercises) {
    assert.ok(review.includes(exercise.prompt), exercise.exerciseId);
    assert.ok(review.includes(exercise.explanation), exercise.exerciseId);
  }
  assert.match(review, /7000.*basis points/);
  assert.match(review, /Arithmetic check: lulus/);
  assert.match(review, /Content safety lint: 0 finding/);
});

test('review mencatat identitas dokumentasi, tanggal, keputusan, dan catatan faktual', async () => {
  const review = await readFile(reviewPath, 'utf8');
  assert.match(review, /^Reviewer: Pemilik proyek VitaNusa$/m);
  assert.match(review, /^Tanggal: 2026-07-17$/m);
  assert.match(review, /^Keputusan: Disetujui untuk dipublikasikan$/m);
  assert.match(review, /^Catatan: Materi, contoh angka, latihan, jawaban benar, explanation, dan threshold kuis telah ditinjau dan disetujui secara eksplisit\.$/m);
  assert.doesNotMatch(review, /Reviewer:\s*(?:Codex|OpenAI)/i);
});

test('review script mencetak jawaban dan status approved tanpa melakukan self-approval', async () => {
  const output = await createContentReviewText();
  assert.match(output, /Review status: approved/);
  assert.match(output, /Correct answer: 11000/);
  assert.match(output, /Correct answer: \["choice-change-read-total-id"/);
});

test('script verifikasi dan review bersifat read-only', async () => {
  const sources = await Promise.all([
    readFile(verifyScriptPath, 'utf8'),
    readFile(reviewScriptPath, 'utf8'),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /\b(?:writeFile|appendFile|rename|copyFile|unlink)\b/);
    assert.doesNotMatch(source, /reviewStatus\s*=\s*['"]approved['"]/);
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  }
});

test('review report menegaskan persetujuan manusia dan bukan self-approval Codex', async () => {
  const review = await readFile(reviewPath, 'utf8');
  assert.match(review, /Codex bukan reviewer manusia/);
  assert.match(review, /Pemilik proyek VitaNusa telah meninjau dan menyetujui secara eksplisit/);
  assert.match(review, /persetujuan eksplisit pemilik proyek/);
});
