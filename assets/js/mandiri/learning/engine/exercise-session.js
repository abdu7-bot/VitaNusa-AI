import {
  deepFreezeLearningValue,
  normalizeContentId,
  normalizeSafeInteger,
} from '../domain/learning-validation.js';

export const EXERCISE_SESSION_STATES = Object.freeze([
  'idle',
  'answering',
  'invalid',
  'incorrect',
  'correct',
  'limit_reached',
]);

function normalizeMaxAttempts(value) {
  return value === null
    ? null
    : normalizeSafeInteger(value, { path: 'maxAttempts', min: 1, max: 10 });
}

function normalizeAnswer(value) {
  if (value === null || typeof value === 'string' || Number.isSafeInteger(value)) return value;
  if (
    Array.isArray(value)
    && Object.getPrototypeOf(value) === Array.prototype
    && value.length <= 20
    && value.every((item) => typeof item === 'string')
  ) {
    return [...value];
  }
  throw new TypeError('Jawaban session harus berupa data terstruktur sederhana.');
}

function createState(input) {
  return deepFreezeLearningValue({
    exerciseId: input.exerciseId,
    status: input.status,
    answer: normalizeAnswer(input.answer),
    submissionCount: input.submissionCount,
    maxAttempts: input.maxAttempts,
    attemptsRemaining: input.attemptsRemaining,
    feedbackCode: input.feedbackCode,
    explanation: input.explanation,
    lastEvaluation: input.lastEvaluation,
  });
}

export function createExerciseSession({ exerciseId, maxAttempts = null } = {}) {
  const normalizedMax = normalizeMaxAttempts(maxAttempts);
  return createState({
    exerciseId: normalizeContentId(exerciseId, 'exercise', 'exerciseId'),
    status: 'idle',
    answer: null,
    submissionCount: 0,
    maxAttempts: normalizedMax,
    attemptsRemaining: normalizedMax,
    feedbackCode: null,
    explanation: null,
    lastEvaluation: null,
  });
}

export function updateExerciseSessionAnswer(state, answer) {
  if (!state || ['correct', 'limit_reached'].includes(state.status)) return state;
  return createState({
    ...state,
    status: 'answering',
    answer,
    feedbackCode: null,
    explanation: null,
    lastEvaluation: null,
  });
}

export function submitExerciseSession(state, evaluation) {
  if (!state || ['correct', 'limit_reached'].includes(state.status)) return state;
  if (
    !evaluation
    || typeof evaluation.correct !== 'boolean'
    || !['correct', 'try_again', 'review_example', 'invalid_answer'].includes(
      evaluation.feedbackCode,
    )
    || !Number.isSafeInteger(evaluation.submissionCount)
    || evaluation.submissionCount < state.submissionCount
    || !(
      evaluation.attemptsRemaining === null
      || (Number.isSafeInteger(evaluation.attemptsRemaining)
        && evaluation.attemptsRemaining >= 0)
    )
  ) {
    throw new TypeError('Hasil evaluasi session tidak valid.');
  }

  let status = evaluation.correct ? 'correct' : 'incorrect';
  if (evaluation.feedbackCode === 'invalid_answer') status = 'invalid';
  if (!evaluation.correct && evaluation.attemptsRemaining === 0) status = 'limit_reached';
  const safeEvaluation = Object.freeze({
    correct: evaluation.correct,
    feedbackCode: evaluation.feedbackCode,
    submissionCount: evaluation.submissionCount,
    attemptsRemaining: evaluation.attemptsRemaining,
  });

  return createState({
    ...state,
    status,
    submissionCount: evaluation.submissionCount,
    attemptsRemaining: evaluation.attemptsRemaining,
    feedbackCode: evaluation.feedbackCode,
    explanation: typeof evaluation.explanation === 'string'
      ? evaluation.explanation
      : null,
    lastEvaluation: safeEvaluation,
  });
}

export function resetExerciseSession(state) {
  return createExerciseSession({
    exerciseId: state.exerciseId,
    maxAttempts: state.maxAttempts,
  });
}
