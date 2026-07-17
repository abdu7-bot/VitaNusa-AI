import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExercise } from '../../../assets/js/mandiri/learning/domain/exercise.js';

const CHOICES = Object.freeze([
  Object.freeze({ choiceId: 'choice-seribu', label: 'Rp1.000' }),
  Object.freeze({ choiceId: 'choice-duaribu', label: 'Rp2.000' }),
  Object.freeze({ choiceId: 'choice-limaribu', label: 'Rp5.000' }),
]);

function base(overrides = {}) {
  return {
    exerciseId: 'exercise-pilih-harga',
    lessonId: 'lesson-membaca-harga',
    contentVersion: 1,
    locale: 'id-ID',
    type: 'single_choice',
    prompt: 'Pilih harga yang bernilai dua ribu rupiah.',
    choices: CHOICES.map((choice) => ({ ...choice })),
    correctAnswer: 'choice-duaribu',
    explanation: 'Dua ribu rupiah ditulis Rp2.000.',
    maxAttempts: 3,
    status: 'published',
    ...overrides,
  };
}

test('single choice valid', () => {
  const exercise = normalizeExercise(base());
  assert.equal(exercise.type, 'single_choice');
  assert.equal(exercise.correctAnswer, 'choice-duaribu');
  assert.equal(Object.isFrozen(exercise.choices), true);
});

test('multiple choice valid', () => {
  const exercise = normalizeExercise(base({
    type: 'multiple_choice',
    correctAnswer: ['choice-seribu', 'choice-duaribu'],
  }));
  assert.deepEqual(exercise.correctAnswer, ['choice-seribu', 'choice-duaribu']);
});

test('numeric input valid dan hanya integer', () => {
  const exercise = normalizeExercise(base({
    type: 'numeric_input', choices: [], correctAnswer: 2000,
  }));
  assert.equal(exercise.correctAnswer, 2000);
  assert.throws(() => normalizeExercise(base({
    type: 'numeric_input', choices: [], correctAnswer: 1.5,
  })), { code: 'invalid_integer' });
  assert.throws(() => normalizeExercise(base({
    type: 'numeric_input', choices: [], correctAnswer: '1000 + 1000',
  })), { code: 'invalid_integer' });
});

test('short text exact valid', () => {
  const exercise = normalizeExercise(base({
    type: 'short_text_exact',
    choices: [],
    correctAnswer: { acceptedAnswers: ['dua ribu', 'Rp2.000'], caseSensitive: false },
  }));
  assert.equal(exercise.correctAnswer.caseSensitive, false);
  assert.equal(Object.isFrozen(exercise.correctAnswer.acceptedAnswers), true);
});

test('sequence valid dan mempertahankan urutan', () => {
  const exercise = normalizeExercise(base({
    type: 'sequence',
    correctAnswer: ['choice-seribu', 'choice-duaribu', 'choice-limaribu'],
  }));
  assert.deepEqual(exercise.correctAnswer, [
    'choice-seribu', 'choice-duaribu', 'choice-limaribu',
  ]);
});

test('unknown exercise type ditolak', () => {
  assert.throws(() => normalizeExercise(base({ type: 'essay_ai_graded' })), {
    code: 'unknown_exercise_type',
  });
});

test('duplicate choice ditolak', () => {
  assert.throws(() => normalizeExercise(base({
    choices: [{ ...CHOICES[0] }, { ...CHOICES[0] }],
    correctAnswer: 'choice-seribu',
  })), { code: 'duplicate_choice' });
});

test('correct choice yang hilang ditolak', () => {
  assert.throws(() => normalizeExercise(base({ correctAnswer: 'choice-sepuluh-ribu' })), {
    code: 'missing_correct_choice',
  });
});

test('multiple choice correct answer duplicate ditolak', () => {
  assert.throws(() => normalizeExercise(base({
    type: 'multiple_choice',
    correctAnswer: ['choice-seribu', 'choice-seribu'],
  })), { code: 'duplicate_correct_answer' });
});

test('maxAttempts null atau 1 sampai 10', () => {
  assert.equal(normalizeExercise(base({ maxAttempts: null })).maxAttempts, null);
  assert.throws(() => normalizeExercise(base({ maxAttempts: 0 })), { code: 'invalid_integer' });
  assert.throws(() => normalizeExercise(base({ maxAttempts: 11 })), { code: 'invalid_integer' });
});

test('exercise menolak unknown field dan tidak memutasi input', () => {
  const input = base();
  const snapshot = structuredClone(input);
  normalizeExercise(input);
  assert.deepEqual(input, snapshot);
  assert.throws(() => normalizeExercise(base({ gradingModel: 'llm' })), { code: 'unknown_field' });
});
