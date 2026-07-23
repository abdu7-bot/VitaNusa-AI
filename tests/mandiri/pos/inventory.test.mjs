import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { normalizeInventoryBalance, normalizeStockMovement } from '../../../assets/js/mandiri/pos/domain/inventory.js';
import { createInventoryRepository } from '../../../assets/js/mandiri/pos/repositories/inventory-repository.js';
import { createProductRepository } from '../../../assets/js/mandiri/pos/repositories/product-repository.js';
import { createInventoryService } from '../../../assets/js/mandiri/pos/services/inventory-service.js';

const ACCOUNT = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const PRODUCT = 'product_33333333-3333-4333-8333-333333333333';
const MOVEMENT = 'movement_44444444-4444-4444-8444-444444444444';
const OPERATION = 'op_55555555-5555-4555-8555-555555555555';
const AT = '2026-07-20T04:00:00.000Z';

const product = (overrides = {}) => ({
  version: 1, productId: PRODUCT, workspaceId: WORKSPACE, name: 'Produk', sku: null,
  categoryId: null, sellingPriceMinor: 1000, purchasePriceMinor: null,
  stockTracking: true, active: true, ...overrides,
});
const movement = (overrides = {}) => ({
  schemaVersion: 1, movementId: MOVEMENT, workspaceId: WORKSPACE, productId: PRODUCT,
  movementType: 'opening_stock', quantityDelta: 10, reason: null,
  actorScope: 'user_scope_owner', actorRole: 'merchant_owner',
  sourceReference: 'manual-opening', operationId: OPERATION, createdAtLocal: AT,
  ...overrides,
});
const balance = (overrides = {}) => ({
  schemaVersion: 1, version: 1, workspaceId: WORKSPACE, productId: PRODUCT,
  quantityOnHand: 10, lastMovementId: MOVEMENT, updatedAtLocal: AT, ...overrides,
});

test('domain movement dan balance valid immutable serta input tidak dimutasi', () => {
  const input = movement();
  const normalized = normalizeStockMovement(input, { workspaceId: WORKSPACE });
  const stock = normalizeInventoryBalance(balance(), { workspaceId: WORKSPACE });
  assert.deepEqual(normalized, input);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(stock), true);
  assert.equal(Object.isFrozen(input), false);
});

test('quantity nol, pecahan, unsafe, type invalid serta movement type invalid ditolak', () => {
  for (const quantityDelta of [0, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) {
    assert.throws(() => normalizeStockMovement(movement({ quantityDelta })));
  }
  assert.equal(normalizeStockMovement(movement({
    movementType: 'sale', quantityDelta: -1, sourceReference: 'sale-local',
  })).movementType, 'sale');
  assert.throws(() => normalizeStockMovement(movement({ movementType: 'unknown' })));
  assert.throws(() => normalizeStockMovement(movement({ movementType: 'purchase_in', quantityDelta: -1 })));
});

test('adjustment positif/negatif wajib reason', () => {
  assert.equal(normalizeStockMovement(movement({ movementType: 'adjustment', quantityDelta: 2, reason: 'Koreksi hitung' })).quantityDelta, 2);
  assert.equal(normalizeStockMovement(movement({ movementType: 'adjustment', quantityDelta: -2, reason: 'Rusak' })).quantityDelta, -2);
  assert.throws(() => normalizeStockMovement(movement({ movementType: 'adjustment', reason: null })));
});

async function indexed(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(), keyRangeFactory: IDBKeyRange, databaseName: name,
  });
  return {
    connection,
    productRepository: createProductRepository({ connection }),
    inventoryRepository: createInventoryRepository({ connection }),
  };
}

for (const [label, fixture] of [['IndexedDB', indexed], ['Memory', async () => createMemoryRepositories()]]) {
  test(`${label}: append-only inventory repository ter-scope dan optimistic`, async () => {
    const value = await fixture(`inventory-${label}`);
    assert.deepEqual(Object.keys(value.inventoryRepository), [
      'appendMovement', 'getBalance', 'listBalances', 'listMovements',
    ]);
    await value.productRepository.create(ACCOUNT, WORKSPACE, product());
    const result = await value.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE, movement(), balance(), 0,
    );
    assert.equal(result.balance.quantityOnHand, 10);
    assert.equal(Object.isFrozen(result.movement), true);
    assert.deepEqual(await value.inventoryRepository.listMovements(ACCOUNT_B, WORKSPACE, PRODUCT), []);
    assert.deepEqual(await value.inventoryRepository.listMovements(ACCOUNT, WORKSPACE_B, PRODUCT), []);
    await assert.rejects(value.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE, movement({
        movementId: 'movement_66666666-6666-4666-8666-666666666666',
        operationId: 'op_77777777-7777-4777-8777-777777777777',
      }), balance({
        version: 2, quantityOnHand: 20,
        lastMovementId: 'movement_66666666-6666-4666-8666-666666666666',
      }), 0,
    ), { code: 'version_conflict' });
    assert.equal((await value.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, PRODUCT)).length, 1);
    value.connection?.close();
  });

  test(`${label}: product reference dan stockTracking false ditolak atomik`, async () => {
    const value = await fixture(`inventory-reference-${label}`);
    await assert.rejects(value.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE, movement(), balance(), 0,
    ), { code: 'invalid_reference' });
    await value.productRepository.create(ACCOUNT, WORKSPACE, product({ stockTracking: false }));
    await assert.rejects(value.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE, movement(), balance(), 0,
    ), { code: 'stock_tracking_disabled' });
    assert.equal(await value.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, PRODUCT), null);
    value.connection?.close();
  });
}

async function serviceFixture(role = 'merchant_owner') {
  const memory = createMemoryRepositories();
  await memory.membershipRepository.add(ACCOUNT, WORKSPACE, {
    version: 1, membershipId: 'membership_88888888-8888-4888-8888-888888888888',
    accountScope: ACCOUNT, workspaceId: WORKSPACE, userScope: 'user_scope_owner',
    role, status: 'active', createdAtLocal: AT, updatedAtLocal: AT,
  });
  await memory.productRepository.create(ACCOUNT, WORKSPACE, product());
  return {
    memory,
    service: createInventoryService({
      repositoryContext: memory.repositoryContext,
      digestFactory: (value) => createPayloadDigest(value, webcrypto),
    }),
  };
}

function command(overrides = {}) {
  return {
    schemaVersion: 1, accountScope: ACCOUNT, workspaceId: WORKSPACE,
    actorScope: 'user_scope_owner', actorRole: 'merchant_owner', expectedVersion: 0,
    movement: movement(), eventId: 'audit_99999999-9999-4999-8999-999999999999',
    ...overrides,
  };
}

test('service opening/purchase/adjustment menjumlah ledger, audit, receipt, dan idempotent', async () => {
  const { memory, service } = await serviceFixture();
  const first = command();
  assert.equal((await service.recordMovement(first)).status, 'committed');
  assert.equal((await service.recordMovement(first)).status, 'duplicate-safe');
  const second = command({
    expectedVersion: 1,
    movement: movement({
      movementId: 'movement_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      movementType: 'purchase_in', quantityDelta: 5,
      sourceReference: 'purchase-note',
      operationId: 'op_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      createdAtLocal: '2026-07-20T04:01:00.000Z',
    }),
    eventId: 'audit_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
  await service.recordMovement(second);
  const third = command({
    expectedVersion: 2,
    movement: movement({
      movementId: 'movement_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      movementType: 'adjustment', quantityDelta: -3, reason: 'Koreksi fisik',
      sourceReference: 'manual-adjustment',
      operationId: 'op_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      createdAtLocal: '2026-07-20T04:02:00.000Z',
    }),
    eventId: 'audit_ffffffff-ffff-4fff-8fff-ffffffffffff',
  });
  await service.recordMovement(third);
  const ledger = await memory.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, PRODUCT);
  const stock = await memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, PRODUCT);
  assert.equal(ledger.reduce((sum, item) => sum + item.quantityDelta, 0), 12);
  assert.equal(stock.quantityOnHand, 12);
  assert.equal(stock.version, 3);
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, OPERATION)).length, 1);
});

test('duplicate payload berbeda, version conflict, dan permission denied rollback', async () => {
  const owner = await serviceFixture();
  const first = command();
  await owner.service.recordMovement(first);
  await assert.rejects(owner.service.recordMovement({
    ...first, movement: { ...first.movement, quantityDelta: 11 },
  }), { code: 'idempotency_mismatch' });
  await assert.rejects(owner.service.recordMovement(command({
    movement: movement({
      movementId: 'movement_12121212-1212-4212-8212-121212121212',
      operationId: 'op_13131313-1313-4313-8313-131313131313',
    }),
    eventId: 'audit_14141414-1414-4414-8414-141414141414',
  })), { code: 'version_conflict' });
  assert.equal((await owner.memory.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, PRODUCT)).length, 1);

  const cashier = await serviceFixture('cashier');
  const denied = command({ actorRole: 'cashier', movement: movement({ actorRole: 'cashier' }) });
  await assert.rejects(cashier.service.recordMovement(denied), { code: 'permission_denied' });
  assert.equal(await cashier.memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, PRODUCT), null);
});

test('kegagalan audit me-rollback movement, balance, dan receipt tanpa data parsial', async () => {
  const { memory, service } = await serviceFixture();
  const eventId = 'audit_15151515-1515-4515-8515-151515151515';
  await memory.auditRepository.append(ACCOUNT, WORKSPACE, {
    schemaVersion: 1, eventId, accountScope: ACCOUNT, workspaceId: WORKSPACE,
    actorScope: 'user_scope_owner', actorRole: 'merchant_owner', action: 'fixture',
    entityType: 'product', entityId: PRODUCT,
    operationId: 'op_16161616-1616-4616-8616-161616161616',
    result: 'success', reasonCode: 'none', createdAtLocal: AT,
  });
  const value = command({ eventId });
  await assert.rejects(service.recordMovement(value), { code: 'constraint_violation' });
  assert.deepEqual(await memory.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, PRODUCT), []);
  assert.equal(await memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, PRODUCT), null);
  assert.equal(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, OPERATION), null);
});
