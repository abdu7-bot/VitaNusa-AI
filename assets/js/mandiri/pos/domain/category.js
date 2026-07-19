import { createEntityId } from '../../domain/ids.js';
import {
  assertProductExactFields,
  normalizeBoolean,
  normalizeEntityVersions,
  normalizeProductText,
  normalizeWorkspaceEntityId,
  normalizeWorkspaceScope,
} from './product-validation.js';

const CATEGORY_FIELDS = Object.freeze([
  'schemaVersion',
  'version',
  'categoryId',
  'workspaceId',
  'name',
  'active',
]);
const REQUIRED_CATEGORY_FIELDS = Object.freeze([
  'categoryId',
  'workspaceId',
  'name',
  'active',
]);

export function createCategoryId(cryptoRef = globalThis.crypto) {
  return createEntityId('category', cryptoRef);
}

export function normalizeCategory(input, { workspaceId: expectedWorkspaceId } = {}) {
  assertProductExactFields(input, CATEGORY_FIELDS, {
    requiredFields: REQUIRED_CATEGORY_FIELDS,
    path: 'category',
  });
  const versions = normalizeEntityVersions(input, 'category');
  return Object.freeze({
    schemaVersion: versions.schemaVersion,
    version: versions.version,
    categoryId: normalizeWorkspaceEntityId(input.categoryId, 'category', 'category.categoryId'),
    workspaceId: normalizeWorkspaceScope(
      input.workspaceId,
      expectedWorkspaceId,
      'category.workspaceId',
    ),
    name: normalizeProductText(input.name, { path: 'category.name', maxLength: 80 }),
    active: normalizeBoolean(input.active, 'category.active'),
  });
}

export function validateCategory(input, expectedScope) {
  normalizeCategory(input, expectedScope);
  return true;
}

export function createCategory(input, expectedScope) {
  return normalizeCategory(input, expectedScope);
}
