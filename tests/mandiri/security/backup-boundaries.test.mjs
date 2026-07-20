import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupChecksumPayload } from '../../../assets/js/mandiri/export/backup-schema.js';
import { createValidBackup, digest } from '../export/fixtures.mjs';

test('backup tidak berisi credential, email, UID mentah, VitaCheck, Nusa, atau admin data', async () => {
  const { backup } = await createValidBackup();
  const serialized = JSON.stringify(backup);
  const forbidden = [
    /access.?token/i,
    /refresh.?token/i,
    /password/i,
    /@example\.com/i,
    /firebase-uid/i,
    /VitaCheck/i,
    /conversation/i,
    /adminData/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(serialized, pattern);
});

test('backup hanya mempunyai sepuluh collection data yang diizinkan', async () => {
  const { backup } = await createValidBackup();
  assert.deepEqual(Object.keys(backup.data), [
    'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
    'learningAttempts', 'learningProgress',
    'categories', 'products', 'stockMovements', 'inventoryBalances',
  ]);
});

test('checksum tidak mencakup field checksum sendiri', async () => {
  const { backup } = await createValidBackup();
  const payload = createBackupChecksumPayload(backup);
  assert.equal('checksum' in payload, false);
  assert.equal(await digest(payload), backup.checksum);
});

test('output immutable dan urutan record deterministik', async () => {
  const first = await createValidBackup();
  const second = await createValidBackup();
  assert.equal(Object.isFrozen(first.backup), true);
  assert.deepEqual(first.backup, second.backup);
});
