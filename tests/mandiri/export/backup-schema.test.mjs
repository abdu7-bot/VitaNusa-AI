import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeBackupValue,
  MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION,
  MANDIRI_BACKUP_FORMAT,
  MANDIRI_BACKUP_FORMAT_VERSION,
  MANDIRI_BACKUP_RECORD_LIMITS,
  normalizeBackupDocument,
} from '../../../assets/js/mandiri/export/backup-schema.js';
import { createValidBackup, resignBackup } from './fixtures.mjs';

test('schema backup menetapkan format, version, schema, dan batas Fase 5', () => {
  assert.equal(MANDIRI_BACKUP_FORMAT, 'vitanusa-mandiri-backup');
  assert.equal(MANDIRI_BACKUP_FORMAT_VERSION, 5);
  assert.equal(MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION, 5);
  assert.deepEqual(MANDIRI_BACKUP_RECORD_LIMITS, {
    workspaces: 1,
    memberships: 100,
    auditEvents: 5000,
    operationReceipts: 5000,
    learningAttempts: 5000,
    learningProgress: 2000,
    categories: 1000,
    products: 10000,
    stockMovements: 50000,
    inventoryBalances: 10000,
    cartDrafts: 10000,
    cartLines: 50000,
  });
});

test('backup valid dinormalisasi dan dibekukan', async () => {
  const { backup } = await createValidBackup();
  const normalized = normalizeBackupDocument(backup);
  assert.equal(normalized.format, MANDIRI_BACKUP_FORMAT);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.data.memberships), true);
});

test('field root, recordCounts, dan data tambahan ditolak', async () => {
  const { backup } = await createValidBackup();
  for (const mutate of [
    (value) => { value.token = 'fixture'; },
    (value) => { value.recordCounts.extra = 1; },
    (value) => { value.data.extra = []; },
  ]) {
    const invalid = await resignBackup(backup, mutate);
    assert.throws(() => normalizeBackupDocument(invalid), { code: 'backup_invalid' });
  }
});

test('dangerous key dan prototype asing ditolak secara rekursif', () => {
  assert.throws(
    () => assertSafeBackupValue(JSON.parse('{"safe":{"__proto__":{"admin":true}}}')),
    { code: 'dangerous_key' },
  );
  assert.throws(() => assertSafeBackupValue({ safe: { constructor: 'x' } }), {
    code: 'dangerous_key',
  });
  assert.throws(() => assertSafeBackupValue(Object.assign(new Date(), { safe: true })), {
    code: 'dangerous_key',
  });
});

test('input terlalu dalam ditolak tanpa memperbaiki object', () => {
  const root = {};
  let current = root;
  for (let index = 0; index < 40; index += 1) {
    current.next = {};
    current = current.next;
  }
  assert.throws(() => assertSafeBackupValue(root), { code: 'dangerous_key' });
});
