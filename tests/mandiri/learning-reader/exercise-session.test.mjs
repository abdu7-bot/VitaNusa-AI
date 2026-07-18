import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createExerciseSession,
  resetExerciseSession,
  submitExerciseSession,
  updateExerciseSessionAnswer,
} from '../../../assets/js/mandiri/learning/engine/exercise-session.js';
import { repositoryRoot } from './fixtures.mjs';

const exerciseId = 'exercise-read-price-number-id';

test('initial state immutable tidak memuat score atau scope', () => {
  const state = createExerciseSession({ exerciseId });
  assert.equal(state.status, 'idle');
  assert.equal(state.submissionCount, 0);
  assert.equal(state.attemptsRemaining, null);
  for (const field of ['score', 'learnerScope', 'accountScope', 'workspaceId', 'operationId']) {
    assert.equal(Object.hasOwn(state, field), false);
  }
  assert.equal(Object.isFrozen(state), true);
});

test('answer update membuat state baru tanpa mutasi input', () => {
  const state = createExerciseSession({ exerciseId });
  const next = updateExerciseSessionAnswer(state, '3000');
  assert.equal(state.answer, null);
  assert.equal(next.answer, '3000');
  assert.equal(next.status, 'answering');
});

for (const [name, evaluation, expected] of [
  ['correct', { correct: true, feedbackCode: 'correct', submissionCount: 1, attemptsRemaining: null }, 'correct'],
  ['incorrect', { correct: false, feedbackCode: 'try_again', submissionCount: 1, attemptsRemaining: null }, 'incorrect'],
  ['invalid', { correct: false, feedbackCode: 'invalid_answer', submissionCount: 0, attemptsRemaining: null }, 'invalid'],
]) {
  test(`${name} evaluation membentuk status yang tepat`, () => {
    const state = submitExerciseSession(createExerciseSession({ exerciseId }), evaluation);
    assert.equal(state.status, expected);
    assert.equal(state.submissionCount, evaluation.submissionCount);
  });
}

test('maxAttempts integer mencapai limit_reached', () => {
  const initial = createExerciseSession({ exerciseId, maxAttempts: 2 });
  const first = submitExerciseSession(initial, {
    correct: false,
    feedbackCode: 'try_again',
    submissionCount: 1,
    attemptsRemaining: 1,
  });
  const second = submitExerciseSession(first, {
    correct: false,
    feedbackCode: 'review_example',
    submissionCount: 2,
    attemptsRemaining: 0,
  });
  assert.equal(second.status, 'limit_reached');
  assert.equal(second.attemptsRemaining, 0);
});

test('maxAttempts null tidak membatasi session', () => {
  const state = submitExerciseSession(createExerciseSession({ exerciseId }), {
    correct: false,
    feedbackCode: 'try_again',
    submissionCount: 99,
    attemptsRemaining: null,
  });
  assert.equal(state.status, 'incorrect');
});

test('reset dan session baru menghapus jawaban sementara', () => {
  const answered = updateExerciseSessionAnswer(createExerciseSession({ exerciseId }), '3000');
  const reset = resetExerciseSession(answered);
  const reloaded = createExerciseSession({ exerciseId });
  assert.equal(reset.answer, null);
  assert.deepEqual(reset, reloaded);
});

test('array answer disalin dan output tidak membuka referensi mutable', () => {
  const answer = ['choice-a-id', 'choice-b-id'];
  const next = updateExerciseSessionAnswer(createExerciseSession({ exerciseId }), answer);
  answer.push('choice-c-id');
  assert.deepEqual(next.answer, ['choice-a-id', 'choice-b-id']);
  assert.equal(Object.isFrozen(next.answer), true);
});

test('engine tidak menggunakan persistence atau network', async () => {
  const source = await readFile(
    new URL('assets/js/mandiri/learning/engine/exercise-session.js', repositoryRoot),
    'utf8',
  );
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|fetch\s*\(/u);
});
