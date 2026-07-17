import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupService } from '../../../assets/js/mandiri/export/backup.js';
import {
  ACCOUNT_A,
  BACKUP_CREATED_AT,
  createValidBackup,
  digest,
  seedMemoryWorkspace,
  WORKSPACE_A,
  WORKSPACE_B,
} from '../export/fixtures.mjs';

function workspaceB() {
  return {
    schemaVersion: 1,
    version: 1,
    workspaceId: WORKSPACE_B,
    accountScope: ACCOUNT_A,
    name: 'Workspace B',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    status: 'active',
    createdAtLocal: '2026-07-17T02:00:00.000Z',
    updatedAtLocal: '2026-07-17T02:00:00.000Z',
  };
}

function scopedRecordsB() {
  const operationId = 'op_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  return {
    membership: {
      schemaVersion: 1,
      version: 1,
      membershipId: 'membership_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      accountScope: ACCOUNT_A,
      workspaceId: WORKSPACE_B,
      userScope: 'user:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      role: 'merchant_owner',
      status: 'active',
      createdAtLocal: '2026-07-17T02:00:00.000Z',
      updatedAtLocal: '2026-07-17T02:00:00.000Z',
    },
    audit: {
      schemaVersion: 1,
      eventId: 'audit_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      accountScope: ACCOUNT_A,
      workspaceId: WORKSPACE_B,
      actorScope: 'user:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      actorRole: 'merchant_owner',
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: WORKSPACE_B,
      operationId,
      result: 'success',
      reasonCode: 'none',
      createdAtLocal: '2026-07-17T02:00:00.000Z',
    },
    receipt: {
      schemaVersion: 1,
      accountScope: ACCOUNT_A,
      workspaceId: WORKSPACE_B,
      operationId,
      operationType: 'workspace_create',
      payloadDigest: `sha256:${'c'.repeat(64)}`,
      entityType: 'workspace',
      entityId: WORKSPACE_B,
      result: 'committed',
      createdAtLocal: '2026-07-17T02:00:00.000Z',
    },
  };
}

test('workspace A tidak membaca membership, audit, atau receipt workspace B', async () => {
  const fixture = await seedMemoryWorkspace();
  const records = scopedRecordsB();
  await fixture.memory.workspaceRepository.add(ACCOUNT_A, workspaceB());
  await fixture.memory.membershipRepository.add(ACCOUNT_A, WORKSPACE_B, records.membership);
  await fixture.memory.auditRepository.append(ACCOUNT_A, WORKSPACE_B, records.audit);
  await fixture.memory.operationReceiptRepository.append(ACCOUNT_A, records.receipt);

  assert.equal((await fixture.memory.membershipRepository.listByWorkspace(ACCOUNT_A, WORKSPACE_A)).length, 1);
  assert.equal((await fixture.memory.auditRepository.listForBackup(ACCOUNT_A, WORKSPACE_A, { limit: 5001 })).length, 1);
  assert.equal((await fixture.memory.operationReceiptRepository.listForBackup(ACCOUNT_A, WORKSPACE_A, { limit: 5001 })).length, 1);
});

test('record cross-workspace dari reader terkontaminasi membuat backup gagal', async () => {
  const { backup } = await createValidBackup();
  const records = scopedRecordsB();
  const service = createBackupService({
    repositoryContext: {
      run(_stores, _mode, callback) {
        return callback({
          workspaceRepository: { listByAccount: async () => backup.data.workspaces },
          membershipRepository: { listByWorkspace: async () => [records.membership] },
          auditRepository: { listForBackup: async () => backup.data.auditEvents },
          operationReceiptRepository: { listForBackup: async () => backup.data.operationReceipts },
        });
      },
    },
    digestFactory: digest,
    now: () => BACKUP_CREATED_AT,
  });
  await assert.rejects(service.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  }), { code: 'integrity_error' });
});

test('multiple workspace pada account Fase 1 menjadi integrity error', async () => {
  const fixture = await seedMemoryWorkspace();
  await fixture.memory.workspaceRepository.add(ACCOUNT_A, workspaceB());
  await assert.rejects(fixture.backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  }), { code: 'integrity_error' });
});

test('repository tanpa scope gagal dan API query global tidak tersedia', async () => {
  const fixture = await seedMemoryWorkspace();
  await assert.rejects(fixture.memory.membershipRepository.listByWorkspace(), {
    code: 'scope_mismatch',
  });
  for (const repository of [
    fixture.memory.workspaceRepository,
    fixture.memory.membershipRepository,
    fixture.memory.auditRepository,
    fixture.memory.operationReceiptRepository,
  ]) {
    for (const method of ['getAll', 'listAll', 'dumpDatabase', 'readEverything', 'clearEverything']) {
      assert.equal(method in repository, false);
    }
  }
});
