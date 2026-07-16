import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import {
  createOperationReceiptRepository,
} from '../../../assets/js/mandiri/repositories/operation-receipt-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const OPERATION_ID = 'op_33333333-3333-4333-8333-333333333333';

function receipt(overrides = {}) {
  return {
    schemaVersion: 1,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    operationId: OPERATION_ID,
    operationType: 'workspace.create',
    payloadDigest: `sha256:${'a'.repeat(64)}`,
    entityType: 'workspace',
    entityId: WORKSPACE_A,
    result: 'committed',
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
  return { connection, repository: createOperationReceiptRepository({ connection }) };
}

test('receipt valid dapat ditambah, dibaca, dan ditemukan berdasarkan entity', async () => {
  const { connection, repository } = await fixture('receipt-main-methods');
  const added = await repository.append(ACCOUNT_A, receipt());
  assert.deepEqual(await repository.getByOperationId(ACCOUNT_A, OPERATION_ID), added);
  assert.deepEqual(
    (await repository.findByEntity(ACCOUNT_A, WORKSPACE_A, 'workspace', WORKSPACE_A))
      .map((record) => record.operationId),
    [OPERATION_ID],
  );
  connection.close();
});

test('duplicate operation ID ditolak dan tidak dianggap overwrite', async () => {
  const { connection, repository } = await fixture('receipt-duplicate');
  await repository.append(ACCOUNT_A, receipt());
  await assert.rejects(repository.append(ACCOUNT_A, receipt({
    payloadDigest: `sha256:${'b'.repeat(64)}`,
  })), { code: 'constraint_violation' });
  assert.equal(
    (await repository.getByOperationId(ACCOUNT_A, OPERATION_ID)).payloadDigest,
    `sha256:${'a'.repeat(64)}`,
  );
  connection.close();
});

test('payload asli, digest invalid, dan scope mismatch ditolak', async () => {
  const { connection, repository } = await fixture('receipt-validation');
  await assert.rejects(repository.append(ACCOUNT_A, receipt({ payload: { name: 'raw' } })), {
    code: 'data_invalid',
  });
  await assert.rejects(repository.append(ACCOUNT_A, receipt({ payloadDigest: 'sha256:invalid' })), {
    code: 'data_invalid',
  });
  await assert.rejects(repository.append(ACCOUNT_B, receipt()), { code: 'scope_mismatch' });
  connection.close();
});

test('cross-account dan pencarian cross-workspace tidak terlihat', async () => {
  const { connection, repository } = await fixture('receipt-isolation');
  await repository.append(ACCOUNT_A, receipt());
  assert.equal(await repository.getByOperationId(ACCOUNT_B, OPERATION_ID), null);
  assert.deepEqual(
    await repository.findByEntity(ACCOUNT_B, WORKSPACE_A, 'workspace', WORKSPACE_A),
    [],
  );
  assert.deepEqual(
    await repository.findByEntity(ACCOUNT_A, WORKSPACE_B, 'workspace', WORKSPACE_A),
    [],
  );
  connection.close();
});

test('receipt append-only tanpa update/delete dan output immutable', async () => {
  const { connection, repository } = await fixture('receipt-api-boundary');
  const output = await repository.append(ACCOUNT_A, receipt());
  assert.throws(() => { output.result = 'rejected'; }, TypeError);
  assert.equal('payload' in output, false);
  for (const method of ['update', 'put', 'delete', 'clear', 'replace', 'getAll', 'listAll']) {
    assert.equal(method in repository, false);
  }
  connection.close();
});
