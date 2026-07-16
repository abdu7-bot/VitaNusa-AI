import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { ATOMIC_WORKSPACE_STORE_NAMES } from '../../../assets/js/mandiri/repositories/repository-context.js';

const ACCOUNT = 'account_scope_a';
const WORKSPACE_ID = 'workspace_11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = 'membership_22222222-2222-4222-8222-222222222222';
const EVENT_ID = 'audit_33333333-3333-4333-8333-333333333333';
const OPERATION_ID = 'op_44444444-4444-4444-8444-444444444444';

function records() {
  return {
    workspace: {
      workspaceId: WORKSPACE_ID,
      accountScope: ACCOUNT,
      name: 'Warung Atomik',
      timezone: 'Asia/Jakarta',
      currencyCode: 'IDR',
      status: 'active',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
      updatedAtLocal: '2026-07-16T00:00:00.000Z',
    },
    membership: {
      membershipId: MEMBERSHIP_ID,
      accountScope: ACCOUNT,
      workspaceId: WORKSPACE_ID,
      userScope: 'user_scope_owner',
      role: 'merchant_owner',
      status: 'active',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
      updatedAtLocal: '2026-07-16T00:00:00.000Z',
    },
    audit: {
      eventId: EVENT_ID,
      accountScope: ACCOUNT,
      workspaceId: WORKSPACE_ID,
      actorScope: 'user_scope_owner',
      actorRole: 'merchant_owner',
      action: 'workspace.created',
      entityType: 'workspace',
      entityId: WORKSPACE_ID,
      operationId: OPERATION_ID,
      result: 'success',
      reasonCode: 'none',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
    },
    receipt: {
      schemaVersion: 1,
      accountScope: ACCOUNT,
      workspaceId: WORKSPACE_ID,
      operationId: OPERATION_ID,
      operationType: 'workspace.create',
      payloadDigest: `sha256:${'a'.repeat(64)}`,
      entityType: 'workspace',
      entityId: WORKSPACE_ID,
      result: 'committed',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
    },
  };
}

async function open(name) {
  return openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
}

test('empat store dapat ditulis dalam satu transaction dan tersedia setelah complete', async () => {
  const connection = await open('transaction-four-stores');
  const data = records();
  let capturedContext;
  const result = await connection.runTransaction(
    ATOMIC_WORKSPACE_STORE_NAMES,
    'readwrite',
    async (transaction) => {
      capturedContext = transaction;
      await transaction.request(transaction.objectStore('workspaces').add(data.workspace));
      await transaction.request(transaction.objectStore('memberships').add(data.membership));
      await transaction.request(transaction.objectStore('auditEvents').add(data.audit));
      await transaction.request(transaction.objectStore('operationReceipts').add(data.receipt));
      return 'committed-after-complete';
    },
  );
  assert.equal(result, 'committed-after-complete');
  assert.equal(capturedContext.active, false);

  await connection.runTransaction(ATOMIC_WORKSPACE_STORE_NAMES, 'readonly', async (transaction) => {
    assert.ok(await transaction.request(
      transaction.objectStore('workspaces').get([ACCOUNT, WORKSPACE_ID]),
    ));
    assert.ok(await transaction.request(
      transaction.objectStore('memberships').get([ACCOUNT, WORKSPACE_ID, MEMBERSHIP_ID]),
    ));
    assert.ok(await transaction.request(
      transaction.objectStore('auditEvents').get([ACCOUNT, WORKSPACE_ID, EVENT_ID]),
    ));
    assert.ok(await transaction.request(
      transaction.objectStore('operationReceipts').get([ACCOUNT, OPERATION_ID]),
    ));
  });
  connection.close();
});

test('kegagalan store kedua menghapus perubahan store pertama', async () => {
  const connection = await open('transaction-second-store-failure');
  const data = records();
  await connection.runTransaction(['memberships'], 'readwrite', (transaction) => (
    transaction.request(transaction.objectStore('memberships').add(data.membership))
  ));

  await assert.rejects(connection.runTransaction(
    ['workspaces', 'memberships'],
    'readwrite',
    async (transaction) => {
      await transaction.request(transaction.objectStore('workspaces').add(data.workspace));
      await transaction.request(transaction.objectStore('memberships').add(data.membership));
    },
  ), { code: 'constraint_violation' });

  const workspace = await connection.runTransaction(['workspaces'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('workspaces').get([ACCOUNT, WORKSPACE_ID]))
  ));
  assert.equal(workspace, undefined);
  connection.close();
});

test('duplicate receipt meng-abort seluruh transaction', async () => {
  const connection = await open('transaction-duplicate-receipt');
  const data = records();
  await connection.runTransaction(['operationReceipts'], 'readwrite', (transaction) => (
    transaction.request(transaction.objectStore('operationReceipts').add(data.receipt))
  ));

  await assert.rejects(connection.runTransaction(
    ['workspaces', 'operationReceipts'],
    'readwrite',
    async (transaction) => {
      await transaction.request(transaction.objectStore('workspaces').add(data.workspace));
      await transaction.request(transaction.objectStore('operationReceipts').add(data.receipt));
    },
  ), { code: 'constraint_violation' });
  const workspace = await connection.runTransaction(['workspaces'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('workspaces').get([ACCOUNT, WORKSPACE_ID]))
  ));
  assert.equal(workspace, undefined);
  connection.close();
});

test('callback throw meng-abort dan tidak meninggalkan commit parsial', async () => {
  const connection = await open('transaction-callback-throw');
  const data = records();
  await assert.rejects(connection.runTransaction(['workspaces'], 'readwrite', async (transaction) => {
    await transaction.request(transaction.objectStore('workspaces').add(data.workspace));
    throw new Error('payload internal tidak boleh keluar');
  }), { code: 'transaction_aborted' });
  const workspace = await connection.runTransaction(['workspaces'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('workspaces').get([ACCOUNT, WORKSPACE_ID]))
  ));
  assert.equal(workspace, undefined);
  connection.close();
});

test('transaction context tidak dapat digunakan setelah complete', async () => {
  const connection = await open('transaction-context-expired');
  let capturedContext;
  await connection.runTransaction(['metadata'], 'readonly', (transaction) => {
    capturedContext = transaction;
  });
  assert.throws(() => capturedContext.objectStore('metadata'), { code: 'transaction_aborted' });
  connection.close();
});

test('nested transaction ditolak dan outer transaction di-abort', async () => {
  const connection = await open('transaction-nested');
  const data = records();
  await assert.rejects(connection.runTransaction(['workspaces'], 'readwrite', async (transaction) => {
    await transaction.request(transaction.objectStore('workspaces').add(data.workspace));
    await connection.runTransaction(['metadata'], 'readonly', () => {});
  }), { code: 'data_invalid' });
  const workspace = await connection.runTransaction(['workspaces'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('workspaces').get([ACCOUNT, WORKSPACE_ID]))
  ));
  assert.equal(workspace, undefined);
  connection.close();
});

test('readonly transaction menolak write', async () => {
  const connection = await open('transaction-readonly-write');
  await assert.rejects(connection.runTransaction(['metadata'], 'readonly', (transaction) => {
    transaction.objectStore('metadata').add({ key: 'not-allowed' });
  }), { code: 'data_invalid' });
  connection.close();
});

test('external timer await tidak dianggap transaction aktif', async () => {
  const connection = await open('transaction-external-await');
  await assert.rejects(connection.runTransaction(['metadata'], 'readwrite', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }), { code: 'transaction_aborted' });
  connection.close();
});
