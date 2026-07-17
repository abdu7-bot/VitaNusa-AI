import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScoreBasisPoints,
  evaluateAnswer,
} from '../../../assets/js/mandiri/learning/engine/answer-evaluator.js';

const CHOICES = [
  { choiceId: 'choice-seribu', label: 'Rp1.000' },
  { choiceId: 'choice-duaribu', label: 'Rp2.000' },
  { choiceId: 'choice-limaribu', label: 'Rp5.000' },
];

function exercise(overrides = {}) {
  return {
    exerciseId: 'exercise-pilih-harga',
    lessonId: 'lesson-membaca-harga',
    contentVersion: 1,
    locale: 'id-ID',
    type: 'single_choice',
    prompt: 'Pilih dua ribu rupiah.',
    choices: CHOICES.map((choice) => ({ ...choice })),
    correctAnswer: 'choice-duaribu',
    explanation: 'Dua ribu rupiah ditulis Rp2.000.',
    maxAttempts: null,
    status: 'published',
    ...overrides,
  };
}

test('single choice benar dan salah dievaluasi deterministik', () => {
  const correct = evaluateAnswer(exercise(), 'choice-duaribu');
  const wrong = evaluateAnswer(exercise(), 'choice-seribu');
  assert.equal(correct.correct, true);
  assert.equal(correct.feedbackCode, 'correct');
  assert.equal(wrong.correct, false);
  assert.equal(wrong.feedbackCode, 'try_again');
  assert.equal(Object.isFrozen(correct), true);
});

test('single choice tidak dikenal menjadi invalid_answer', () => {
  const result = evaluateAnswer(exercise(), 'choice-tidak-ada');
  assert.equal(result.correct, false);
  assert.equal(result.feedbackCode, 'invalid_answer');
  assert.equal(result.normalizedAnswer, null);
});

test('multiple choice tidak bergantung urutan', () => {
  const input = exercise({
    type: 'multiple_choice',
    correctAnswer: ['choice-seribu', 'choice-duaribu'],
  });
  assert.equal(evaluateAnswer(input, ['choice-duaribu', 'choice-seribu']).correct, true);
});

test('multiple choice submitted duplicate ditolak', () => {
  const input = exercise({
    type: 'multiple_choice',
    correctAnswer: ['choice-seribu', 'choice-duaribu'],
  });
  assert.equal(
    evaluateAnswer(input, ['choice-seribu', 'choice-seribu']).feedbackCode,
    'invalid_answer',
  );
});

test('numeric input menerima integer number dan string terkontrol', () => {
  const input = exercise({ type: 'numeric_input', choices: [], correctAnswer: 2000 });
  assert.equal(evaluateAnswer(input, 2000).correct, true);
  assert.equal(evaluateAnswer(input, ' 2000 ').correct, true);
});

test('numeric input menolak decimal dan exponent notation', () => {
  const input = exercise({ type: 'numeric_input', choices: [], correctAnswer: 2000 });
  assert.equal(evaluateAnswer(input, '2000.0').feedbackCode, 'invalid_answer');
  assert.equal(evaluateAnswer(input, '2e3').feedbackCode, 'invalid_answer');
  assert.equal(evaluateAnswer(input, Number.POSITIVE_INFINITY).feedbackCode, 'invalid_answer');
});

test('short text case-insensitive dan whitespace dinormalisasi', () => {
  const input = exercise({
    type: 'short_text_exact',
    choices: [],
    correctAnswer: { acceptedAnswers: ['Dua Ribu'], caseSensitive: false },
  });
  const result = evaluateAnswer(input, '  DUA   RIBU ');
  assert.equal(result.correct, true);
  assert.equal(result.normalizedAnswer, 'dua ribu');
});

test('short text case-sensitive membedakan huruf', () => {
  const input = exercise({
    type: 'short_text_exact',
    choices: [],
    correctAnswer: { acceptedAnswers: ['Dua Ribu'], caseSensitive: true },
  });
  assert.equal(evaluateAnswer(input, 'Dua Ribu').correct, true);
  assert.equal(evaluateAnswer(input, 'dua ribu').correct, false);
});

test('short text memakai Unicode normalization tanpa fuzzy AI', () => {
  const input = exercise({
    type: 'short_text_exact',
    choices: [],
    correctAnswer: { acceptedAnswers: ['café'], caseSensitive: false },
  });
  assert.equal(evaluateAnswer(input, 'cafe\u0301').correct, true);
  assert.equal(evaluateAnswer(input, 'kafe').correct, false);
});

test('sequence membandingkan urutan tepat', () => {
  const input = exercise({
    type: 'sequence',
    correctAnswer: ['choice-seribu', 'choice-duaribu', 'choice-limaribu'],
  });
  assert.equal(evaluateAnswer(input, [
    'choice-seribu', 'choice-duaribu', 'choice-limaribu',
  ]).correct, true);
  assert.equal(evaluateAnswer(input, [
    'choice-duaribu', 'choice-seribu', 'choice-limaribu',
  ]).correct, false);
});

test('score basis points memakai half-up integer deterministik', () => {
  assert.equal(calculateScoreBasisPoints(0, 3), 0);
  assert.equal(calculateScoreBasisPoints(1, 3), 3333);
  assert.equal(calculateScoreBasisPoints(2, 3), 6667);
  assert.equal(calculateScoreBasisPoints(1, 6), 1667);
  assert.equal(calculateScoreBasisPoints(3, 4), 7500);
  assert.equal(calculateScoreBasisPoints(4, 4), 10000);
});

test('score menolak division edge invalid', () => {
  assert.throws(() => calculateScoreBasisPoints(1, 0), { code: 'invalid_integer' });
  assert.throws(() => calculateScoreBasisPoints(4, 3), { code: 'invalid_integer' });
  assert.throws(() => calculateScoreBasisPoints(1.5, 3), { code: 'invalid_integer' });
});
