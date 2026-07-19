import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON_RECOMMENDATION_LABELS,
  recommendLesson,
} from '../../../assets/js/mandiri/learning/services/lesson-recommendation.js';

const lessons = Object.freeze([
  { lessonId: 'lesson-one-id' },
  { lessonId: 'lesson-two-id' },
  { lessonId: 'lesson-three-id' },
]);

function progress(overrides = {}) {
  return {
    lessonId: 'lesson-one-id',
    contentVersion: 1,
    state: 'mastered_this_practice',
    lastPracticedAtLocal: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

test('rekomendasi deterministik memilih awal, lanjut, latihan, lalu selesai', () => {
  assert.equal(recommendLesson({ lessons, progressRecords: [], contentVersion: 1 }).lessonId, 'lesson-one-id');
  assert.deepEqual(
    recommendLesson({ lessons, progressRecords: [progress()], contentVersion: 1 }),
    {
      lessonId: 'lesson-two-id',
      reason: 'continue',
      label: LESSON_RECOMMENDATION_LABELS.continue,
    },
  );
  assert.equal(recommendLesson({
    lessons,
    progressRecords: [progress({ lessonId: 'lesson-two-id', state: 'needs_practice' })],
    contentVersion: 1,
  }).lessonId, 'lesson-two-id');
  assert.equal(recommendLesson({
    lessons,
    progressRecords: [progress({ lessonId: 'lesson-three-id' })],
    contentVersion: 1,
  }).reason, 'complete');
});

test('progress contentVersion lama tidak dapat menentukan rekomendasi paket baru', () => {
  const result = recommendLesson({
    lessons,
    progressRecords: [progress({ contentVersion: 1, lessonId: 'lesson-three-id' })],
    contentVersion: 2,
  });
  assert.equal(result.lessonId, 'lesson-one-id');
  assert.equal(result.reason, 'start');
});

test('label rekomendasi tidak memakai AI, ranking, atau bahasa merendahkan', () => {
  const labels = Object.values(LESSON_RECOMMENDATION_LABELS).join(' ');
  assert.doesNotMatch(labels, /\bAI\b|bodoh|gagal|lemah|ranking|peringkat|terburuk/iu);
});
