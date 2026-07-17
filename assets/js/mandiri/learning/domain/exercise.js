import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizePlainText,
  normalizeSafeInteger,
  normalizedContentTextForComparison,
} from './learning-validation.js';

export const EXERCISE_TYPES = Object.freeze([
  'single_choice',
  'multiple_choice',
  'numeric_input',
  'short_text_exact',
  'sequence',
]);

const EXERCISE_FIELDS = Object.freeze([
  'schemaVersion',
  'exerciseId',
  'lessonId',
  'contentVersion',
  'locale',
  'type',
  'prompt',
  'choices',
  'correctAnswer',
  'explanation',
  'maxAttempts',
  'status',
]);
const REQUIRED_EXERCISE_FIELDS = Object.freeze(EXERCISE_FIELDS.filter((field) => field !== 'schemaVersion'));
const CHOICE_FIELDS = Object.freeze(['choiceId', 'label']);
const SHORT_TEXT_ANSWER_FIELDS = Object.freeze(['acceptedAnswers', 'caseSensitive']);

function normalizeChoices(value, path) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new NusaBelajarDomainError('invalid_type', 'choices harus berupa array biasa', path);
  }
  if (value.length > 20) {
    throw new NusaBelajarDomainError('array_too_long', 'maksimum 20 choice', path);
  }
  const choices = value.map((choice, index) => {
    const choicePath = `${path}[${index}]`;
    assertLearningExactFields(choice, CHOICE_FIELDS, { path: choicePath });
    return {
      choiceId: normalizeContentId(choice.choiceId, 'choice', `${choicePath}.choiceId`),
      label: normalizePlainText(choice.label, { path: `${choicePath}.label`, maxLength: 240 }),
    };
  });
  const ids = choices.map((choice) => choice.choiceId);
  if (new Set(ids).size !== ids.length) {
    throw new NusaBelajarDomainError('duplicate_choice', 'choiceId harus unik', path);
  }
  return choices;
}

function normalizeChoiceIds(value, choiceIds, path, { requireAll = false } = {}) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length === 0) {
    throw new NusaBelajarDomainError('invalid_correct_answer', 'jawaban harus array ID non-kosong', path);
  }
  const normalized = value.map((item, index) => normalizeContentId(item, 'choice', `${path}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new NusaBelajarDomainError('duplicate_correct_answer', 'jawaban benar tidak boleh duplicate', path);
  }
  for (const choiceId of normalized) {
    if (!choiceIds.has(choiceId)) {
      throw new NusaBelajarDomainError('missing_correct_choice', 'jawaban mengacu choice yang tidak tersedia', path);
    }
  }
  if (requireAll && normalized.length !== choiceIds.size) {
    throw new NusaBelajarDomainError('invalid_sequence_answer', 'sequence harus memuat seluruh choice tepat sekali', path);
  }
  return normalized;
}

function normalizeShortTextAnswer(value, path) {
  assertLearningExactFields(value, SHORT_TEXT_ANSWER_FIELDS, { path });
  if (typeof value.caseSensitive !== 'boolean') {
    throw new NusaBelajarDomainError('invalid_type', 'caseSensitive harus boolean', `${path}.caseSensitive`);
  }
  if (!Array.isArray(value.acceptedAnswers) || value.acceptedAnswers.length < 1 || value.acceptedAnswers.length > 20) {
    throw new NusaBelajarDomainError(
      'invalid_accepted_answers',
      'acceptedAnswers harus memiliki 1–20 jawaban',
      `${path}.acceptedAnswers`,
    );
  }
  const acceptedAnswers = value.acceptedAnswers.map((answer, index) => normalizePlainText(answer, {
    path: `${path}.acceptedAnswers[${index}]`,
    maxLength: 120,
  }));
  const comparisonValues = acceptedAnswers.map((answer) => normalizedContentTextForComparison(answer, {
    caseSensitive: value.caseSensitive,
  }));
  if (new Set(comparisonValues).size !== comparisonValues.length) {
    throw new NusaBelajarDomainError(
      'duplicate_correct_answer',
      'acceptedAnswers harus unik setelah normalisasi',
      `${path}.acceptedAnswers`,
    );
  }
  return { acceptedAnswers, caseSensitive: value.caseSensitive };
}

function normalizeCorrectAnswer(type, value, choices, path) {
  const choiceIds = new Set(choices.map((choice) => choice.choiceId));
  if (type === 'single_choice') {
    const choiceId = normalizeContentId(value, 'choice', path);
    if (!choiceIds.has(choiceId)) {
      throw new NusaBelajarDomainError('missing_correct_choice', 'choice jawaban benar tidak tersedia', path);
    }
    return choiceId;
  }
  if (type === 'multiple_choice') {
    return normalizeChoiceIds(value, choiceIds, path);
  }
  if (type === 'numeric_input') {
    return normalizeSafeInteger(value, { path });
  }
  if (type === 'short_text_exact') {
    return normalizeShortTextAnswer(value, path);
  }
  return normalizeChoiceIds(value, choiceIds, path, { requireAll: true });
}

export function normalizeExercise(input, { path = 'exercise' } = {}) {
  assertLearningExactFields(input, EXERCISE_FIELDS, {
    requiredFields: REQUIRED_EXERCISE_FIELDS,
    path,
  });
  if (!EXERCISE_TYPES.includes(input.type)) {
    throw new NusaBelajarDomainError('unknown_exercise_type', 'tipe exercise tidak dikenal', `${path}.type`);
  }
  const common = normalizeCommonContentFields(input, path);
  const choices = normalizeChoices(input.choices, `${path}.choices`);
  const choiceBased = ['single_choice', 'multiple_choice', 'sequence'].includes(input.type);
  if (choiceBased && choices.length < 2) {
    throw new NusaBelajarDomainError('choices_required', 'exercise ini membutuhkan minimal dua choice', `${path}.choices`);
  }
  if (!choiceBased && choices.length !== 0) {
    throw new NusaBelajarDomainError('choices_forbidden', 'exercise ini harus memakai choices kosong', `${path}.choices`);
  }
  const maxAttempts = input.maxAttempts === null
    ? null
    : normalizeSafeInteger(input.maxAttempts, { path: `${path}.maxAttempts`, min: 1, max: 10 });

  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    exerciseId: normalizeContentId(input.exerciseId, 'exercise', `${path}.exerciseId`),
    lessonId: normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    type: input.type,
    prompt: normalizePlainText(input.prompt, { path: `${path}.prompt`, maxLength: 600 }),
    choices,
    correctAnswer: normalizeCorrectAnswer(input.type, input.correctAnswer, choices, `${path}.correctAnswer`),
    explanation: normalizePlainText(input.explanation, {
      path: `${path}.explanation`,
      maxLength: 800,
    }),
    maxAttempts,
    status: common.status,
  });
}

export function validateExercise(input) {
  normalizeExercise(input);
  return true;
}

export function createExercise(input) {
  return normalizeExercise(input);
}
