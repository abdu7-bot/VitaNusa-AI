import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANDIRI_ALLOWED_STORE_NAMES,
  MANDIRI_DATABASE_NAME,
  MANDIRI_DATABASE_VERSION,
  MANDIRI_FUTURE_STORE_NAMES,
  MANDIRI_SCHEMA_V1,
  MANDIRI_SCHEMA_V2,
} from '../../../assets/js/mandiri/storage/schema.js';

test('nama dan version database Mandiri benar', () => {
  assert.equal(MANDIRI_DATABASE_NAME, 'vitanusa-mandiri');
  assert.equal(MANDIRI_DATABASE_VERSION, 2);
});

test('schema version 2 menambah dua learning store tanpa mengubah schema version 1', () => {
  assert.deepEqual(MANDIRI_ALLOWED_STORE_NAMES, [
    'metadata',
    'workspaces',
    'memberships',
    'auditEvents',
    'operationReceipts',
    'learningAttempts',
    'learningProgress',
  ]);
  assert.equal(Object.keys(MANDIRI_SCHEMA_V1).length, 5);
  for (const futureStore of MANDIRI_FUTURE_STORE_NAMES) {
    assert.equal(Object.hasOwn(MANDIRI_SCHEMA_V2, futureStore), false);
  }
});

test('seluruh primary key mengandung scope yang diwajibkan', () => {
  assert.equal(MANDIRI_SCHEMA_V1.metadata.keyPath, 'key');
  assert.deepEqual(MANDIRI_SCHEMA_V1.workspaces.keyPath, ['accountScope', 'workspaceId']);
  assert.deepEqual(MANDIRI_SCHEMA_V1.memberships.keyPath, [
    'accountScope',
    'workspaceId',
    'membershipId',
  ]);
  assert.deepEqual(MANDIRI_SCHEMA_V1.auditEvents.keyPath, [
    'accountScope',
    'workspaceId',
    'eventId',
  ]);
  assert.deepEqual(MANDIRI_SCHEMA_V1.operationReceipts.keyPath, [
    'accountScope',
    'operationId',
  ]);
  assert.deepEqual(MANDIRI_SCHEMA_V2.learningAttempts.keyPath, ['learnerScope', 'attemptId']);
  assert.deepEqual(MANDIRI_SCHEMA_V2.learningProgress.keyPath, [
    'learnerScope', 'courseId', 'moduleId', 'lessonId',
  ]);
});

test('seluruh index version 1 sesuai kontrak scoped', () => {
  const keyPaths = (store) => Object.fromEntries(
    Object.entries(MANDIRI_SCHEMA_V1[store].indexes)
      .map(([name, definition]) => [name, definition.keyPath]),
  );
  assert.deepEqual(keyPaths('workspaces'), {
    byAccountStatus: ['accountScope', 'status'],
    byAccountUpdatedAt: ['accountScope', 'updatedAtLocal'],
  });
  assert.deepEqual(keyPaths('memberships'), {
    byWorkspace: ['accountScope', 'workspaceId'],
    byWorkspaceStatus: ['accountScope', 'workspaceId', 'status'],
    byUserScope: ['accountScope', 'userScope'],
    byWorkspaceUser: ['accountScope', 'workspaceId', 'userScope'],
  });
  assert.deepEqual(keyPaths('auditEvents'), {
    byWorkspaceCreatedAt: ['accountScope', 'workspaceId', 'createdAtLocal'],
    byOperation: ['accountScope', 'operationId'],
    byEntity: ['accountScope', 'workspaceId', 'entityType', 'entityId'],
  });
  assert.deepEqual(keyPaths('operationReceipts'), {
    byWorkspaceCreatedAt: ['accountScope', 'workspaceId', 'createdAtLocal'],
    byEntity: ['accountScope', 'workspaceId', 'entityType', 'entityId'],
  });
  assert.equal(MANDIRI_SCHEMA_V1.memberships.indexes.byWorkspaceUser.unique, true);
});
