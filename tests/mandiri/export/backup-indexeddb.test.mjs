import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createBackupService } from '../../../assets/js/mandiri/export/backup.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { MANDIRI_DATABASE_VERSION } from '../../../assets/js/mandiri/storage/schema.js';
import { createWorkspaceService } from '../../../assets/js/mandiri/services/workspace-service.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  BACKUP_CREATED_AT,
  createWorkspaceDependencies,
  digest,
  USER_A,
  WORKSPACE_A,
} from './fixtures.mjs';

async function setup(name) {
  const indexedDBFactory = new IDBFactory();
  const open = () => openMandiriDatabase({
    indexedDBFactory,
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  const connection = await open();
  const repositoryContext = createRepositoryContext(connection);
  const workspaceService = createWorkspaceService({
    repositoryContext,
    ...createWorkspaceDependencies(),
  });
  const command = workspaceService.prepareCreateWorkspaceCommand({
    accountScope: ACCOUNT_A,
    userScope: USER_A,
    name: 'Warung IndexedDB',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
  });
  await workspaceService.createWorkspace(command);
  return { command, connection, indexedDBFactory, open, repositoryContext };
}

function backupService(repositoryContext) {
  return createBackupService({
    repositoryContext,
    digestFactory: digest,
    now: () => BACKUP_CREATED_AT,
  });
}

test('backup aktual memakai database version 6 dan memuat collection Fase 2-6', async () => {
  const fixture = await setup('backup-indexeddb-basic');
  assert.equal(fixture.connection.schemaVersion, MANDIRI_DATABASE_VERSION);
  const backup = await backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.deepEqual(backup.recordCounts, {
    workspaces: 1,
    memberships: 1,
    auditEvents: 1,
    operationReceipts: 1,
    learningAttempts: 0,
    learningProgress: 0,
    categories: 0,
    products: 0,
    stockMovements: 0,
    inventoryBalances: 0,
    cartDrafts: 0,
    cartLines: 0,
    sales: 0,
    saleLines: 0,
    payments: 0,
    receipts: 0,
  });
  fixture.connection.close();
});

test('close dan reopen mempertahankan backup yang konsisten', async () => {
  const fixture = await setup('backup-indexeddb-reopen');
  const first = await backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  fixture.connection.close();
  const reopened = await fixture.open();
  const second = await backupService(createRepositoryContext(reopened)).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.deepEqual(second, first);
  reopened.close();
});

test('backup menggunakan satu repository context readonly', async () => {
  const fixture = await setup('backup-indexeddb-readonly');
  const modes = [];
  const context = {
    run(stores, mode, callback) {
      modes.push({ stores: [...stores], mode });
      return fixture.repositoryContext.run(stores, mode, callback);
    },
  };
  await backupService(context).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(modes.length, 1);
  assert.equal(modes[0].mode, 'readonly');
  assert.deepEqual(modes[0].stores, [
    'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
    'learningAttempts', 'learningProgress',
    'categories', 'products', 'stockMovements', 'inventoryBalances',
    'cartDrafts', 'cartLines',
    'sales', 'saleLines', 'payments', 'receipts',
  ]);
  fixture.connection.close();
});

test('backup tidak mengubah record IndexedDB', async () => {
  const fixture = await setup('backup-indexeddb-no-write');
  const readCounts = () => fixture.repositoryContext.run(
    ['workspaces', 'memberships', 'auditEvents', 'operationReceipts'],
    'readonly',
    async (repositories) => ({
      workspaces: (await repositories.workspaceRepository.listByAccount(ACCOUNT_A)).length,
      memberships: (await repositories.membershipRepository.listByWorkspace(ACCOUNT_A, WORKSPACE_A)).length,
      auditEvents: (await repositories.auditRepository.listForBackup(ACCOUNT_A, WORKSPACE_A, { limit: 5001 })).length,
      operationReceipts: (await repositories.operationReceiptRepository.listForBackup(ACCOUNT_A, WORKSPACE_A, { limit: 5001 })).length,
    }),
  );
  const before = await readCounts();
  await backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.deepEqual(await readCounts(), before);
  fixture.connection.close();
});

test('akun B tidak dapat mengekspor workspace akun A', async () => {
  const fixture = await setup('backup-indexeddb-account-scope');
  await assert.rejects(backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_B,
    workspaceId: WORKSPACE_A,
  }), { code: 'workspace_not_found' });
  fixture.connection.close();
});

test('transaction rollback tidak meninggalkan workspace parsial untuk backup', async () => {
  const fixture = await setup('backup-indexeddb-rollback');
  const otherWorkspace = {
    schemaVersion: 1,
    version: 1,
    workspaceId: 'workspace_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    accountScope: ACCOUNT_A,
    name: 'Tidak tersimpan',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    status: 'active',
    createdAtLocal: '2026-07-17T02:00:00.000Z',
    updatedAtLocal: '2026-07-17T02:00:00.000Z',
  };
  await assert.rejects(fixture.repositoryContext.run(
    ['workspaces', 'memberships'],
    'readwrite',
    async (repositories) => {
      await repositories.workspaceRepository.add(ACCOUNT_A, otherWorkspace);
      const existing = await repositories.membershipRepository.listByWorkspace(ACCOUNT_A, WORKSPACE_A);
      await repositories.membershipRepository.add(ACCOUNT_A, WORKSPACE_A, existing[0]);
    },
  ), { code: 'constraint_violation' });
  const backup = await backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(backup.data.workspaces.length, 1);
  assert.equal(backup.data.workspaces[0].workspaceId, WORKSPACE_A);
  fixture.connection.close();
});

test('record backup IndexedDB tidak mengandung email atau token', async () => {
  const fixture = await setup('backup-indexeddb-private-fields');
  const backup = await backupService(fixture.repositoryContext).createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.doesNotMatch(JSON.stringify(backup), /@|access.?token|refresh.?token|password/i);
  fixture.connection.close();
});
