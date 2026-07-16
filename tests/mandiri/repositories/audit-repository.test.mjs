import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createAuditRepository } from '../../../assets/js/mandiri/repositories/audit-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const EVENT_A = 'audit_33333333-3333-4333-8333-333333333333';
const EVENT_B = 'audit_44444444-4444-4444-8444-444444444444';
const OPERATION_ID = 'op_55555555-5555-4555-8555-555555555555';

function audit(overrides = {}) {
  return {
    eventId: EVENT_A,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    actorScope: 'user_scope_owner',
    actorRole: 'merchant_owner',
    action: 'workspace.created',
    entityType: 'workspace',
    entityId: WORKSPACE_A,
    operationId: OPERATION_ID,
    result: 'success',
    reasonCode: 'none',
    createdAtLocal: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

async function fixture(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return { connection, repository: createAuditRepository({ connection }) };
}

test('audit event dapat di-append dan dibaca', async () => {
  const { connection, repository } = await fixture('audit-append-read');
  const added = await repository.append(ACCOUNT_A, WORKSPACE_A, audit());
  assert.deepEqual(await repository.getById(ACCOUNT_A, WORKSPACE_A, EVENT_A), added);
  connection.close();
});

test('list workspace dan operation ter-scope serta terbaru lebih dahulu', async () => {
  const { connection, repository } = await fixture('audit-lists');
  await repository.append(ACCOUNT_A, WORKSPACE_A, audit());
  await repository.append(ACCOUNT_A, WORKSPACE_A, audit({
    eventId: EVENT_B,
    createdAtLocal: '2026-07-16T01:00:00.000Z',
  }));
  const workspaceEvents = await repository.listByWorkspace(ACCOUNT_A, WORKSPACE_A, { limit: 1 });
  assert.deepEqual(workspaceEvents.map((record) => record.eventId), [EVENT_B]);
  const before = await repository.listByWorkspace(ACCOUNT_A, WORKSPACE_A, {
    beforeCreatedAt: '2026-07-16T01:00:00.000Z',
  });
  assert.deepEqual(before.map((record) => record.eventId), [EVENT_A]);
  assert.deepEqual(
    (await repository.listByOperation(ACCOUNT_A, OPERATION_ID)).map((record) => record.eventId),
    [EVENT_B, EVENT_A],
  );
  connection.close();
});

test('cross-account dan cross-workspace audit tidak terlihat', async () => {
  const { connection, repository } = await fixture('audit-isolation');
  await repository.append(ACCOUNT_A, WORKSPACE_A, audit());
  assert.equal(await repository.getById(ACCOUNT_B, WORKSPACE_A, EVENT_A), null);
  assert.equal(await repository.getById(ACCOUNT_A, WORKSPACE_B, EVENT_A), null);
  assert.deepEqual(await repository.listByWorkspace(ACCOUNT_B, WORKSPACE_A), []);
  assert.deepEqual(await repository.listByWorkspace(ACCOUNT_A, WORKSPACE_B), []);
  assert.deepEqual(await repository.listByOperation(ACCOUNT_B, OPERATION_ID), []);
  connection.close();
});

test('duplicate dan unsafe audit record ditolak', async () => {
  const { connection, repository } = await fixture('audit-duplicate-unsafe');
  await repository.append(ACCOUNT_A, WORKSPACE_A, audit());
  await assert.rejects(repository.append(ACCOUNT_A, WORKSPACE_A, audit()), {
    code: 'constraint_violation',
  });
  await assert.rejects(repository.append(ACCOUNT_A, WORKSPACE_A, audit({ token: 'secret' })), {
    code: 'data_invalid',
  });
  connection.close();
});

test('audit repository append-only tanpa update/delete dan output immutable', async () => {
  const { connection, repository } = await fixture('audit-api-boundary');
  const output = await repository.append(ACCOUNT_A, WORKSPACE_A, audit());
  assert.throws(() => { output.result = 'failed'; }, TypeError);
  for (const method of ['update', 'put', 'delete', 'clear', 'replace', 'getAll', 'listAll']) {
    assert.equal(method in repository, false);
  }
  connection.close();
});
