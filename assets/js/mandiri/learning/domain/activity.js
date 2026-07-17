import { NusaBelajarDomainError } from './learning-errors.js';
import {
  assertLearningExactFields,
  deepFreezeLearningValue,
  normalizeCommonContentFields,
  normalizeContentId,
  normalizePlainText,
} from './learning-validation.js';

export const ACTIVITY_TYPES = Object.freeze([
  'read_example',
  'observe_sequence',
  'match_concept',
]);

const ACTIVITY_FIELDS = Object.freeze([
  'schemaVersion',
  'activityId',
  'lessonId',
  'contentVersion',
  'locale',
  'type',
  'prompt',
  'items',
  'explanation',
  'status',
]);
const REQUIRED_ACTIVITY_FIELDS = Object.freeze(ACTIVITY_FIELDS.filter((field) => field !== 'schemaVersion'));
const ACTIVITY_ITEM_FIELDS = Object.freeze(['itemId', 'label']);

function normalizeActivityItems(value, path) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new NusaBelajarDomainError('invalid_type', 'items harus berupa array biasa', path);
  }
  if (value.length > 20) {
    throw new NusaBelajarDomainError('array_too_long', 'maksimum 20 item', path);
  }
  const items = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    assertLearningExactFields(item, ACTIVITY_ITEM_FIELDS, { path: itemPath });
    return {
      itemId: normalizeContentId(item.itemId, 'item', `${itemPath}.itemId`),
      label: normalizePlainText(item.label, { path: `${itemPath}.label`, maxLength: 240 }),
    };
  });
  const ids = items.map((item) => item.itemId);
  if (new Set(ids).size !== ids.length) {
    throw new NusaBelajarDomainError('duplicate_id', 'itemId activity harus unik', path);
  }
  return items;
}

export function normalizeActivity(input, { path = 'activity' } = {}) {
  assertLearningExactFields(input, ACTIVITY_FIELDS, {
    requiredFields: REQUIRED_ACTIVITY_FIELDS,
    path,
  });
  if (!ACTIVITY_TYPES.includes(input.type)) {
    throw new NusaBelajarDomainError('unknown_activity_type', 'tipe activity tidak dikenal', `${path}.type`);
  }
  const common = normalizeCommonContentFields(input, path);
  const items = normalizeActivityItems(input.items, `${path}.items`);
  if (input.type !== 'read_example' && items.length === 0) {
    throw new NusaBelajarDomainError(
      'activity_items_required',
      'activity interaktif membutuhkan minimal satu item',
      `${path}.items`,
    );
  }
  return deepFreezeLearningValue({
    schemaVersion: common.schemaVersion,
    activityId: normalizeContentId(input.activityId, 'activity', `${path}.activityId`),
    lessonId: normalizeContentId(input.lessonId, 'lesson', `${path}.lessonId`),
    contentVersion: common.contentVersion,
    locale: common.locale,
    type: input.type,
    prompt: normalizePlainText(input.prompt, { path: `${path}.prompt`, maxLength: 600 }),
    items,
    explanation: normalizePlainText(input.explanation, {
      path: `${path}.explanation`,
      maxLength: 800,
    }),
    status: common.status,
  });
}

export function validateActivity(input) {
  normalizeActivity(input);
  return true;
}

export function createActivity(input) {
  return normalizeActivity(input);
}
