import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizeContentStringArray,
  normalizePlainText,
} from './learning-validation.js';

const MODULE_FIELDS = Object.freeze([
  'schemaVersion',
  'moduleId',
  'courseId',
  'contentVersion',
  'locale',
  'title',
  'summary',
  'learningObjective',
  'lessonIds',
  'status',
]);
const REQUIRED_MODULE_FIELDS = Object.freeze(MODULE_FIELDS.filter((field) => field !== 'schemaVersion'));

export function normalizeModule(input, { path = 'module' } = {}) {
  assertLearningExactFields(input, MODULE_FIELDS, {
    requiredFields: REQUIRED_MODULE_FIELDS,
    path,
  });
  const common = normalizeCommonContentFields(input, path);
  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    moduleId: normalizeContentId(input.moduleId, 'module', `${path}.moduleId`),
    courseId: normalizeContentId(input.courseId, 'course', `${path}.courseId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    title: normalizePlainText(input.title, { path: `${path}.title`, maxLength: 120 }),
    summary: normalizePlainText(input.summary, { path: `${path}.summary`, maxLength: 320 }),
    learningObjective: normalizePlainText(input.learningObjective, {
      path: `${path}.learningObjective`,
      maxLength: 240,
    }),
    lessonIds: normalizeContentStringArray(input.lessonIds, {
      path: `${path}.lessonIds`,
      prefix: 'lesson',
      minItems: 1,
      maxItems: 2000,
    }),
    status: common.status,
  });
}

export function validateModule(input) {
  normalizeModule(input);
  return true;
}

export function createModule(input) {
  return normalizeModule(input);
}
