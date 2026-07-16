import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createMembershipRepository } from '../../../assets/js/mandiri/repositories/membership-repository.js';
import {
  ATOMIC_WORKSPACE_STORE_NAMES,
  createRepositoryContext,
} from '../../../assets/js/mandiri/repositories/repository-context.js';
import { createWorkspaceRepository } from '../../../assets/js/mandiri/repositories/workspace-repository.js';

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
      name: 'Warung Context',
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

async function fixture(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return {
    connection,
    context: createRepositoryContext(connection),
    workspaceRepository: createWorkspaceRepository({ connection }),
    membershipRepository: createMembershipRepository({ connection }),
  };
}

test('repository context menulis empat record dalam satu IndexedDB transaction', async () => {
  const { connection, context, workspaceRepository, membershipRepository } = await fixture(
    'repository-context-atomic',
  );
  const data = records();
  const result = await context.run(ATOMIC_WORKSPACE_STORE_NAMES, 'readwrite', async (repositories) => {
    await repositories.workspaceRepository.add(ACCOUNT, data.workspace);
    await repositories.membershipRepository.add(ACCOUNT, WORKSPACE_ID, data.membership);
    await repositories.auditRepository.append(ACCOUNT, WORKSPACE_ID, data.audit);
    await repositories.operationReceiptRepository.append(ACCOUNT, data.receipt);
    return 'all-scheduled';
  });
  assert.equal(result, 'all-scheduled');
  assert.ok(await workspaceRepository.getById(ACCOUNT, WORKSPACE_ID));
  assert.ok(await membershipRepository.getById(ACCOUNT, WORKSPACE_ID, MEMBERSHIP_ID));
  connection.close();
});

test('satu repository gagal maka seluruh unit of work rollback', async () => {
  const { connection, context, workspaceRepository, membershipRepository } = await fixture(
    'repository-context-rollback',
  );
  const data = records();
  await membershipRepository.add(ACCOUNT, WORKSPACE_ID, data.membership);
  await assert.rejects(context.run(
    ['workspaces', 'memberships'],
    'readwrite',
    async (repositories) => {
      await repositories.workspaceRepository.add(ACCOUNT, data.workspace);
      await repositories.membershipRepository.add(ACCOUNT, WORKSPACE_ID, data.membership);
    },
  ), { code: 'constraint_violation' });
  assert.equal(await workspaceRepository.getById(ACCOUNT, WORKSPACE_ID), null);
  connection.close();
});

test('transaction-scoped repository tidak dapat dipakai setelah complete', async () => {
  const { connection, context } = await fixture('repository-context-expired');
  let captured;
  await context.run(['workspaces'], 'readonly', (repositories) => {
    captured = repositories.workspaceRepository;
  });
  await assert.rejects(captured.getById(ACCOUNT, WORKSPACE_ID), { code: 'transaction_aborted' });
  connection.close();
});

test('repository context menolak nested transaction', async () => {
  const { connection, context } = await fixture('repository-context-nested');
  await assert.rejects(context.run(['workspaces'], 'readonly', async () => {
    await context.run(['memberships'], 'readonly', () => {});
  }), { code: 'data_invalid' });
  connection.close();
});

test('repository context readonly menolak write', async () => {
  const { connection, context, workspaceRepository } = await fixture('repository-context-readonly');
  await assert.rejects(context.run(['workspaces'], 'readonly', (repositories) => (
    repositories.workspaceRepository.add(ACCOUNT, records().workspace)
  )), { code: 'data_invalid' });
  assert.equal(await workspaceRepository.getById(ACCOUNT, WORKSPACE_ID), null);
  connection.close();
});

test('repository yang store-nya tidak ikut transaction ditolak', async () => {
  const { connection, context } = await fixture('repository-context-store-allowlist');
  await assert.rejects(context.run(['workspaces'], 'readonly', (repositories) => (
    repositories.membershipRepository.listByWorkspace(ACCOUNT, WORKSPACE_ID)
  )), { code: 'data_invalid' });
  connection.close();
});
