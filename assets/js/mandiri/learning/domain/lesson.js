import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizeContentStringArray,
  normalizePlainText,
  normalizeSafeInteger,
} from './learning-validation.js';

export const LESSON_BLOCK_TYPES = Object.freeze([
  'heading',
  'paragraph',
  'example',
  'tip',
  'warning',
  'simple_list',
]);

const LESSON_FIELDS = Object.freeze([
  'schemaVersion',
  'lessonId',
  'moduleId',
  'contentVersion',
  'locale',
  'title',
  'summary',
  'learningObjective',
  'estimatedMinutes',
  'blocks',
  'activityIds',
  'exerciseIds',
  'quizId',
  'status',
]);
const REQUIRED_LESSON_FIELDS = Object.freeze(LESSON_FIELDS.filter((field) => field !== 'schemaVersion'));
const BLOCK_FIELDS = Object.freeze(['blockId', 'type', 'text', 'items']);

function normalizeListItems(value, path) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new NusaBelajarDomainError('invalid_type', 'items harus berupa array biasa', path);
  }
  if (value.length < 1 || value.length > 20) {
    throw new NusaBelajarDomainError('invalid_list_size', 'simple_list harus memiliki 1–20 item', path);
  }
  return value.map((item, index) => normalizePlainText(item, {
    path: `${path}[${index}]`,
    maxLength: 240,
  }));
}

export function normalizeLessonBlock(input, { path = 'lessonBlock' } = {}) {
  assertLearningExactFields(input, BLOCK_FIELDS, { path });
  if (!LESSON_BLOCK_TYPES.includes(input.type)) {
    throw new NusaBelajarDomainError('unknown_block_type', 'tipe blok lesson tidak dikenal', `${path}.type`);
  }

  const blockId = normalizeContentId(input.blockId, 'block', `${path}.blockId`);
  if (input.type === 'simple_list') {
    if (input.text !== null) {
      throw new NusaBelajarDomainError(
        'invalid_block_shape',
        'simple_list memakai items dan text harus null',
        `${path}.text`,
      );
    }
    return deepFreezeLearningValue({
      blockId,
      type: input.type,
      text: null,
      items: normalizeListItems(input.items, `${path}.items`),
    });
  }

  if (!Array.isArray(input.items) || input.items.length !== 0) {
    throw new NusaBelajarDomainError(
      'invalid_block_shape',
      'blok selain simple_list harus memakai items kosong',
      `${path}.items`,
    );
  }
  return deepFreezeLearningValue({
    blockId,
    type: input.type,
    text: normalizePlainText(input.text, { path: `${path}.text`, maxLength: 1200 }),
    items: [],
  });
}

function normalizeBlocks(value, path) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new NusaBelajarDomainError('invalid_type', 'blocks harus berupa array biasa', path);
  }
  if (value.length < 1 || value.length > 50) {
    throw new NusaBelajarDomainError('invalid_block_count', 'lesson harus memiliki 1–50 blok', path);
  }
  const blocks = value.map((block, index) => normalizeLessonBlock(block, {
    path: `${path}[${index}]`,
  }));
  const blockIds = blocks.map((block) => block.blockId);
  if (new Set(blockIds).size !== blockIds.length) {
    throw new NusaBelajarDomainError('duplicate_id', 'blockId dalam lesson harus unik', path);
  }
  return blocks;
}

export function normalizeLesson(input, { path = 'lesson' } = {}) {
  assertLearningExactFields(input, LESSON_FIELDS, {
    requiredFields: REQUIRED_LESSON_FIELDS,
    path,
  });
  const common = normalizeCommonContentFields(input, path);
  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    lessonId: normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`),
    moduleId: normalizeContentId(input.moduleId, 'module', `${path}.moduleId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    title: normalizePlainText(input.title, { path: `${path}.title`, maxLength: 120 }),
    summary: normalizePlainText(input.summary, { path: `${path}.summary`, maxLength: 320 }),
    learningObjective: normalizePlainText(input.learningObjective, {
      path: `${path}.learningObjective`,
      maxLength: 240,
    }),
    estimatedMinutes: normalizeSafeInteger(input.estimatedMinutes, {
      path: `${path}.estimatedMinutes`,
      min: 1,
      max: 60,
    }),
    blocks: normalizeBlocks(input.blocks, `${path}.blocks`),
    activityIds: normalizeContentStringArray(input.activityIds, {
      path: `${path}.activityIds`,
      prefix: 'activity',
      maxItems: 5000,
    }),
    exerciseIds: normalizeContentStringArray(input.exerciseIds, {
      path: `${path}.exerciseIds`,
      prefix: 'exercise',
      maxItems: 10000,
    }),
    quizId: input.quizId === null
      ? null
      : normalizeContentId(input.quizId, 'quiz', `${path}.quizId`),
    status: common.status,
  });
}

export function validateLesson(input) {
  normalizeLesson(input);
  return true;
}

export function createLesson(input) {
  return normalizeLesson(input);
}
