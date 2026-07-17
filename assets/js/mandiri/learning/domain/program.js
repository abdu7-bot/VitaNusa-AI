import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizeContentStringArray,
  normalizePlainText,
} from './learning-validation.js';

const PROGRAM_FIELDS = Object.freeze([
  'schemaVersion',
  'programId',
  'contentVersion',
  'locale',
  'title',
  'summary',
  'courseIds',
  'status',
]);
const REQUIRED_PROGRAM_FIELDS = Object.freeze(PROGRAM_FIELDS.filter((field) => field !== 'schemaVersion'));

export function normalizeProgram(input, { path = 'program' } = {}) {
  assertLearningExactFields(input, PROGRAM_FIELDS, {
    requiredFields: REQUIRED_PROGRAM_FIELDS,
    path,
  });
  const common = normalizeCommonContentFields(input, path);
  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    programId: normalizeContentId(input.programId, 'program', `${path}.programId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    title: normalizePlainText(input.title, { path: `${path}.title`, maxLength: 120 }),
    summary: normalizePlainText(input.summary, { path: `${path}.summary`, maxLength: 320 }),
    courseIds: normalizeContentStringArray(input.courseIds, {
      path: `${path}.courseIds`,
      prefix: 'course',
      minItems: 1,
      maxItems: 100,
    }),
    status: common.status,
  });
}

export function validateProgram(input) {
  normalizeProgram(input);
  return true;
}

export function createProgram(input) {
  return normalizeProgram(input);
}
