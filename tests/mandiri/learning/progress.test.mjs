import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProgress,
  PROGRESS_STATE_LABELS,
  PROGRESS_STATES,
} from '../../../assets/js/mandiri/learning/domain/progress.js';

const ATTEMPT_ID = 'attempt_11111111-1111-4111-8111-111111111111';

function validProgress(overrides = {}) {
  return {
    learnerScope: `guest:${'b'.repeat(64)}`,
    courseId: 'course-menghitung-uang',
    moduleId: 'module-nilai-uang',
    lessonId: 'lesson-membaca-harga',
    contentVersion: 1,
    state: 'needs_practice',
    bestScoreBasisPoints: 5000,
    lastAttemptId: ATTEMPT_ID,
    attemptCount: 1,
    lastPracticedAtLocal: '2026-07-17T01:05:00.000Z',
    ...overrides,
  };
}

test('seluruh progress state valid', () => {
  for (const state of PROGRESS_STATES) {
    const input = state === 'not_started'
      ? validProgress({
        state,
        bestScoreBasisPoints: null,
        lastAttemptId: null,
        attemptCount: 0,
        lastPracticedAtLocal: null,
      })
      : validProgress({ state });
    assert.equal(normalizeProgress(input).state, state);
  }
});

test('unknown progress state ditolak', () => {
  assert.throws(() => normalizeProgress(validProgress({ state: 'failed' })), {
    code: 'unknown_progress_state',
  });
});

test('best score invalid ditolak', () => {
  assert.throws(() => normalizeProgress(validProgress({ bestScoreBasisPoints: 10.5 })), {
    code: 'invalid_integer',
  });
  assert.throws(() => normalizeProgress(validProgress({ bestScoreBasisPoints: 10001 })), {
    code: 'invalid_integer',
  });
});

test('attemptCount negatif ditolak', () => {
  assert.throws(() => normalizeProgress(validProgress({ attemptCount: -1 })), {
    code: 'invalid_integer',
  });
});

test('not_started tidak boleh memiliki attempt data', () => {
  assert.throws(() => normalizeProgress(validProgress({ state: 'not_started' })), {
    code: 'not_started_has_attempt_data',
  });
});

test('label mastery terbatas pada latihan ini dan tidak merendahkan', () => {
  assert.equal(
    PROGRESS_STATE_LABELS.mastered_this_practice,
    'Sudah dikuasai pada latihan ini',
  );
  const labels = Object.values(PROGRESS_STATE_LABELS).join(' ').toLowerCase();
  assert.doesNotMatch(labels, /bodoh|gagal|iq|setara sekolah|tidak mampu/);
});

test('progress immutable dan tidak memutasi input', () => {
  const input = validProgress();
  const snapshot = structuredClone(input);
  const progress = normalizeProgress(input);
  assert.equal(Object.isFrozen(progress), true);
  assert.deepEqual(input, snapshot);
});
