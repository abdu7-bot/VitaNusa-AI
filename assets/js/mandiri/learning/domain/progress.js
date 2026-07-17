import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeContentId,
  normalizeContentVersion,
  normalizeEntityId,
  normalizeIsoTimestamp,
  normalizeLearnerScope,
  normalizeSafeInteger,
  normalizeSchemaVersion,
} from './learning-validation.js';

export const PROGRESS_STATES = Object.freeze([
  'not_started',
  'in_progress',
  'needs_practice',
  'mastered_this_practice',
]);

export const PROGRESS_STATE_LABELS = Object.freeze({
  not_started: 'Belum dicoba',
  in_progress: 'Sedang dipelajari',
  needs_practice: 'Perlu latihan',
  mastered_this_practice: 'Sudah dikuasai pada latihan ini',
});

const PROGRESS_FIELDS = Object.freeze([
  'schemaVersion',
  'learnerScope',
  'courseId',
  'moduleId',
  'lessonId',
  'contentVersion',
  'state',
  'bestScoreBasisPoints',
  'lastAttemptId',
  'attemptCount',
  'lastPracticedAtLocal',
]);
const REQUIRED_PROGRESS_FIELDS = Object.freeze(PROGRESS_FIELDS.filter((field) => field !== 'schemaVersion'));

export function normalizeProgress(input, { path = 'progress' } = {}) {
  assertLearningExactFields(input, PROGRESS_FIELDS, {
    requiredFields: REQUIRED_PROGRESS_FIELDS,
    path,
  });
  if (!PROGRESS_STATES.includes(input.state)) {
    throw new NusaBelajarDomainError('unknown_progress_state', 'state progress tidak dikenal', `${path}.state`);
  }
  const bestScoreBasisPoints = input.bestScoreBasisPoints === null
    ? null
    : normalizeSafeInteger(input.bestScoreBasisPoints, {
      path: `${path}.bestScoreBasisPoints`,
      min: 0,
      max: 10000,
    });
  const lastAttemptId = input.lastAttemptId === null
    ? null
    : normalizeEntityId(input.lastAttemptId, 'attempt', `${path}.lastAttemptId`);
  const lastPracticedAtLocal = input.lastPracticedAtLocal === null
    ? null
    : normalizeIsoTimestamp(input.lastPracticedAtLocal, `${path}.lastPracticedAtLocal`);
  const attemptCount = normalizeSafeInteger(input.attemptCount, {
    path: `${path}.attemptCount`,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  if (input.state === 'not_started' && (
    bestScoreBasisPoints !== null
    || lastAttemptId !== null
    || lastPracticedAtLocal !== null
    || attemptCount !== 0
  )) {
    throw new NusaBelajarDomainError(
      'not_started_has_attempt_data',
      'progress not_started belum boleh memiliki data attempt',
      path,
    );
  }

  return deepFreezeLearningValue({
    schemaVersion: normalizeSchemaVersion(input.schemaVersion, `${path}.schemaVersion`),
    learnerScope: normalizeLearnerScope(input.learnerScope, `${path}.learnerScope`),
    courseId: normalizeContentId(input.courseId, 'course', `${path}.courseId`),
    moduleId: normalizeContentId(input.moduleId, 'module', `${path}.moduleId`),
    lessonId: normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`),
    contentVersion: normalizeContentVersion(input.contentVersion, `${path}.contentVersion`),
    state: input.state,
    bestScoreBasisPoints,
    lastAttemptId,
    attemptCount,
    lastPracticedAtLocal,
  });
}

export function validateProgress(input) {
  normalizeProgress(input);
  return true;
}

export function createProgress(input) {
  return normalizeProgress(input);
}
