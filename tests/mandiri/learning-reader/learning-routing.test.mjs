import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLessonHref,
  parseLessonRoute,
} from '../../../assets/js/mandiri/learning/ui/learning-routing.js';
import { repositoryRoot } from './fixtures.mjs';

test('lesson ID valid diterima dan href relatif dibuat', () => {
  assert.deepEqual(parseLessonRoute('?lesson=lesson-read-prices-id'), {
    ok: true,
    reason: null,
    lessonId: 'lesson-read-prices-id',
  });
  assert.equal(createLessonHref('lesson-read-prices-id'), './lesson.html?lesson=lesson-read-prices-id');
});

for (const [name, search] of [
  ['parameter hilang', ''],
  ['parameter kosong', '?lesson='],
  ['ID terlalu panjang', `?lesson=lesson-${'a'.repeat(130)}`],
  ['karakter invalid', '?lesson=../../content.json'],
  ['duplicate parameter', '?lesson=lesson-a-id&lesson=lesson-b-id'],
  ['parameter tambahan', '?lesson=lesson-a-id&x=1'],
  ['script string', '?lesson=%3Cscript%3Ealert(1)%3C%2Fscript%3E'],
]) {
  test(`${name} ditolak`, () => assert.equal(parseLessonRoute(search).ok, false));
}

test('lesson ID hanya dipakai untuk graph lookup, bukan fetch path atau import', async () => {
  const serviceSource = await readFile(
    new URL('assets/js/mandiri/learning/services/lesson-reader-service.js', repositoryRoot),
    'utf8',
  );
  assert.doesNotMatch(serviceSource, /fetch\s*\([^)]*lessonId|import\s*\([^)]*lessonId/u);
});
