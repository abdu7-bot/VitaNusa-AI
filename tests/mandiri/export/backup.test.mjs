import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityId } from '../../../assets/js/mandiri/domain/ids.js';
import { createBackupService } from '../../../assets/js/mandiri/export/backup.js';
import { createInventoryService } from '../../../assets/js/mandiri/pos/services/inventory-service.js';
import { createCashSessionService } from '../../../assets/js/mandiri/pos/services/cash-session-service.js';
import {
  createBackupChecksumPayload,
  MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
} from '../../../assets/js/mandiri/export/backup-schema.js';
import {
  ATOMIC_LEARNING_STORE_NAMES,
  ATOMIC_CART_STORE_NAMES,
  ATOMIC_PRODUCT_STORE_NAMES,
  ATOMIC_INVENTORY_STORE_NAMES,
  ATOMIC_WORKSPACE_STORE_NAMES,
  ATOMIC_SALE_STORE_NAMES,
  ATOMIC_CASH_STORE_NAMES,
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

test('backup valid memuat manifest, delapan belas collection, dan count yang benar', async () => {
  const { backup } = await createValidBackup();
  assert.equal(backup.format, 'vitanusa-mandiri-backup');
  assert.equal(backup.formatVersion, 7);
  assert.equal(backup.databaseSchemaVersion, 7);
  assert.equal(backup.checksumAlgorithm, MANDIRI_BACKUP_CHECKSUM_ALGORITHM);
  assert.match(backup.checksum, /^sha256:[0-9a-f]{64}$/);
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
    expenses: 0,
    cashSessions: 0,
  });
  assert.deepEqual(Object.keys(backup.data), [
    'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
    'learningAttempts', 'learningProgress',
    'categories', 'products', 'stockMovements', 'inventoryBalances',
    'cartDrafts', 'cartLines',
    'sales', 'saleLines', 'payments', 'receipts',
    'expenses', 'cashSessions',
  ]);
});

test('checksum sama dengan canonical payload tanpa field checksum', async () => {
  const { backup } = await createValidBackup();
  assert.equal(await digest(createBackupChecksumPayload(backup)), backup.checksum);
  assert.equal('checksum' in createBackupChecksumPayload(backup), false);
});

test('backup v7 memuat expense dan cash session closed yang konsisten', async () => {
  const fixture = await seedMemoryWorkspace();
  const cashService = createCashSessionService({
    repositoryContext: fixture.memory.repositoryContext,
    digestFactory: digest,
  });
  const cashSessionId = 'cashsession_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await cashService.open({
    schemaVersion: 1,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    actorScope: USER_A,
    actorRole: 'merchant_owner',
    operationId: 'op_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    eventId: 'audit_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cashSessionId,
    openingCashMinor: 5000,
    createdAtLocal: '2026-07-17T00:10:00.000Z',
  });
  await cashService.recordExpense({
    schemaVersion: 1,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    actorScope: USER_A,
    actorRole: 'merchant_owner',
    operationId: 'op_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    eventId: 'audit_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    cashSessionId,
    expenseId: 'expense_ffffffff-ffff-4fff-8fff-ffffffffffff',
    expectedVersion: 1,
    category: 'utilities',
    amountMinor: 1000,
    note: null,
    createdAtLocal: '2026-07-17T00:20:00.000Z',
  });
  await cashService.close({
    schemaVersion: 1,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    actorScope: USER_A,
    actorRole: 'merchant_owner',
    operationId: 'op_11111111-1111-4111-8111-111111111111',
    eventId: 'audit_22222222-2222-4222-8222-222222222222',
    cashSessionId,
    expectedVersion: 2,
    countedCashMinor: 4000,
    createdAtLocal: '2026-07-17T00:30:00.000Z',
  });
  const backup = await fixture.backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(backup.recordCounts.expenses, 1);
  assert.equal(backup.recordCounts.cashSessions, 1);
  assert.equal(backup.data.cashSessions[0].closingSummary.expectedCashMinor, 4000);
  assert.equal(backup.data.expenses[0].amountMinor, 1000);
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

test('backup v3 memuat category dan product publik tanpa accountScope persistence', async () => {
  const fixture = await seedMemoryWorkspace();
  const category = {
    version: 1,
    categoryId: 'category_33333333-3333-4333-8333-333333333333',
    workspaceId: WORKSPACE_A,
    name: 'Minuman',
    active: true,
  };
  const product = {
    version: 1,
    productId: 'product_44444444-4444-4444-8444-444444444444',
    workspaceId: WORKSPACE_A,
    name: 'Teh',
    sku: 'teh-1',
    categoryId: category.categoryId,
    sellingPriceMinor: 5000,
    purchasePriceMinor: null,
    stockTracking: true,
    active: true,
  };
  await fixture.memory.categoryRepository.create(ACCOUNT_A, WORKSPACE_A, category);
  await fixture.memory.productRepository.create(ACCOUNT_A, WORKSPACE_A, product);
  const backup = await fixture.backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
  });
  assert.equal(backup.recordCounts.categories, 1);
  assert.equal(backup.recordCounts.products, 1);
  assert.equal(backup.data.products[0].sku, 'TEH-1');
  assert.equal('accountScope' in backup.data.categories[0], false);
  assert.equal('accountScope' in backup.data.products[0], false);
});

test('backup v4 mencakup ledger movement dan balance yang konsisten', async () => {
  const fixture = await seedMemoryWorkspace();
  const product = {
    version: 1,
    productId: 'product_51515151-5151-4151-8151-515151515151',
    workspaceId: WORKSPACE_A,
    name: 'Produk tracked',
    sku: null,
    categoryId: null,
    sellingPriceMinor: 1000,
    purchasePriceMinor: null,
    stockTracking: true,
    active: true,
  };
  await fixture.memory.productRepository.create(ACCOUNT_A, WORKSPACE_A, product);
  const service = createInventoryService({
    repositoryContext: fixture.memory.repositoryContext,
    digestFactory: digest,
  });
  await service.recordMovement({
    schemaVersion: 1,
    accountScope: ACCOUNT_A,
    workspaceId: WORKSPACE_A,
    actorScope: USER_A,
    actorRole: 'merchant_owner',
    expectedVersion: 0,
    eventId: 'audit_52525252-5252-4252-8252-525252525252',
    movement: {
      schemaVersion: 1,
      movementId: 'movement_53535353-5353-4353-8353-535353535353',
      workspaceId: WORKSPACE_A,
      productId: product.productId,
      movementType: 'opening_stock',
      quantityDelta: 7,
      reason: null,
      actorScope: USER_A,
      actorRole: 'merchant_owner',
      sourceReference: 'opening-test',
      operationId: 'op_54545454-5454-4454-8454-545454545454',
      createdAtLocal: BACKUP_CREATED_AT,
    },
  });
  const backup = await fixture.backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_A, workspaceId: WORKSPACE_A,
  });
  assert.equal(backup.data.stockMovements.length, 1);
  assert.equal(backup.data.inventoryBalances.length, 1);
  assert.equal(backup.data.inventoryBalances[0].quantityOnHand, 7);
  assert.equal(Object.hasOwn(backup.data.stockMovements[0], 'accountScope'), false);
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
      assert.deepEqual(storeNames, [...new Set([
        ...ATOMIC_WORKSPACE_STORE_NAMES,
        ...ATOMIC_LEARNING_STORE_NAMES,
        ...ATOMIC_PRODUCT_STORE_NAMES,
        ...ATOMIC_INVENTORY_STORE_NAMES,
        ...ATOMIC_CART_STORE_NAMES,
        ...ATOMIC_SALE_STORE_NAMES,
        ...ATOMIC_CASH_STORE_NAMES,
      ])]);
      assert.equal(mode, 'readonly');
      return callback({
        workspaceRepository: { listByAccount: async () => backup.data.workspaces },
        membershipRepository: { listByWorkspace: async () => tooMany },
        auditRepository: { listForBackup: async () => backup.data.auditEvents },
        operationReceiptRepository: { listForBackup: async () => backup.data.operationReceipts },
        learningAttemptRepository: { listForBackup: async () => [] },
        learningProgressRepository: { listForBackup: async () => [] },
        categoryRepository: { list: async () => [] },
        productRepository: { list: async () => [] },
        inventoryRepository: { listForBackup: async () => [], listBalances: async () => [] },
        cartRepository: { listForBackup: async () => ({ cartDrafts: [], cartLines: [] }) },
        saleRepository: {
          listForBackup: async () => ({ sales: [], saleLines: [], payments: [], receipts: [] }),
        },
        expenseRepository: { listForBackup: async () => [] },
        cashSessionRepository: { listForBackup: async () => [] },
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
  assert.doesNotMatch(json, /VitaCheck|conversation/i);
});

test('fixture dasar mempertahankan hubungan audit dan receipt ke workspace', async () => {
  const { backup } = await createValidBackup();
  assert.equal(backup.data.auditEvents[0].eventId, AUDIT_A);
  assert.equal(backup.data.auditEvents[0].operationId, OPERATION_A);
  assert.equal(backup.data.operationReceipts[0].operationId, OPERATION_A);
  assert.equal(backup.data.memberships[0].userScope, USER_A);
});
