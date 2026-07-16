import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANDIRI_ALLOWED_STORE_NAMES,
  MANDIRI_DATABASE_NAME,
  MANDIRI_DATABASE_VERSION,
  MANDIRI_FUTURE_STORE_NAMES,
  MANDIRI_SCHEMA_V1,
} from '../../../assets/js/mandiri/storage/schema.js';

test('nama dan version database Mandiri benar', () => {
  assert.equal(MANDIRI_DATABASE_NAME, 'vitanusa-mandiri');
  assert.equal(MANDIRI_DATABASE_VERSION, 1);
});

test('schema version 1 hanya mempunyai lima object store', () => {
  assert.deepEqual(MANDIRI_ALLOWED_STORE_NAMES, [
    'metadata',
    'workspaces',
    'memberships',
    'auditEvents',
    'operationReceipts',
  ]);
  for (const futureStore of MANDIRI_FUTURE_STORE_NAMES) {
    assert.equal(Object.hasOwn(MANDIRI_SCHEMA_V1, futureStore), false);
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
