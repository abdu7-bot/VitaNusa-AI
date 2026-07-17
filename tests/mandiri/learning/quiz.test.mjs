import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuiz } from '../../../assets/js/mandiri/learning/domain/quiz.js';

function validQuiz(overrides = {}) {
  return {
    quizId: 'quiz-membaca-harga',
    moduleId: null,
    lessonId: 'lesson-membaca-harga',
    contentVersion: 1,
    locale: 'id-ID',
    exerciseIds: ['exercise-pilih-harga'],
    passingThresholdBasisPoints: 7500,
    status: 'published',
    ...overrides,
  };
}

test('quiz lesson-level valid', () => {
  const quiz = normalizeQuiz(validQuiz());
  assert.equal(quiz.lessonId, 'lesson-membaca-harga');
  assert.equal(quiz.moduleId, null);
});

test('quiz module-level valid', () => {
  const quiz = normalizeQuiz(validQuiz({
    moduleId: 'module-nilai-uang',
    lessonId: null,
  }));
  assert.equal(quiz.moduleId, 'module-nilai-uang');
});

test('quiz menolak lesson dan module bersamaan atau keduanya kosong', () => {
  assert.throws(() => normalizeQuiz(validQuiz({ moduleId: 'module-nilai-uang' })), {
    code: 'invalid_quiz_scope',
  });
  assert.throws(() => normalizeQuiz(validQuiz({ lessonId: null, moduleId: null })), {
    code: 'invalid_quiz_scope',
  });
});

test('quiz menolak threshold di bawah 0 dan di atas 10000', () => {
  assert.throws(() => normalizeQuiz(validQuiz({ passingThresholdBasisPoints: -1 })), {
    code: 'invalid_integer',
  });
  assert.throws(() => normalizeQuiz(validQuiz({ passingThresholdBasisPoints: 10001 })), {
    code: 'invalid_integer',
  });
});

test('quiz menolak exercise ID duplicate dan timer field', () => {
  assert.throws(() => normalizeQuiz(validQuiz({
    exerciseIds: ['exercise-pilih-harga', 'exercise-pilih-harga'],
  })), { code: 'duplicate_id' });
  assert.throws(() => normalizeQuiz(validQuiz({ timerSeconds: 30 })), { code: 'unknown_field' });
});
