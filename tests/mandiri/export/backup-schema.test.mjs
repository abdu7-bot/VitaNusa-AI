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
import {
  ACCOUNT_A,
  BACKUP_CREATED_AT,
  WORKSPACE_A,
  createValidBackup,
  resignBackup,
} from './fixtures.mjs';

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

test('backup v5 memvalidasi CartDraft dan CartLine secara utuh', async () => {
  const { backupService, memory } = await createValidBackup();
  const productId = 'product_77777777-7777-4777-8777-777777777777';
  const cartId = 'cart_88888888-8888-4888-8888-888888888888';
  await memory.productRepository.create(ACCOUNT_A, WORKSPACE_A, {
    version: 1,
    productId,
    workspaceId: WORKSPACE_A,
    name: 'Teh',
    sku: 'TEH-1',
    categoryId: null,
    sellingPriceMinor: 5000,
    purchasePriceMinor: null,
    stockTracking: false,
    active: true,
  });
  await memory.cartRepository.create(ACCOUNT_A, WORKSPACE_A, {
    schemaVersion: 1,
    version: 1,
    cartId,
    workspaceId: WORKSPACE_A,
    status: 'draft',
    currencyCode: 'IDR',
    discountMinor: 500,
    subtotalMinor: 9000,
    grandTotalMinor: 8500,
    lineCount: 1,
    createdAtLocal: BACKUP_CREATED_AT,
    updatedAtLocal: BACKUP_CREATED_AT,
  }, [{
    schemaVersion: 1,
    cartId,
    lineNo: 1,
    productId,
    productNameSnapshot: 'Teh',
    skuSnapshot: 'TEH-1',
    quantityScaled: 2,
    quantityScale: 1,
    unitPriceMinor: 5000,
    lineDiscountMinor: 1000,
    lineGrossMinor: 10000,
    lineSubtotalMinor: 9000,
  }]);
  const backup = await backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(backup.recordCounts.cartDrafts, 1);
  assert.equal(backup.recordCounts.cartLines, 1);
  const invalid = await resignBackup(backup, (value) => {
    value.data.cartLines[0].cartId = 'cart_99999999-9999-4999-8999-999999999999';
  });
  assert.throws(() => normalizeBackupDocument(invalid), { code: 'integrity_error' });
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
