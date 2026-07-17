import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAttemptTransition,
  normalizeAttempt,
} from '../../../assets/js/mandiri/learning/domain/attempt.js';

const ATTEMPT_ID = 'attempt_11111111-1111-4111-8111-111111111111';
const OPERATION_ID = 'op_22222222-2222-4222-8222-222222222222';

function inProgressAttempt(overrides = {}) {
  return {
    attemptId: ATTEMPT_ID,
    learnerScope: `user:${'a'.repeat(64)}`,
    courseId: 'course-menghitung-uang',
    moduleId: 'module-nilai-uang',
    lessonId: 'lesson-membaca-harga',
    quizId: 'quiz-membaca-harga',
    contentVersion: 1,
    answers: [{ exerciseId: 'exercise-pilih-harga', answer: 'choice-duaribu' }],
    scoreBasisPoints: null,
    correctCount: null,
    questionCount: 3,
    status: 'in_progress',
    startedAtLocal: '2026-07-17T01:00:00.000Z',
    completedAtLocal: null,
    operationId: OPERATION_ID,
    ...overrides,
  };
}

function completedAttempt(overrides = {}) {
  return inProgressAttempt({
    answers: [
      { exerciseId: 'exercise-pilih-harga', answer: 'choice-duaribu' },
      { exerciseId: 'exercise-jumlah-harga', answer: 4000 },
    ],
    scoreBasisPoints: 6667,
    correctCount: 2,
    status: 'completed',
    completedAtLocal: '2026-07-17T01:05:00.000Z',
    ...overrides,
  });
}

test('attempt in-progress valid tanpa score final', () => {
  const attempt = normalizeAttempt(inProgressAttempt());
  assert.equal(attempt.status, 'in_progress');
  assert.equal(attempt.scoreBasisPoints, null);
});

test('attempt completed valid, immutable, dan input tidak dimutasi', () => {
  const input = completedAttempt();
  const snapshot = structuredClone(input);
  const attempt = normalizeAttempt(input);
  assert.equal(attempt.scoreBasisPoints, 6667);
  assert.equal(Object.isFrozen(attempt), true);
  assert.equal(Object.isFrozen(attempt.answers), true);
  assert.deepEqual(input, snapshot);
  assert.throws(() => { attempt.status = 'abandoned'; }, TypeError);
});

test('attempt completed tanpa timestamp ditolak', () => {
  assert.throws(() => normalizeAttempt(completedAttempt({ completedAtLocal: null })), {
    code: 'invalid_timestamp',
  });
});

test('attempt abandoned tidak mempunyai hasil final', () => {
  const attempt = normalizeAttempt(inProgressAttempt({
    status: 'abandoned',
    completedAtLocal: null,
  }));
  assert.equal(attempt.status, 'abandoned');
  assert.equal(attempt.scoreBasisPoints, null);
  assert.equal(attempt.correctCount, null);
});

test('attempt menolak score non-integer dan di luar batas', () => {
  assert.throws(() => normalizeAttempt(completedAttempt({ scoreBasisPoints: 6666.5 })), {
    code: 'invalid_integer',
  });
  assert.throws(() => normalizeAttempt(completedAttempt({ scoreBasisPoints: 10001 })), {
    code: 'invalid_integer',
  });
});

test('attempt menolak score yang tidak sesuai hitungan deterministik', () => {
  assert.throws(() => normalizeAttempt(completedAttempt({ scoreBasisPoints: 6666 })), {
    code: 'score_mismatch',
  });
});

test('attempt menolak correctCount melebihi questionCount', () => {
  assert.throws(() => normalizeAttempt(completedAttempt({ correctCount: 4 })), {
    code: 'invalid_integer',
  });
});

test('attempt completed tidak dapat ditimpa', () => {
  const current = completedAttempt();
  const changed = completedAttempt({ completedAtLocal: '2026-07-17T01:06:00.000Z' });
  assert.throws(() => assertAttemptTransition(current, changed), { code: 'attempt_immutable' });
  assert.equal(assertAttemptTransition(current, structuredClone(current)), true);
});

test('attempt menolak free-text panjang dan field privat asing', () => {
  assert.throws(() => normalizeAttempt(inProgressAttempt({
    answers: [{ exerciseId: 'exercise-pilih-harga', answer: 'a'.repeat(121) }],
  })), { code: 'string_too_long' });
  assert.throws(() => normalizeAttempt(inProgressAttempt({ workspaceId: 'workspace-other' })), {
    code: 'unknown_field',
  });
});

test('attempt menolak learnerScope email', () => {
  assert.throws(() => normalizeAttempt(inProgressAttempt({ learnerScope: 'user@example.com' })), {
    code: 'invalid_learner_scope',
  });
});
