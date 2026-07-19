import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityId } from '../../../assets/js/mandiri/domain/ids.js';
import { createBackupService } from '../../../assets/js/mandiri/export/backup.js';
import {
  createBackupChecksumPayload,
  MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
} from '../../../assets/js/mandiri/export/backup-schema.js';
import {
  ATOMIC_LEARNING_STORE_NAMES,
  ATOMIC_WORKSPACE_STORE_NAMES,
} from '../../../assets/js/mandiri/repositories/repository-context.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  AUDIT_A,
  BACKUP_CREATED_AT,
  createValidBackup,
  digest,
  OPERATION_A,
  seedMemoryWorkspace,
  USER_A,
  WORKSPACE_A,
} from './fixtures.mjs';

test('backup valid memuat manifest, enam collection, dan count yang benar', async () => {
  const { backup } = await createValidBackup();
  assert.equal(backup.format, 'vitanusa-mandiri-backup');
  assert.equal(backup.formatVersion, 2);
  assert.equal(backup.databaseSchemaVersion, 2);
  assert.equal(backup.checksumAlgorithm, MANDIRI_BACKUP_CHECKSUM_ALGORITHM);
  assert.match(backup.checksum, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(backup.recordCounts, {
    workspaces: 1,
    memberships: 1,
    auditEvents: 1,
    operationReceipts: 1,
    learningAttempts: 0,
    learningProgress: 0,
  });
  assert.deepEqual(Object.keys(backup.data), [
    'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
    'learningAttempts', 'learningProgress',
  ]);
});

test('checksum sama dengan canonical payload tanpa field checksum', async () => {
  const { backup } = await createValidBackup();
  assert.equal(await digest(createBackupChecksumPayload(backup)), backup.checksum);
  assert.equal('checksum' in createBackupChecksumPayload(backup), false);
});

test('backup tepat pada accountScope dan workspaceId yang diminta', async () => {
  const { backup, backupService } = await createValidBackup();
  assert.equal(backup.accountScope, ACCOUNT_A);
  assert.equal(backup.workspaceId, WORKSPACE_A);
  assert.ok(backup.data.memberships.every((record) => record.accountScope === ACCOUNT_A));
  await assert.rejects(
    backupService.createWorkspaceBackup({ accountScope: ACCOUNT_B, workspaceId: WORKSPACE_A }),
    { code: 'workspace_not_found' },
  );
});

test('record diurutkan deterministik tanpa memutasi input repository', async () => {
  const fixture = await seedMemoryWorkspace();
  const secondMembership = {
    schemaVersion: 1,
    version: 1,
    membershipId: createEntityId('membership'),
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    userScope: 'user:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    role: 'cashier',
    status: 'active',
    createdAtLocal: '2026-07-17T00:05:00.000Z',
    updatedAtLocal: '2026-07-17T00:05:00.000Z',
  };
  const snapshot = structuredClone(secondMembership);
  await fixture.memory.membershipRepository.add(ACCOUNT_A, WORKSPACE_A, secondMembership);
  const backup = await fixture.backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.deepEqual(secondMembership, snapshot);
  assert.deepEqual(
    backup.data.memberships.map((record) => record.membershipId),
    [...backup.data.memberships.map((record) => record.membershipId)].sort(),
  );
});

test('output dan collection backup immutable serta tidak membuka referensi input', async () => {
  const { backup } = await createValidBackup();
  assert.equal(Object.isFrozen(backup), true);
  assert.equal(Object.isFrozen(backup.data), true);
  assert.equal(Object.isFrozen(backup.data.workspaces[0]), true);
  assert.throws(() => backup.data.workspaces.push({}), TypeError);
});

test('backup menolak jumlah record di atas batas tanpa menghasilkan backup parsial', async () => {
  const { backup } = await createValidBackup();
  const tooMany = Array.from({ length: 101 }, () => backup.data.memberships[0]);
  const repositoryContext = {
    run(storeNames, mode, callback) {
      assert.deepEqual(storeNames, [...ATOMIC_WORKSPACE_STORE_NAMES, ...ATOMIC_LEARNING_STORE_NAMES]);
      assert.equal(mode, 'readonly');
      return callback({
        workspaceRepository: { listByAccount: async () => backup.data.workspaces },
        membershipRepository: { listByWorkspace: async () => tooMany },
        auditRepository: { listForBackup: async () => backup.data.auditEvents },
        operationReceiptRepository: { listForBackup: async () => backup.data.operationReceipts },
        learningAttemptRepository: { listForBackup: async () => [] },
        learningProgressRepository: { listForBackup: async () => [] },
      });
    },
  };
  const service = createBackupService({
    repositoryContext,
    digestFactory: digest,
    now: () => BACKUP_CREATED_AT,
  });
  await assert.rejects(
    service.createWorkspaceBackup({ accountScope: ACCOUNT_A, workspaceId: WORKSPACE_A }),
    { code: 'record_limit_exceeded' },
  );
});

test('backup tidak memuat token, email, UID mentah, atau collection domain lain', async () => {
  const { backup } = await createValidBackup();
  const json = JSON.stringify(backup);
  assert.doesNotMatch(json, /access.?token|refresh.?token|password|private.?key/i);
  assert.doesNotMatch(json, /@example\.com|firebase-uid-fixture/);
  assert.doesNotMatch(json, /VitaCheck|conversation|products|sales/i);
});

test('fixture dasar mempertahankan hubungan audit dan receipt ke workspace', async () => {
  const { backup } = await createValidBackup();
  assert.equal(backup.data.auditEvents[0].eventId, AUDIT_A);
  assert.equal(backup.data.auditEvents[0].operationId, OPERATION_A);
  assert.equal(backup.data.operationReceipts[0].operationId, OPERATION_A);
  assert.equal(backup.data.memberships[0].userScope, USER_A);
});
