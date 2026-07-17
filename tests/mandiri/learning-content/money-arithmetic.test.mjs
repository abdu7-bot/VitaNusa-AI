import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validateContentPackageGraph } from '../../../assets/js/mandiri/learning/content/content-validator.js';
import {
  calculateScoreBasisPoints,
  evaluateAnswer,
} from '../../../assets/js/mandiri/learning/engine/answer-evaluator.js';

const contentPath = new URL(
  '../../../content/mandiri/learning/packages/money-basics-id-v1/content.json',
  import.meta.url,
);

async function exerciseMap() {
  const raw = JSON.parse(await readFile(contentPath, 'utf8'));
  const graph = validateContentPackageGraph(raw);
  return new Map(graph.exercises.map((exercise) => [exercise.exerciseId, exercise]));
}

function submittedCorrectAnswer(exercise) {
  if (exercise.type === 'short_text_exact') return exercise.correctAnswer.acceptedAnswers[0];
  return structuredClone(exercise.correctAnswer);
}

test('seluruh relasi arithmetic kandidat benar secara integer', () => {
  assert.equal(8000 + 3000, 11000);
  assert.equal(5000 + 7000, 12000);
  assert.equal(4000 + 6000, 10000);
  assert.equal(3000 + 7000, 10000);
  assert.notEqual(5000 + 4000, 10000);
  assert.equal(20000 - 13000, 7000);
  assert.equal(15000 - 10000, 5000);
});

test('evaluator menilai seluruh correct answer package sebagai benar', async () => {
  for (const exercise of (await exerciseMap()).values()) {
    const result = evaluateAnswer(exercise, submittedCorrectAnswer(exercise));
    assert.equal(result.correct, true, exercise.exerciseId);
    assert.equal(result.feedbackCode, 'correct', exercise.exerciseId);
  }
});

test('evaluator menilai jawaban salah yang masuk akal sebagai salah', async () => {
  const exercises = await exerciseMap();
  const cases = [
    ['exercise-read-price-choice-id', 'choice-read-price-6000-id'],
    ['exercise-read-price-number-id', 2000],
    ['exercise-read-currency-text-id', 'rupiah Indonesia'],
    ['exercise-add-prices-number-id', 10000],
    ['exercise-add-prices-choice-id', 'choice-add-price-10000-id'],
    ['exercise-add-prices-multiple-id', ['choice-pair-4000-6000-id']],
    ['exercise-change-first-number-id', 6000],
    ['exercise-change-second-number-id', 4000],
  ];
  for (const [exerciseId, answer] of cases) {
    const result = evaluateAnswer(exercises.get(exerciseId), answer);
    assert.equal(result.correct, false, exerciseId);
    assert.equal(result.feedbackCode, 'try_again', exerciseId);
  }
});

test('multiple choice benar tanpa bergantung urutan', async () => {
  const exercise = (await exerciseMap()).get('exercise-add-prices-multiple-id');
  const reversed = [...exercise.correctAnswer].reverse();
  assert.equal(evaluateAnswer(exercise, reversed).correct, true);
});

test('sequence hanya benar dalam urutan tepat', async () => {
  const exercise = (await exerciseMap()).get('exercise-change-sequence-id');
  assert.equal(evaluateAnswer(exercise, exercise.correctAnswer).correct, true);
  const wrongOrder = [...exercise.correctAnswer];
  [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];
  assert.equal(evaluateAnswer(exercise, wrongOrder).correct, false);
});

test('numeric input menolak decimal dan exponent notation', async () => {
  const exercise = (await exerciseMap()).get('exercise-add-prices-number-id');
  for (const answer of ['11000.0', '11e3', '1.1e4']) {
    const result = evaluateAnswer(exercise, answer);
    assert.equal(result.correct, false);
    assert.equal(result.feedbackCode, 'invalid_answer');
  }
});

test('basis points quiz dihitung deterministik dengan half-up integer', () => {
  assert.equal(calculateScoreBasisPoints(6, 6), 10000);
  assert.equal(calculateScoreBasisPoints(5, 6), 8333);
  assert.equal(calculateScoreBasisPoints(4, 6), 6667);
  assert.equal(calculateScoreBasisPoints(0, 6), 0);
});
