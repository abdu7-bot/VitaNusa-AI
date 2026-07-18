import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createInitialSequenceOrder,
  moveSequenceItem,
  renderLearningExercise,
} from '../../../assets/js/mandiri/learning/ui/exercise-renderer.js';
import { getLearningFeedbackMessage } from '../../../assets/js/mandiri/learning/ui/feedback-messages.js';
import { FakeDocument, collectText, findAll, repositoryRoot } from './fixtures.mjs';

function exercise(type) {
  const choices = ['single_choice', 'multiple_choice', 'sequence'].includes(type)
    ? [
      { choiceId: 'choice-a-id', label: 'Pilihan A' },
      { choiceId: 'choice-b-id', label: 'Pilihan B' },
      { choiceId: 'choice-c-id', label: 'Pilihan C' },
    ]
    : [];
  return {
    exerciseId: `exercise-${type.replaceAll('_', '-')}-id`,
    type,
    prompt: `Prompt ${type}`,
    choices,
    maxAttempts: null,
  };
}

for (const [type, inputType] of [
  ['single_choice', 'radio'],
  ['multiple_choice', 'checkbox'],
  ['numeric_input', 'text'],
  ['short_text_exact', 'text'],
]) {
  test(`${type} menyediakan control semantik dan aria-live`, () => {
    const controller = renderLearningExercise(new FakeDocument(), exercise(type), {
      evaluateExercise: async () => ({
        correct: false,
        feedbackCode: 'try_again',
        explanation: 'Periksa kembali.',
        submissionCount: 1,
        attemptsRemaining: null,
      }),
    });
    const fieldsets = findAll(controller.element, (node) => node.tagName === 'FIELDSET');
    const legends = findAll(controller.element, (node) => node.tagName === 'LEGEND');
    const inputs = findAll(controller.element, (node) => node.tagName === 'INPUT');
    assert.equal(fieldsets.length, 1);
    assert.equal(legends.length, 1);
    assert.ok(inputs.length >= 1);
    assert.ok(inputs.every((input) => input.type === inputType));
    assert.equal(
      findAll(controller.element, (node) => node.getAttribute?.('aria-live') === 'polite').length,
      1,
    );
  });
}

test('numeric input memberi petunjuk controlled integer', () => {
  const controller = renderLearningExercise(new FakeDocument(), exercise('numeric_input'), {
    evaluateExercise: async () => ({}),
  });
  assert.match(collectText(controller.element), /tanpa tanda Rp dan tanpa titik/u);
  const input = findAll(controller.element, (node) => node.tagName === 'INPUT')[0];
  assert.equal(input.inputMode, 'numeric');
  assert.equal(input.autocomplete, 'off');
});

test('submit memakai evaluator, feedback ramah, dan explanation plain text', async () => {
  let received = null;
  const controller = renderLearningExercise(new FakeDocument(), exercise('single_choice'), {
    async evaluateExercise(exerciseId, answer, options) {
      received = { exerciseId, answer, options };
      return {
        correct: true,
        feedbackCode: 'correct',
        explanation: '<b>Penjelasan aman</b>',
        submissionCount: 1,
        attemptsRemaining: null,
      };
    },
  });
  const input = findAll(controller.element, (node) => node.tagName === 'INPUT')[1];
  input.checked = true;
  const form = findAll(controller.element, (node) => node.tagName === 'FORM')[0];
  await form.dispatch('submit');
  assert.deepEqual(received.answer, 'choice-b-id');
  assert.match(collectText(controller.element), /Jawaban tepat\. Mari lanjutkan\./u);
  assert.match(collectText(controller.element), /<b>Penjelasan aman<\/b>/u);
  assert.equal(findAll(controller.element, (node) => node.tagName === 'B').length, 0);
  assert.equal(controller.getSession().status, 'correct');
});

test('multiple choice membaca semua checked choice tanpa duplicate DOM', async () => {
  let answer;
  const controller = renderLearningExercise(new FakeDocument(), exercise('multiple_choice'), {
    async evaluateExercise(_id, value) {
      answer = value;
      return {
        correct: false,
        feedbackCode: 'try_again',
        explanation: 'Coba lagi.',
        submissionCount: 1,
        attemptsRemaining: null,
      };
    },
  });
  const inputs = findAll(controller.element, (node) => node.tagName === 'INPUT');
  inputs[0].checked = true;
  inputs[2].checked = true;
  await findAll(controller.element, (node) => node.tagName === 'FORM')[0].dispatch('submit');
  assert.deepEqual(answer, ['choice-a-id', 'choice-c-id']);
});

test('sequence memakai tombol Naik/Turun, aria-live, dan urutan deterministik', async () => {
  const publicExercise = exercise('sequence');
  const initial = createInitialSequenceOrder(publicExercise);
  assert.deepEqual(initial, ['choice-a-id', 'choice-b-id', 'choice-c-id']);
  assert.deepEqual(moveSequenceItem(initial, 1, -1), [
    'choice-b-id', 'choice-a-id', 'choice-c-id',
  ]);
  const controller = renderLearningExercise(new FakeDocument(), publicExercise, {
    evaluateExercise: async () => ({
      correct: false,
      feedbackCode: 'try_again',
      explanation: 'Urutan diperiksa.',
      submissionCount: 1,
      attemptsRemaining: null,
    }),
  });
  const buttons = findAll(controller.element, (node) => node.tagName === 'BUTTON');
  assert.ok(buttons.some((button) => button.textContent === 'Naik'));
  assert.ok(buttons.some((button) => button.textContent === 'Turun'));
  const firstUp = buttons.find((button) => button.textContent === 'Naik');
  assert.equal(firstUp.disabled, true);
  const live = findAll(controller.element, (node) => node.getAttribute?.('aria-live') === 'polite');
  assert.ok(live.length >= 2);
});

for (const code of ['correct', 'try_again', 'review_example', 'invalid_answer']) {
  test(`feedback ${code} ramah dan tidak merendahkan`, () => {
    const message = getLearningFeedbackMessage(code);
    assert.ok(message.length > 0);
    assert.doesNotMatch(message, /gagal|bodoh|tidak mampu|nilai buruk/iu);
  });
}

test('renderer tidak membocorkan correctAnswer atau memakai storage/network/render HTML', async () => {
  const source = await readFile(
    new URL('assets/js/mandiri/learning/ui/exercise-renderer.js', repositoryRoot),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /correctAnswer|innerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|fetch\s*\(|console\.log/u,
  );
});
