import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createAuditRepository } from '../../../assets/js/mandiri/repositories/audit-repository.js';
import { createMembershipRepository } from '../../../assets/js/mandiri/repositories/membership-repository.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createOperationReceiptRepository } from '../../../assets/js/mandiri/repositories/operation-receipt-repository.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { createWorkspaceRepository } from '../../../assets/js/mandiri/repositories/workspace-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_ID = 'workspace_11111111-1111-4111-8111-111111111111';
const MEMBERSHIP_ID = 'membership_22222222-2222-4222-8222-222222222222';
const EVENT_ID = 'audit_33333333-3333-4333-8333-333333333333';
const OPERATION_ID = 'op_44444444-4444-4444-8444-444444444444';

function records() {
  return {
    workspace: {
      workspaceId: WORKSPACE_ID,
      accountScope: ACCOUNT_A,
      name: 'Warung Contract',
      timezone: 'Asia/Jakarta',
      currencyCode: 'IDR',
      status: 'active',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
      updatedAtLocal: '2026-07-16T00:00:00.000Z',
    },
    membership: {
      membershipId: MEMBERSHIP_ID,
      accountScope: ACCOUNT_A,
      workspaceId: WORKSPACE_ID,
      userScope: 'user_scope_owner',
      role: 'merchant_owner',
      status: 'active',
      createdAtLocal: '2026-07-16T00:00:00.000Z',
      updatedAtLocal: '2026-07-16T00:00:00.000Z',
    },
    audit: {
      eventId: EVENT_ID,
      accountScope: ACCOUNT_A,
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
      accountScope: ACCOUNT_A,
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

async function indexedFixture(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return {
    connection,
    workspaceRepository: createWorkspaceRepository({ connection }),
    membershipRepository: createMembershipRepository({ connection }),
    auditRepository: createAuditRepository({ connection }),
    operationReceiptRepository: createOperationReceiptRepository({ connection }),
    repositoryContext: createRepositoryContext(connection),
  };
}

async function memoryFixture() {
  return createMemoryRepositories();
}

const factories = [
  ['IndexedDB', indexedFixture],
  ['Memory', memoryFixture],
];

for (const [label, createFixture] of factories) {
  test(`${label}: repository utama mempunyai kontrak method yang sama`, async () => {
    const fixture = await createFixture(`contract-methods-${label}`);
    assert.deepEqual(Object.keys(fixture.workspaceRepository), [
      'add', 'getById', 'listByAccount', 'listByStatus',
    ]);
    assert.deepEqual(Object.keys(fixture.membershipRepository), [
      'add', 'getById', 'getByUserScope', 'listByWorkspace', 'listByStatus', 'countActiveOwners',
    ]);
    assert.deepEqual(Object.keys(fixture.auditRepository), [
      'append', 'getById', 'listByWorkspace', 'listByOperation',
    ]);
    assert.deepEqual(Object.keys(fixture.operationReceiptRepository), [
      'append', 'getByOperationId', 'findByEntity',
    ]);
    fixture.connection?.close();
  });

  test(`${label}: scope, duplicate, append-only, dan cloning setara`, async () => {
    const fixture = await createFixture(`contract-behavior-${label}`);
    const data = records();
    const inputSnapshot = structuredClone(data.workspace);
    const workspace = await fixture.workspaceRepository.add(ACCOUNT_A, data.workspace);
    await fixture.membershipRepository.add(ACCOUNT_A, WORKSPACE_ID, data.membership);
    await fixture.auditRepository.append(ACCOUNT_A, WORKSPACE_ID, data.audit);
    await fixture.operationReceiptRepository.append(ACCOUNT_A, data.receipt);

    assert.deepEqual(data.workspace, inputSnapshot);
    assert.notEqual(workspace, data.workspace);
    assert.equal(await fixture.workspaceRepository.getById(ACCOUNT_B, WORKSPACE_ID), null);
    assert.equal(
      await fixture.membershipRepository.getById(ACCOUNT_B, WORKSPACE_ID, MEMBERSHIP_ID),
      null,
    );
    assert.deepEqual(await fixture.auditRepository.listByWorkspace(ACCOUNT_B, WORKSPACE_ID), []);
    assert.equal(
      await fixture.operationReceiptRepository.getByOperationId(ACCOUNT_B, OPERATION_ID),
      null,
    );

    await assert.rejects(fixture.workspaceRepository.add(ACCOUNT_A, data.workspace), {
      code: 'constraint_violation',
    });
    await assert.rejects(fixture.auditRepository.append(ACCOUNT_A, WORKSPACE_ID, data.audit), {
      code: 'constraint_violation',
    });
    await assert.rejects(fixture.operationReceiptRepository.append(ACCOUNT_A, data.receipt), {
      code: 'constraint_violation',
    });
    assert.equal('update' in fixture.auditRepository, false);
    assert.equal('delete' in fixture.auditRepository, false);
    assert.equal('update' in fixture.operationReceiptRepository, false);
    assert.equal('delete' in fixture.operationReceiptRepository, false);
    fixture.connection?.close();
  });

  test(`${label}: unit of work rollback mempunyai hasil setara`, async () => {
    const fixture = await createFixture(`contract-rollback-${label}`);
    const data = records();
    await fixture.membershipRepository.add(ACCOUNT_A, WORKSPACE_ID, data.membership);
    await assert.rejects(fixture.repositoryContext.run(
      ['workspaces', 'memberships'],
      'readwrite',
      async (repositories) => {
        await repositories.workspaceRepository.add(ACCOUNT_A, data.workspace);
        await repositories.membershipRepository.add(ACCOUNT_A, WORKSPACE_ID, data.membership);
      },
    ), { code: 'constraint_violation' });
    assert.equal(await fixture.workspaceRepository.getById(ACCOUNT_A, WORKSPACE_ID), null);
    fixture.connection?.close();
  });
}

test('memory repository tidak berbagi state antar-instance', async () => {
  const first = createMemoryRepositories();
  const second = createMemoryRepositories();
  await first.workspaceRepository.add(ACCOUNT_A, records().workspace);
  assert.equal(await second.workspaceRepository.getById(ACCOUNT_A, WORKSPACE_ID), null);
});

test('memory transaction mengembalikan clone dan scoped repository kedaluwarsa setelah commit', async () => {
  const fixture = createMemoryRepositories();
  let captured;
  await fixture.repositoryContext.run(['workspaces'], 'readwrite', async (repositories) => {
    captured = repositories.workspaceRepository;
    const added = await repositories.workspaceRepository.add(ACCOUNT_A, records().workspace);
    assert.throws(() => { added.name = 'mutasi'; }, TypeError);
  });
  await assert.rejects(captured.getById(ACCOUNT_A, WORKSPACE_ID), { code: 'transaction_aborted' });
  assert.equal(
    (await fixture.workspaceRepository.getById(ACCOUNT_A, WORKSPACE_ID)).name,
    'Warung Contract',
  );
});
