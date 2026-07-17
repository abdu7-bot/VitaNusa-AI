import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizeContentStringArray,
  normalizePlainText,
} from './learning-validation.js';

const COURSE_FIELDS = Object.freeze([
  'schemaVersion',
  'courseId',
  'programId',
  'contentVersion',
  'locale',
  'title',
  'summary',
  'learningObjective',
  'moduleIds',
  'prerequisiteCourseIds',
  'status',
]);
const REQUIRED_COURSE_FIELDS = Object.freeze(COURSE_FIELDS.filter((field) => field !== 'schemaVersion'));

export function normalizeCourse(input, { path = 'course' } = {}) {
  assertLearningExactFields(input, COURSE_FIELDS, {
    requiredFields: REQUIRED_COURSE_FIELDS,
    path,
  });
  const common = normalizeCommonContentFields(input, path);
  const courseId = normalizeContentId(input.courseId, 'course', `${path}.courseId`);
  const prerequisiteCourseIds = normalizeContentStringArray(input.prerequisiteCourseIds, {
    path: `${path}.prerequisiteCourseIds`,
    prefix: 'course',
    maxItems: 100,
  });
  if (prerequisiteCourseIds.includes(courseId)) {
    throw new NusaBelajarDomainError(
      'self_prerequisite',
      'course tidak boleh menjadi prerequisite dirinya sendiri',
      `${path}.prerequisiteCourseIds`,
    );
  }

  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    courseId,
    programId: normalizeContentId(input.programId, 'program', `${path}.programId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    title: normalizePlainText(input.title, { path: `${path}.title`, maxLength: 120 }),
    summary: normalizePlainText(input.summary, { path: `${path}.summary`, maxLength: 320 }),
    learningObjective: normalizePlainText(input.learningObjective, {
      path: `${path}.learningObjective`,
      maxLength: 240,
    }),
    moduleIds: normalizeContentStringArray(input.moduleIds, {
      path: `${path}.moduleIds`,
      prefix: 'module',
      minItems: 1,
      maxItems: 500,
    }),
    prerequisiteCourseIds,
    status: common.status,
  });
}

export function validateCourse(input) {
  normalizeCourse(input);
  return true;
}

export function createCourse(input) {
  return normalizeCourse(input);
}
