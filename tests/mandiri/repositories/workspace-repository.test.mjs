import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createWorkspaceRepository } from '../../../assets/js/mandiri/repositories/workspace-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';

function workspace(overrides = {}) {
  return {
    workspaceId: WORKSPACE_A,
    accountScope: ACCOUNT_A,
    name: 'Warung Scoped',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
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
  return { connection, repository: createWorkspaceRepository({ connection }) };
}

test('workspace valid dapat ditambah dan dibaca berdasarkan scope', async () => {
  const { connection, repository } = await fixture('workspace-add-read');
  const added = await repository.add(ACCOUNT_A, workspace());
  const found = await repository.getById(ACCOUNT_A, WORKSPACE_A);
  assert.deepEqual(found, added);
  assert.equal(Object.isFrozen(found), true);
  connection.close();
});

test('workspace account A tidak terlihat account B', async () => {
  const { connection, repository } = await fixture('workspace-account-isolation');
  await repository.add(ACCOUNT_A, workspace());
  assert.equal(await repository.getById(ACCOUNT_B, WORKSPACE_A), null);
  assert.deepEqual(await repository.listByAccount(ACCOUNT_B), []);
  connection.close();
});

test('duplicate key dan explicit scope mismatch ditolak', async () => {
  const { connection, repository } = await fixture('workspace-duplicate-scope');
  await repository.add(ACCOUNT_A, workspace());
  await assert.rejects(repository.add(ACCOUNT_A, workspace()), { code: 'constraint_violation' });
  await assert.rejects(repository.add(ACCOUNT_B, workspace()), { code: 'scope_mismatch' });
  connection.close();
});

test('list scoped, filter status, dan urutan updatedAt stabil', async () => {
  const { connection, repository } = await fixture('workspace-list-status');
  await repository.add(ACCOUNT_A, workspace());
  await repository.add(ACCOUNT_A, workspace({
    workspaceId: WORKSPACE_B,
    name: 'Workspace terbaru',
    status: 'archived',
    updatedAtLocal: '2026-07-16T01:00:00.000Z',
  }));
  await repository.add(ACCOUNT_B, workspace({ accountScope: ACCOUNT_B }));

  assert.deepEqual(
    (await repository.listByAccount(ACCOUNT_A)).map((record) => record.workspaceId),
    [WORKSPACE_B, WORKSPACE_A],
  );
  assert.deepEqual(
    (await repository.listByStatus(ACCOUNT_A, 'active')).map((record) => record.workspaceId),
    [WORKSPACE_A],
  );
  assert.deepEqual(
    (await repository.listByStatus(ACCOUNT_A, 'archived')).map((record) => record.workspaceId),
    [WORKSPACE_B],
  );
  connection.close();
});

test('input tidak dimutasi dan output tidak membuka referensi internal', async () => {
  const { connection, repository } = await fixture('workspace-cloning');
  const input = workspace({ name: '  Nama dinormalisasi  ' });
  const snapshot = structuredClone(input);
  const added = await repository.add(ACCOUNT_A, input);
  assert.deepEqual(input, snapshot);
  assert.equal(added.name, 'Nama dinormalisasi');
  assert.throws(() => { added.name = 'diubah'; }, TypeError);
  assert.equal((await repository.getById(ACCOUNT_A, WORKSPACE_A)).name, 'Nama dinormalisasi');
  connection.close();
});

test('workspace repository tidak mempunyai method global atau delete/put', async () => {
  const { connection, repository } = await fixture('workspace-api-boundary');
  for (const method of ['getAll', 'listAll', 'dump', 'readEverything', 'clearEverything', 'put', 'delete']) {
    assert.equal(method in repository, false);
  }
  connection.close();
});
