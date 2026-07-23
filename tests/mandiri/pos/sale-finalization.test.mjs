import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createSaleFinalizationService } from '../../../assets/js/mandiri/pos/services/sale-finalization-service.js';
import { normalizePayment } from '../../../assets/js/mandiri/pos/domain/payment.js';
import { normalizeReceipt } from '../../../assets/js/mandiri/pos/domain/receipt.js';
import { normalizeSale, normalizeSaleLine } from '../../../assets/js/mandiri/pos/domain/sale.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import {
  ATOMIC_SALE_STORE_NAMES, createRepositoryContext,
} from '../../../assets/js/mandiri/repositories/repository-context.js';

const ACCOUNT = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const CART = 'cart_22222222-2222-4222-8222-222222222222';
const TRACKED = 'product_33333333-3333-4333-8333-333333333333';
const UNTRACKED = 'product_44444444-4444-4444-8444-444444444444';
const SALE = 'sale_55555555-5555-4555-8555-555555555555';
const PAYMENT = 'payment_66666666-6666-4666-8666-666666666666';
const RECEIPT = 'receipt_77777777-7777-4777-8777-777777777777';
const OPERATION = 'op_88888888-8888-4888-8888-888888888888';
const EVENT = 'audit_99999999-9999-4999-8999-999999999999';
const MOVEMENT = 'movement_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AT = '2026-07-23T06:00:00.000Z';

const product = (productId, overrides = {}) => ({
  version: 1, productId, workspaceId: WORKSPACE,
  name: productId === TRACKED ? 'Tracked' : 'Non tracked', sku: null, categoryId: null,
  sellingPriceMinor: productId === TRACKED ? 5000 : 2000, purchasePriceMinor: null,
  stockTracking: productId === TRACKED, active: true, ...overrides,
});
const line = (productId, lineNo, overrides = {}) => {
  const price = productId === TRACKED ? 5000 : 2000;
  return {
    schemaVersion: 1, cartId: CART, lineNo, productId,
    productNameSnapshot: productId === TRACKED ? 'Tracked' : 'Non tracked', skuSnapshot: null,
    quantityScaled: 1, quantityScale: 1, unitPriceMinor: price, lineDiscountMinor: 0,
    lineGrossMinor: price, lineSubtotalMinor: price, ...overrides,
  };
};
const draft = (overrides = {}) => ({
  schemaVersion: 1, version: 1, cartId: CART, workspaceId: WORKSPACE, status: 'draft',
  currencyCode: 'IDR', discountMinor: 0, subtotalMinor: 7000, grandTotalMinor: 7000,
  lineCount: 2, createdAtLocal: AT, updatedAtLocal: AT, ...overrides,
});
const command = (overrides = {}) => ({
  schemaVersion: 1, accountScope: ACCOUNT, workspaceId: WORKSPACE,
  actorScope: 'user_scope_actor', actorRole: 'merchant_owner',
  operationId: OPERATION, eventId: EVENT, saleId: SALE, paymentId: PAYMENT,
  receiptId: RECEIPT, stockMovementIds: [MOVEMENT], cartId: CART,
  expectedCartVersion: 1, payment: { method: 'cash', amountTenderedMinor: 10000 },
  createdAtLocal: AT, ...overrides,
});

async function setup({
  role = 'merchant_owner', cart = draft(), lines = [line(TRACKED, 1), line(UNTRACKED, 2)],
  trackedProduct = product(TRACKED), stock = 3,
} = {}) {
  const memory = createMemoryRepositories();
  await memory.membershipRepository.add(ACCOUNT, WORKSPACE, {
    version: 1, membershipId: 'membership_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    accountScope: ACCOUNT, workspaceId: WORKSPACE, userScope: 'user_scope_actor',
    role, status: 'active', createdAtLocal: AT, updatedAtLocal: AT,
  });
  if (trackedProduct) await memory.productRepository.create(ACCOUNT, WORKSPACE, trackedProduct);
  await memory.productRepository.create(ACCOUNT, WORKSPACE, product(UNTRACKED));
  if (trackedProduct?.stockTracking && stock !== null) {
    await memory.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE,
      {
        schemaVersion: 1, movementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        workspaceId: WORKSPACE, productId: TRACKED, movementType: 'opening_stock',
        quantityDelta: stock, reason: null, actorScope: 'user_scope_actor',
        actorRole: role, sourceReference: 'opening', operationId: 'op_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        createdAtLocal: '2026-07-23T05:00:00.000Z',
      },
      {
        schemaVersion: 1, version: 1, workspaceId: WORKSPACE, productId: TRACKED,
        quantityOnHand: stock, lastMovementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        updatedAtLocal: '2026-07-23T05:00:00.000Z',
      },
      0,
    );
  }
  await memory.cartRepository.create(ACCOUNT, WORKSPACE, cart, lines);
  const service = createSaleFinalizationService({
    repositoryContext: memory.repositoryContext,
    digestFactory: (value) => createPayloadDigest(value, webcrypto),
  });
  return { memory, service };
}

test('domain Sale, SaleLine, Payment, dan Receipt final immutable', async () => {
  const { service } = await setup();
  const result = await service.finalize(command());
  assert.equal(Object.isFrozen(normalizeSale(result.sale)), true);
  assert.equal(Object.isFrozen(normalizeSaleLine(result.lines[0])), true);
  assert.equal(Object.isFrozen(normalizePayment(result.payment)), true);
  const receipt = normalizeReceipt(result.receipt);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.lines), true);
  assert.equal(result.payment.changeMinor, 3000);
});

test('finalisasi valid atomik menutup cart dan hanya mengurangi produk tracked', async () => {
  const { memory, service } = await setup();
  const result = await service.finalize(command());
  assert.equal(result.status, 'committed');
  assert.equal(result.cart.status, 'finalized');
  assert.equal((await memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, TRACKED)).quantityOnHand, 2);
  assert.equal(await memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, UNTRACKED), null);
  assert.equal((await memory.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, TRACKED)).length, 2);
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, OPERATION)).length, 1);
  assert.ok(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, OPERATION));
  assert.equal(await memory.saleRepository.get(ACCOUNT_B, WORKSPACE, SALE), null);
});

test('dua line produk tracked yang sama diagregasi menjadi satu mutasi dan retry tetap idempotent', async () => {
  const lines = [
    line(TRACKED, 1),
    line(TRACKED, 2, {
      quantityScaled: 2,
      lineGrossMinor: 10000,
      lineSubtotalMinor: 10000,
    }),
  ];
  const { memory, service } = await setup({
    cart: draft({ subtotalMinor: 15000, grandTotalMinor: 15000 }),
    lines,
    stock: 3,
  });
  const aggregateCommand = command({
    payment: { method: 'cash', amountTenderedMinor: 20000 },
  });

  const result = await service.finalize(aggregateCommand);
  assert.equal(result.status, 'committed');
  assert.equal(result.lines.length, 2);
  assert.equal(result.receipt.lines.length, 2);
  assert.equal(result.payment.amountAppliedMinor, 15000);
  assert.equal(result.cart.status, 'finalized');
  assert.equal((await memory.inventoryRepository.getBalance(
    ACCOUNT, WORKSPACE, TRACKED,
  )).quantityOnHand, 0);
  const movements = await memory.inventoryRepository.listMovements(ACCOUNT, WORKSPACE, TRACKED);
  assert.equal(movements.length, 2);
  assert.equal(movements.filter((movement) => movement.movementType === 'sale').length, 1);
  assert.equal(movements.find((movement) => movement.movementType === 'sale').quantityDelta, -3);

  assert.equal((await service.finalize(aggregateCommand)).status, 'duplicate-safe');
  assert.equal((await memory.inventoryRepository.listMovements(
    ACCOUNT, WORKSPACE, TRACKED,
  )).length, 2);
});

test('stok agregat tidak cukup me-rollback seluruh finalisasi', async () => {
  const lines = [
    line(TRACKED, 1),
    line(TRACKED, 2, {
      quantityScaled: 2,
      lineGrossMinor: 10000,
      lineSubtotalMinor: 10000,
    }),
  ];
  const { memory, service } = await setup({
    cart: draft({ subtotalMinor: 15000, grandTotalMinor: 15000 }),
    lines,
    stock: 2,
  });

  await assert.rejects(service.finalize(command({
    payment: { method: 'cash', amountTenderedMinor: 20000 },
  })), { code: 'insufficient_local_stock' });
  assert.equal(await memory.saleRepository.get(ACCOUNT, WORKSPACE, SALE), null);
  assert.equal((await memory.cartRepository.get(ACCOUNT, WORKSPACE, CART)).status, 'draft');
  assert.equal((await memory.inventoryRepository.getBalance(
    ACCOUNT, WORKSPACE, TRACKED,
  )).quantityOnHand, 2);
  assert.equal((await memory.inventoryRepository.listMovements(
    ACCOUNT, WORKSPACE, TRACKED,
  )).length, 1);
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, OPERATION)).length, 0);
  assert.equal(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, OPERATION), null);
});

test('cashier dapat finalisasi; payment kurang atau metode non-MVP ditolak', async () => {
  const cashier = await setup({ role: 'cashier' });
  assert.equal((await cashier.service.finalize(command({ actorRole: 'cashier' }))).status, 'committed');
  const underpaid = await setup();
  await assert.rejects(underpaid.service.finalize(command({
    payment: { method: 'cash', amountTenderedMinor: 6999 },
  })), { code: 'underpayment' });
  const invalid = await setup();
  await assert.rejects(invalid.service.finalize(command({
    payment: { method: 'card', amountTenderedMinor: 7000 },
  })), { code: 'data_invalid' });
});

test('cart kosong, cancelled, finalized, dan version conflict ditolak', async () => {
  const empty = await setup({
    cart: draft({ subtotalMinor: 0, grandTotalMinor: 0, lineCount: 0 }),
    lines: [],
  });
  await assert.rejects(empty.service.finalize(command({ stockMovementIds: [] })), { code: 'empty_cart' });
  for (const [status, code] of [['cancelled', 'cart_cancelled'], ['finalized', 'cart_already_finalized']]) {
    const fixture = await setup({ cart: draft({ status }) });
    await assert.rejects(fixture.service.finalize(command()), { code });
  }
  const conflict = await setup();
  await assert.rejects(conflict.service.finalize(command({ expectedCartVersion: 2 })), { code: 'version_conflict' });
});

test('produk missing/inactive, harga berubah, dan stok kurang ditolak tanpa sale', async () => {
  const missing = await setup({ trackedProduct: null, stock: null });
  await assert.rejects(missing.service.finalize(command()), { code: 'invalid_reference' });
  const inactive = await setup({ trackedProduct: product(TRACKED, { active: false }) });
  await assert.rejects(inactive.service.finalize(command()), { code: 'inactive_product' });
  const changed = await setup({ trackedProduct: product(TRACKED, { sellingPriceMinor: 6000 }) });
  await assert.rejects(changed.service.finalize(command()), { code: 'price_changed' });
  const insufficient = await setup({ stock: null });
  await assert.rejects(insufficient.service.finalize(command()), { code: 'insufficient_local_stock' });
  assert.equal(await insufficient.memory.saleRepository.get(ACCOUNT, WORKSPACE, SALE), null);
});

test('retry operationId sama idempotent dan payload berbeda ditolak', async () => {
  const { service } = await setup();
  assert.equal((await service.finalize(command())).status, 'committed');
  assert.equal((await service.finalize(command())).status, 'duplicate-safe');
  await assert.rejects(service.finalize(command({
    payment: { method: 'cash', amountTenderedMinor: 11000 },
  })), { code: 'idempotency_mismatch' });
});

test('kegagalan audit me-rollback sale, payment, receipt, cart, inventory, dan operation receipt', async () => {
  const fixture = await setup();
  const failingContext = {
    run(storeNames, mode, callback) {
      return fixture.memory.repositoryContext.run(storeNames, mode, (repositories) => callback(Object.freeze({
        ...repositories,
        auditRepository: Object.freeze({
          ...repositories.auditRepository,
          append: async () => { throw new Error('injected'); },
        }),
      })));
    },
  };
  const service = createSaleFinalizationService({
    repositoryContext: failingContext,
    digestFactory: (value) => createPayloadDigest(value, webcrypto),
  });
  await assert.rejects(service.finalize(command()), { code: 'transaction_aborted' });
  assert.equal(await fixture.memory.saleRepository.get(ACCOUNT, WORKSPACE, SALE), null);
  assert.equal((await fixture.memory.cartRepository.get(ACCOUNT, WORKSPACE, CART)).status, 'draft');
  assert.equal((await fixture.memory.inventoryRepository.getBalance(ACCOUNT, WORKSPACE, TRACKED)).quantityOnHand, 3);
  assert.equal(await fixture.memory.operationReceiptRepository.getByOperationId(ACCOUNT, OPERATION), null);
});

test('IndexedDB parity menyimpan bundle final dan mempertahankannya setelah reopen', async () => {
  const indexedDBFactory = new IDBFactory();
  const databaseName = 'sale-finalization-indexed-parity';
  let connection = await openMandiriDatabase({ indexedDBFactory, keyRangeFactory: IDBKeyRange, databaseName });
  let context = createRepositoryContext(connection);
  await context.run(ATOMIC_SALE_STORE_NAMES, 'readwrite', async (repositories) => {
    await repositories.membershipRepository.add(ACCOUNT, WORKSPACE, {
      version: 1, membershipId: 'membership_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      accountScope: ACCOUNT, workspaceId: WORKSPACE, userScope: 'user_scope_actor',
      role: 'merchant_owner', status: 'active', createdAtLocal: AT, updatedAtLocal: AT,
    });
    await repositories.productRepository.create(ACCOUNT, WORKSPACE, product(TRACKED));
    await repositories.productRepository.create(ACCOUNT, WORKSPACE, product(UNTRACKED));
    await repositories.inventoryRepository.appendMovement(
      ACCOUNT, WORKSPACE,
      {
        schemaVersion: 1, movementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        workspaceId: WORKSPACE, productId: TRACKED, movementType: 'opening_stock',
        quantityDelta: 3, reason: null, actorScope: 'user_scope_actor',
        actorRole: 'merchant_owner', sourceReference: 'opening',
        operationId: 'op_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        createdAtLocal: '2026-07-23T05:00:00.000Z',
      },
      {
        schemaVersion: 1, version: 1, workspaceId: WORKSPACE, productId: TRACKED,
        quantityOnHand: 3, lastMovementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        updatedAtLocal: '2026-07-23T05:00:00.000Z',
      },
      0,
    );
    await repositories.cartRepository.create(
      ACCOUNT, WORKSPACE, draft(), [line(TRACKED, 1), line(UNTRACKED, 2)],
    );
  });
  const service = createSaleFinalizationService({
    repositoryContext: context,
    digestFactory: (value) => createPayloadDigest(value, webcrypto),
  });
  assert.equal((await service.finalize(command())).status, 'committed');
  connection.close();
  connection = await openMandiriDatabase({ indexedDBFactory, keyRangeFactory: IDBKeyRange, databaseName });
  context = createRepositoryContext(connection);
  const persisted = await context.run(ATOMIC_SALE_STORE_NAMES, 'readonly', (repositories) => (
    repositories.saleRepository.get(ACCOUNT, WORKSPACE, SALE)
  ));
  assert.equal(persisted.payment.changeMinor, 3000);
  assert.equal(persisted.receipt.lines.length, 2);
  connection.close();
});
