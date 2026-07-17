import { canonicalizePayload } from '../../domain/ids.js';
import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  calculateBasisPointScore,
  deepFreezeLearningValue,
  normalizeContentId,
  normalizeContentVersion,
  normalizeEntityId,
  normalizeIsoTimestamp,
  normalizeLearnerScope,
  normalizePlainText,
  normalizeSafeInteger,
  normalizeSchemaVersion,
} from './learning-validation.js';

export const ATTEMPT_STATUSES = Object.freeze(['in_progress', 'completed', 'abandoned']);

const ATTEMPT_FIELDS = Object.freeze([
  'schemaVersion',
  'attemptId',
  'learnerScope',
  'courseId',
  'moduleId',
  'lessonId',
  'quizId',
  'contentVersion',
  'answers',
  'scoreBasisPoints',
  'correctCount',
  'questionCount',
  'status',
  'startedAtLocal',
  'completedAtLocal',
  'operationId',
]);
const REQUIRED_ATTEMPT_FIELDS = Object.freeze(ATTEMPT_FIELDS.filter((field) => field !== 'schemaVersion'));
const ANSWER_FIELDS = Object.freeze(['exerciseId', 'answer']);

function normalizeStoredAnswerValue(value, path) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === 'string') {
    return normalizePlainText(value, { path, maxLength: 120 });
  }
  if (Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype) {
    if (value.length < 1 || value.length > 20) {
      throw new NusaBelajarDomainError('invalid_answer', 'array jawaban harus memiliki 1–20 item', path);
    }
    const normalized = value.map((item, index) => normalizeContentId(
      item,
      'choice',
      `${path}[${index}]`,
    ));
    if (new Set(normalized).size !== normalized.length) {
      throw new NusaBelajarDomainError('duplicate_answer', 'jawaban tidak boleh duplicate', path);
    }
    return normalized;
  }
  throw new NusaBelajarDomainError(
    'invalid_answer',
    'jawaban tersimpan harus string pendek, safe integer, atau array choiceId',
    path,
  );
}

function normalizeAnswers(value, path, questionCount) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new NusaBelajarDomainError('invalid_type', 'answers harus berupa array biasa', path);
  }
  if (value.length > questionCount) {
    throw new NusaBelajarDomainError('too_many_answers', 'jumlah jawaban melebihi questionCount', path);
  }
  const answers = value.map((answer, index) => {
    const answerPath = `${path}[${index}]`;
    assertLearningExactFields(answer, ANSWER_FIELDS, { path: answerPath });
    return {
      exerciseId: normalizeContentId(answer.exerciseId, 'exercise', `${answerPath}.exerciseId`),
      answer: normalizeStoredAnswerValue(answer.answer, `${answerPath}.answer`),
    };
  });
  const ids = answers.map((answer) => answer.exerciseId);
  if (new Set(ids).size !== ids.length) {
    throw new NusaBelajarDomainError('duplicate_answer', 'satu exercise hanya boleh memiliki satu jawaban', path);
  }
  return answers;
}

export function normalizeAttempt(input, { path = 'attempt' } = {}) {
  assertLearningExactFields(input, ATTEMPT_FIELDS, {
    requiredFields: REQUIRED_ATTEMPT_FIELDS,
    path,
  });
  if (!ATTEMPT_STATUSES.includes(input.status)) {
    throw new NusaBelajarDomainError('unknown_attempt_status', 'status attempt tidak dikenal', `${path}.status`);
  }
  const questionCount = normalizeSafeInteger(input.questionCount, {
    path: `${path}.questionCount`,
    min: 1,
    max: 10000,
  });
  const startedAtLocal = normalizeIsoTimestamp(input.startedAtLocal, `${path}.startedAtLocal`);
  let completedAtLocal = null;
  let correctCount = null;
  let scoreBasisPoints = null;

  if (input.status === 'in_progress') {
    if (
      input.completedAtLocal !== null
      || input.correctCount !== null
      || input.scoreBasisPoints !== null
    ) {
      throw new NusaBelajarDomainError(
        'in_progress_has_final_result',
        'attempt in_progress belum boleh memiliki hasil final',
        path,
      );
    }
  } else if (input.status === 'completed') {
    completedAtLocal = normalizeIsoTimestamp(input.completedAtLocal, `${path}.completedAtLocal`);
    correctCount = normalizeSafeInteger(input.correctCount, {
      path: `${path}.correctCount`,
      min: 0,
      max: questionCount,
    });
    scoreBasisPoints = normalizeSafeInteger(input.scoreBasisPoints, {
      path: `${path}.scoreBasisPoints`,
      min: 0,
      max: 10000,
    });
    const expectedScore = calculateBasisPointScore(correctCount, questionCount, path);
    if (scoreBasisPoints !== expectedScore) {
      throw new NusaBelajarDomainError(
        'score_mismatch',
        'scoreBasisPoints tidak sesuai correctCount dan questionCount',
        `${path}.scoreBasisPoints`,
      );
    }
  } else {
    completedAtLocal = input.completedAtLocal === null
      ? null
      : normalizeIsoTimestamp(input.completedAtLocal, `${path}.completedAtLocal`);
    if (input.correctCount !== null || input.scoreBasisPoints !== null) {
      throw new NusaBelajarDomainError(
        'abandoned_has_final_result',
        'attempt abandoned tidak memiliki hasil final',
        path,
      );
    }
  }

  if (completedAtLocal !== null && completedAtLocal < startedAtLocal) {
    throw new NusaBelajarDomainError(
      'invalid_timestamp_order',
      'completedAtLocal tidak boleh lebih awal dari startedAtLocal',
      `${path}.completedAtLocal`,
    );
  }

  return deepFreezeLearningValue({
    schemaVersion: normalizeSchemaVersion(input.schemaVersion, `${path}.schemaVersion`),
    attemptId: normalizeEntityId(input.attemptId, 'attempt', `${path}.attemptId`),
    learnerScope: normalizeLearnerScope(input.learnerScope, `${path}.learnerScope`),
    courseId: normalizeContentId(input.courseId, 'course', `${path}.courseId`),
    moduleId: normalizeContentId(input.moduleId, 'module', `${path}.moduleId`),
    lessonId: normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`),
    quizId: input.quizId === null
      ? null
      : normalizeContentId(input.quizId, 'quiz', `${path}.quizId`),
    contentVersion: normalizeContentVersion(input.contentVersion, `${path}.contentVersion`),
    answers: normalizeAnswers(input.answers, `${path}.answers`, questionCount),
    scoreBasisPoints,
    correctCount,
    questionCount,
    status: input.status,
    startedAtLocal,
    completedAtLocal,
    operationId: normalizeEntityId(input.operationId, 'op', `${path}.operationId`),
  });
}

export function validateAttempt(input) {
  normalizeAttempt(input);
  return true;
}

export function createAttempt(input) {
  return normalizeAttempt(input);
}

export function assertAttemptTransition(currentInput, nextInput) {
  const current = normalizeAttempt(currentInput, { path: 'currentAttempt' });
  const next = normalizeAttempt(nextInput, { path: 'nextAttempt' });
  if (current.attemptId !== next.attemptId || current.learnerScope !== next.learnerScope) {
    throw new NusaBelajarDomainError('attempt_identity_changed', 'identitas attempt tidak boleh berubah');
  }
  if (current.status !== 'in_progress') {
    if (canonicalizePayload(current) !== canonicalizePayload(next)) {
      throw new NusaBelajarDomainError(
        'attempt_immutable',
        'attempt terminal tidak boleh ditimpa',
        'attempt',
      );
    }
    return true;
  }

  const immutableFields = [
    'schemaVersion',
    'learnerScope',
    'courseId',
    'moduleId',
    'lessonId',
    'quizId',
    'contentVersion',
    'questionCount',
    'startedAtLocal',
    'operationId',
  ];
  for (const field of immutableFields) {
    if (current[field] !== next[field]) {
      throw new NusaBelajarDomainError(
        'attempt_immutable_field',
        `field ${field} tidak boleh berubah`,
        `attempt.${field}`,
      );
    }
  }
  return true;
}
