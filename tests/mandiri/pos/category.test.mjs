import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCategory,
  createCategoryId,
  validateCategory,
} from '../../../assets/js/mandiri/pos/domain/category.js';

const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = 'category_33333333-3333-4333-8333-333333333333';

function validCategory(overrides = {}) {
  return {
    categoryId: CATEGORY_ID,
    workspaceId: WORKSPACE_A,
    name: 'Makanan Ringan',
    active: true,
    ...overrides,
  };
}

test('category valid dinormalisasi, immutable, dan input tidak dimutasi', () => {
  const input = validCategory({ name: '  Makanan   Ringan  ' });
  const before = structuredClone(input);
  const category = createCategory(input, { workspaceId: WORKSPACE_A });
  assert.deepEqual(input, before);
  assert.deepEqual(category, {
    schemaVersion: 1,
    version: 1,
    categoryId: CATEGORY_ID,
    workspaceId: WORKSPACE_A,
    name: 'Makanan Ringan',
    active: true,
  });
  assert.equal(Object.isFrozen(category), true);
  assert.equal(validateCategory(input), true);
});

test('category menolak unknown field, dangerous key, dan nama invalid', () => {
  assert.throws(() => createCategory(validCategory({ color: 'red' })), { code: 'unknown_field' });
  const dangerous = Object.create(null);
  Object.assign(dangerous, validCategory());
  Object.defineProperty(dangerous, 'constructor', { value: 'unsafe', enumerable: true });
  assert.throws(() => createCategory(dangerous), { code: 'dangerous_key' });
  assert.throws(() => createCategory(validCategory({ name: '   ' })), { code: 'string_too_short' });
  assert.throws(() => createCategory(validCategory({ name: 'x'.repeat(81) })), { code: 'string_too_long' });
  assert.throws(() => createCategory(validCategory({ name: '<b>Makanan</b>' })), { code: 'plain_text_required' });
});

test('category active wajib boolean dan workspace terisolasi', () => {
  assert.equal(createCategory(validCategory({ active: false })).active, false);
  assert.throws(() => createCategory(validCategory({ active: 1 })), { code: 'invalid_boolean' });
  assert.throws(
    () => createCategory(validCategory(), { workspaceId: WORKSPACE_B }),
    { code: 'cross_workspace_scope' },
  );
});

test('category ID memakai helper UUID existing dengan prefix stabil', () => {
  const categoryId = createCategoryId({
    randomUUID: () => '44444444-4444-4444-8444-444444444444',
  });
  assert.equal(categoryId, 'category_44444444-4444-4444-8444-444444444444');
});
