import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonReaderService } from '../../../assets/js/mandiri/learning/services/lesson-reader-service.js';
import { createPublishedLoaders } from './fixtures.mjs';

function createService() {
  return createLessonReaderService(createPublishedLoaders());
}

test('lesson ditemukan dengan blocks, activities, dan exercises terurut', async () => {
  const service = createService();
  const view = await service.getLessonView('lesson-read-prices-id');
  assert.equal(view.lesson.title, 'Membaca Harga');
  assert.ok(view.lesson.blocks.length >= 5);
  assert.deepEqual(view.lesson.activities.map((item) => item.activityId), [
    'activity-read-price-example-id',
  ]);
  assert.deepEqual(view.lesson.exercises.map((item) => item.exerciseId), [
    'exercise-read-price-choice-id',
    'exercise-read-price-number-id',
    'exercise-read-currency-text-id',
  ]);
});

test('lesson tidak dikenal ditolak aman', async () => {
  await assert.rejects(createService().getLessonView('lesson-not-known-id'), {
    code: 'lesson_not_found',
  });
});

test('previous dan next lesson mengikuti module order', async () => {
  const service = createService();
  const first = await service.getLessonView('lesson-read-prices-id');
  assert.equal(first.navigation.previousLessonId, null);
  assert.equal(first.navigation.nextLessonId, 'lesson-add-prices-id');
  const middle = await service.getLessonView('lesson-add-prices-id');
  assert.equal(middle.navigation.previousLessonId, 'lesson-read-prices-id');
  assert.equal(middle.navigation.nextLessonId, 'lesson-calculate-change-id');
  const last = await service.getLessonView('lesson-calculate-change-id');
  assert.equal(last.navigation.previousLessonId, 'lesson-add-prices-id');
  assert.equal(last.navigation.nextLessonId, null);
});

test('public exercise tidak memuat correctAnswer', async () => {
  const service = createService();
  const view = await service.getLessonView('lesson-add-prices-id');
  view.lesson.exercises.forEach((exercise) => {
    assert.equal(Object.hasOwn(exercise, 'correctAnswer'), false);
  });
  assert.doesNotMatch(JSON.stringify(view), /correctAnswer/u);
});

test('sequence mendapat urutan awal alternatif deterministik', async () => {
  const service = createService();
  const first = await service.getLessonView('lesson-calculate-change-id');
  const second = await service.getLessonView('lesson-calculate-change-id');
  const firstOrder = first.lesson.exercises.at(-1).choices.map((choice) => choice.choiceId);
  const secondOrder = second.lesson.exercises.at(-1).choices.map((choice) => choice.choiceId);
  assert.deepEqual(firstOrder, secondOrder);
  assert.deepEqual(firstOrder, [
    'choice-change-read-paid-id',
    'choice-change-subtract-id',
    'choice-change-check-id',
    'choice-change-read-total-id',
  ]);
});

test('evaluator privat menilai jawaban tanpa mengembalikan expected answer', async () => {
  const service = createService();
  await service.getLessonView('lesson-read-prices-id');
  const correct = service.evaluateExercise('exercise-read-price-number-id', '3000');
  assert.equal(correct.correct, true);
  assert.equal(correct.feedbackCode, 'correct');
  assert.equal(Object.hasOwn(correct, 'expectedAnswer'), false);
  assert.equal(Object.hasOwn(correct, 'normalizedAnswer'), false);
});

test('invalid answer tidak menambah submission count', async () => {
  const service = createService();
  await service.getLessonView('lesson-read-prices-id');
  const result = service.evaluateExercise('exercise-read-price-number-id', '3.000');
  assert.equal(result.feedbackCode, 'invalid_answer');
  assert.equal(result.submissionCount, 0);
});

for (const value of ['-1', '+3000', '3.0', '3e3', 'Infinity', 'NaN', '1 + 2']) {
  test(`numeric input ${value} ditolak sebagai invalid`, async () => {
    const service = createService();
    await service.getLessonView('lesson-read-prices-id');
    const result = service.evaluateExercise('exercise-read-price-number-id', value);
    assert.equal(result.feedbackCode, 'invalid_answer');
    assert.equal(result.submissionCount, 0);
  });
}

test('exercise dari lesson lain tidak aktif', async () => {
  const service = createService();
  await service.getLessonView('lesson-read-prices-id');
  assert.throws(
    () => service.evaluateExercise('exercise-change-first-number-id', '7000'),
    { code: 'exercise_not_found' },
  );
});

test('lesson output immutable', async () => {
  const view = await createService().getLessonView('lesson-read-prices-id');
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.lesson.exercises), true);
  assert.throws(() => { view.lesson.title = 'ubah'; }, TypeError);
});

test('service destroy menghapus evaluator aktif dari memori', async () => {
  const service = createService();
  await service.getLessonView('lesson-read-prices-id');
  service.destroy();
  assert.throws(
    () => service.evaluateExercise('exercise-read-price-number-id', '3000'),
    { code: 'exercise_not_found' },
  );
});
