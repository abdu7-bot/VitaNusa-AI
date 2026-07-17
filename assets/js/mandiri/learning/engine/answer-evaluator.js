import { normalizeExercise } from '../domain/exercise.js';
import {
  calculateBasisPointScore,
  deepFreezeLearningValue,
  normalizedContentTextForComparison,
} from '../domain/learning-validation.js';

export const ANSWER_FEEDBACK_CODES = Object.freeze([
  'correct',
  'try_again',
  'review_example',
  'invalid_answer',
]);

function result(correct, normalizedAnswer, expectedAnswerSummary, feedbackCode) {
  return deepFreezeLearningValue({
    correct,
    normalizedAnswer,
    expectedAnswerSummary,
    feedbackCode,
  });
}

function invalid(expectedAnswerSummary) {
  return result(false, null, expectedAnswerSummary, 'invalid_answer');
}

function knownChoiceIds(exercise) {
  return new Set(exercise.choices.map((choice) => choice.choiceId));
}

function normalizeSubmittedChoice(value, choices) {
  return typeof value === 'string' && choices.has(value) ? value : null;
}

function normalizeSubmittedChoiceArray(value, choices) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length === 0) {
    return null;
  }
  if (value.some((item) => typeof item !== 'string' || !choices.has(item))) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value];
}

function normalizeSubmittedInteger(value) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^-?(?:0|[1-9]\d*)$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? (Object.is(parsed, -0) ? 0 : parsed) : null;
}

function expectedSummary(exercise) {
  if (exercise.type === 'single_choice') {
    return { type: exercise.type, choiceId: exercise.correctAnswer };
  }
  if (['multiple_choice', 'sequence'].includes(exercise.type)) {
    return { type: exercise.type, choiceIds: [...exercise.correctAnswer] };
  }
  if (exercise.type === 'numeric_input') {
    return { type: exercise.type, value: exercise.correctAnswer };
  }
  return {
    type: exercise.type,
    acceptedAnswers: [...exercise.correctAnswer.acceptedAnswers],
    caseSensitive: exercise.correctAnswer.caseSensitive,
  };
}

export function evaluateAnswer(exerciseInput, submittedAnswer) {
  const exercise = normalizeExercise(exerciseInput);
  const summary = expectedSummary(exercise);
  const choices = knownChoiceIds(exercise);

  if (exercise.type === 'single_choice') {
    const normalized = normalizeSubmittedChoice(submittedAnswer, choices);
    if (normalized === null) return invalid(summary);
    const correct = normalized === exercise.correctAnswer;
    return result(correct, normalized, summary, correct ? 'correct' : 'try_again');
  }

  if (exercise.type === 'multiple_choice') {
    const normalized = normalizeSubmittedChoiceArray(submittedAnswer, choices);
    if (normalized === null) return invalid(summary);
    const submittedSet = new Set(normalized);
    const correct = submittedSet.size === exercise.correctAnswer.length
      && exercise.correctAnswer.every((choiceId) => submittedSet.has(choiceId));
    return result(correct, normalized, summary, correct ? 'correct' : 'try_again');
  }

  if (exercise.type === 'numeric_input') {
    const normalized = normalizeSubmittedInteger(submittedAnswer);
    if (normalized === null) return invalid(summary);
    const correct = normalized === exercise.correctAnswer;
    return result(correct, normalized, summary, correct ? 'correct' : 'try_again');
  }

  if (exercise.type === 'short_text_exact') {
    if (typeof submittedAnswer !== 'string' || submittedAnswer.length > 120) return invalid(summary);
    const normalized = normalizedContentTextForComparison(submittedAnswer, {
      caseSensitive: exercise.correctAnswer.caseSensitive,
    });
    if (!normalized) return invalid(summary);
    const expected = exercise.correctAnswer.acceptedAnswers.map((answer) => (
      normalizedContentTextForComparison(answer, {
        caseSensitive: exercise.correctAnswer.caseSensitive,
      })
    ));
    const correct = expected.includes(normalized);
    return result(correct, normalized, summary, correct ? 'correct' : 'try_again');
  }

  const normalized = normalizeSubmittedChoiceArray(submittedAnswer, choices);
  if (normalized === null || normalized.length !== exercise.correctAnswer.length) return invalid(summary);
  const correct = normalized.every((choiceId, index) => choiceId === exercise.correctAnswer[index]);
  return result(correct, normalized, summary, correct ? 'correct' : 'try_again');
}

export function calculateScoreBasisPoints(correctCount, questionCount) {
  return calculateBasisPointScore(correctCount, questionCount, 'score');
}
