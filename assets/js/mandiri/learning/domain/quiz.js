import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizeContentStringArray,
  normalizeSafeInteger,
} from './learning-validation.js';

const QUIZ_FIELDS = Object.freeze([
  'schemaVersion',
  'quizId',
  'moduleId',
  'lessonId',
  'contentVersion',
  'locale',
  'exerciseIds',
  'passingThresholdBasisPoints',
  'status',
]);
const REQUIRED_QUIZ_FIELDS = Object.freeze(QUIZ_FIELDS.filter((field) => field !== 'schemaVersion'));

export function normalizeQuiz(input, { path = 'quiz' } = {}) {
  assertLearningExactFields(input, QUIZ_FIELDS, {
    requiredFields: REQUIRED_QUIZ_FIELDS,
    path,
  });
  const hasModule = input.moduleId !== null;
  const hasLesson = input.lessonId !== null;
  if (hasModule === hasLesson) {
    throw new NusaBelajarDomainError(
      'invalid_quiz_scope',
      'quiz harus menunjuk tepat satu moduleId atau lessonId',
      path,
    );
  }
  const common = normalizeCommonContentFields(input, path);
  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    quizId: normalizeContentId(input.quizId, 'quiz', `${path}.quizId`),
    moduleId: hasModule
      ? normalizeContentId(input.moduleId, 'module', `${path}.moduleId`)
      : null,
    lessonId: hasLesson
      ? normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`)
      : null,
    contentVersion: common.contentVersion,
    locale: common.locale,
    exerciseIds: normalizeContentStringArray(input.exerciseIds, {
      path: `${path}.exerciseIds`,
      prefix: 'exercise',
      minItems: 1,
      maxItems: 10000,
    }),
    passingThresholdBasisPoints: normalizeSafeInteger(input.passingThresholdBasisPoints, {
      path: `${path}.passingThresholdBasisPoints`,
      min: 0,
      max: 10000,
    }),
    status: common.status,
  });
}

export function validateQuiz(input) {
  normalizeQuiz(input);
  return true;
}

export function createQuiz(input) {
  return normalizeQuiz(input);
}
