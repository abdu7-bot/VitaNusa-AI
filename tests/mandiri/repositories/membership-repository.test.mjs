import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createMembershipRepository } from '../../../assets/js/mandiri/repositories/membership-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const OWNER_ID = 'membership_33333333-3333-4333-8333-333333333333';
const CASHIER_ID = 'membership_44444444-4444-4444-8444-444444444444';

function membership(overrides = {}) {
  return {
    membershipId: OWNER_ID,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    userScope: 'user_scope_owner',
    role: 'merchant_owner',
    status: 'active',
    createdAtLocal: '2026-07-16T00:00:00.000Z',
    updatedAtLocal: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

async function fixture(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return { connection, repository: createMembershipRepository({ connection }) };
}

test('membership dapat ditambah, dibaca ID, workspace, dan userScope', async () => {
  const { connection, repository } = await fixture('membership-main-methods');
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership());
  assert.equal((await repository.getById(ACCOUNT_A, WORKSPACE_A, OWNER_ID)).role, 'merchant_owner');
  assert.equal(
    (await repository.getByUserScope(ACCOUNT_A, WORKSPACE_A, 'user_scope_owner')).membershipId,
    OWNER_ID,
  );
  assert.deepEqual(
    (await repository.listByWorkspace(ACCOUNT_A, WORKSPACE_A)).map((record) => record.membershipId),
    [OWNER_ID],
  );
  connection.close();
});

test('countActiveOwners hanya menghitung merchant_owner aktif', async () => {
  const { connection, repository } = await fixture('membership-owner-count');
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership());
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership({
    membershipId: CASHIER_ID,
    userScope: 'user_scope_cashier',
    role: 'cashier',
  }));
  const inactiveOwnerId = 'membership_55555555-5555-4555-8555-555555555555';
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership({
    membershipId: inactiveOwnerId,
    userScope: 'user_scope_inactive_owner',
    status: 'inactive',
  }));
  assert.equal(await repository.countActiveOwners(ACCOUNT_A, WORKSPACE_A), 1);
  assert.deepEqual(
    (await repository.listByStatus(ACCOUNT_A, WORKSPACE_A, 'inactive'))
      .map((record) => record.membershipId),
    [inactiveOwnerId],
  );
  connection.close();
});

test('cross-account dan cross-workspace tidak terlihat', async () => {
  const { connection, repository } = await fixture('membership-isolation');
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership());
  assert.equal(await repository.getById(ACCOUNT_B, WORKSPACE_A, OWNER_ID), null);
  assert.equal(await repository.getById(ACCOUNT_A, WORKSPACE_B, OWNER_ID), null);
  assert.deepEqual(await repository.listByWorkspace(ACCOUNT_B, WORKSPACE_A), []);
  assert.deepEqual(await repository.listByWorkspace(ACCOUNT_A, WORKSPACE_B), []);
  connection.close();
});

test('duplicate dan scope mismatch ditolak', async () => {
  const { connection, repository } = await fixture('membership-duplicate-scope');
  await repository.add(ACCOUNT_A, WORKSPACE_A, membership());
  await assert.rejects(repository.add(ACCOUNT_A, WORKSPACE_A, membership()), {
    code: 'constraint_violation',
  });
  await assert.rejects(repository.add(ACCOUNT_B, WORKSPACE_A, membership()), {
    code: 'scope_mismatch',
  });
  await assert.rejects(repository.add(ACCOUNT_A, WORKSPACE_B, membership()), {
    code: 'scope_mismatch',
  });
  connection.close();
});

test('membership input/output di-clone dan method global/update tidak tersedia', async () => {
  const { connection, repository } = await fixture('membership-clone-api');
  const input = membership();
  const snapshot = structuredClone(input);
  const output = await repository.add(ACCOUNT_A, WORKSPACE_A, input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(output, input);
  assert.throws(() => { output.role = 'cashier'; }, TypeError);
  for (const method of ['getAll', 'listAll', 'dump', 'clearEverything', 'put', 'update', 'delete']) {
    assert.equal(method in repository, false);
  }
  connection.close();
});
