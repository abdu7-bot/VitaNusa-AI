import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { createMembershipRepository } from '../../../assets/js/mandiri/repositories/membership-repository.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createProductRepository } from '../../../assets/js/mandiri/pos/repositories/product-repository.js';
import { createInventoryRepository } from '../../../assets/js/mandiri/pos/repositories/inventory-repository.js';
import { createSaleRepository } from '../../../assets/js/mandiri/pos/repositories/sale-repository.js';
import { createCashSessionRepository } from '../../../assets/js/mandiri/pos/repositories/cash-session-repository.js';
import { createSaleReversalRepository } from '../../../assets/js/mandiri/pos/repositories/sale-reversal-repository.js';
import { createSaleReversalService } from '../../../assets/js/mandiri/pos/services/sale-reversal-service.js';

const ACCOUNT = 'account_scope_a';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const USER = 'user_scope_owner';
const PRODUCT = 'product_22222222-2222-4222-8222-222222222222';
const SALE = 'sale_33333333-3333-4333-8333-333333333333';
const PAYMENT = 'payment_44444444-4444-4444-8444-444444444444';
const RECEIPT = 'receipt_55555555-5555-4555-8555-555555555555';
const CASH_SESSION = 'cashsession_66666666-6666-4666-8666-666666666666';
const REVERSAL = 'reversal_77777777-7777-4777-8777-777777777777';
const VOID_OPERATION = 'op_88888888-8888-4888-8888-888888888888';
const VOID_EVENT = 'audit_99999999-9999-4999-8999-999999999999';
const VOID_MOVEMENT = 'movement_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OPENED_AT = '2026-07-26T06:00:00.000Z';
const SALE_AT = '2026-07-26T06:10:00.000Z';
const VOID_AT = '2026-07-26T06:20:00.000Z';

function command(overrides = {}) {
  return {
    schemaVersion: 1,
    accountScope: ACCOUNT,
    workspaceId: WORKSPACE,
    actorScope: USER,
    actorRole: 'merchant_owner',
    operationId: VOID_OPERATION,
    eventId: VOID_EVENT,
    reversalId: REVERSAL,
    originalSaleId: SALE,
    cashSessionId: CASH_SESSION,
    stockMovementIds: [VOID_MOVEMENT],
    reasonCode: 'operator_error',
    reasonNote: 'Salah memasukkan transaksi',
    createdAtLocal: VOID_AT,
    ...overrides,
  };
}

async function setup({ role = 'merchant_owner', closeSession = false } = {}) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: `sale-reversal-${role}-${closeSession}-${crypto.randomUUID()}`,
  });
  const membershipRepository = createMembershipRepository({ connection });
  const productRepository = createProductRepository({ connection });
  const inventoryRepository = createInventoryRepository({ connection });
  const saleRepository = createSaleRepository({ connection });
  const cashSessionRepository = createCashSessionRepository({ connection });
  const saleReversalRepository = createSaleReversalRepository({ connection });

  await membershipRepository.add(ACCOUNT, WORKSPACE, {
    version: 1,
    membershipId: 'membership_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    accountScope: ACCOUNT,
    workspaceId: WORKSPACE,
    userScope: USER,
    role,
    status: 'active',
    createdAtLocal: OPENED_AT,
    updatedAtLocal: OPENED_AT,
  });
  await productRepository.create(ACCOUNT, WORKSPACE, {
    version: 1,
    productId: PRODUCT,
    workspaceId: WORKSPACE,
    name: 'Produk tracked',
    sku: null,
    categoryId: null,
    sellingPriceMinor: 5000,
    purchasePriceMinor: 3000,
    stockTracking: true,
    active: true,
  });
  await inventoryRepository.appendMovement(
    ACCOUNT,
    WORKSPACE,
    {
      schemaVersion: 1,
      movementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspaceId: WORKSPACE,
      productId: PRODUCT,
      movementType: 'opening_stock',
      quantityDelta: 10,
      reason: null,
      actorScope: USER,
      actorRole: role,
      sourceReference: 'opening',
      operationId: 'op_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      createdAtLocal: OPENED_AT,
    },
    {
      schemaVersion: 1,
      version: 1,
      workspaceId: WORKSPACE,
      productId: PRODUCT,
      quantityOnHand: 10,
      lastMovementId: 'movement_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      updatedAtLocal: OPENED_AT,
    },
    0,
  );
  await cashSessionRepository.create(ACCOUNT, WORKSPACE, {
    schemaVersion: 1,
    version: 1,
    cashSessionId: CASH_SESSION,
    workspaceId: WORKSPACE,
    status: 'open',
    openingCashMinor: 100000,
    openedByScope: USER,
    openedByRole: role,
    openOperationId: 'op_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    openedAtLocal: OPENED_AT,
    closedByScope: null,
    closedByRole: null,
    closeOperationId: null,
    closedAtLocal: null,
    closingSummary: null,
    updatedAtLocal: OPENED_AT,
  });
  if (closeSession) {
    await cashSessionRepository.update(ACCOUNT, WORKSPACE, {
      schemaVersion: 1,
      version: 2,
      cashSessionId: CASH_SESSION,
      workspaceId: WORKSPACE,
      status: 'closed',
      openingCashMinor: 100000,
      openedByScope: USER,
      openedByRole: role,
      openOperationId: 'op_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      openedAtLocal: OPENED_AT,
      closedByScope: USER,
      closedByRole: role,
      closeOperationId: 'op_ffffffff-ffff-4fff-8fff-ffffffffffff',
      closedAtLocal: '2026-07-26T06:15:00.000Z',
      closingSummary: {
        openingCashMinor: 100000,
        cashSalesMinor: 10000,
        expenseOutMinor: 0,
        expectedCashMinor: 110000,
        countedCashMinor: 110000,
        differenceMinor: 0,
      },
      updatedAtLocal: '2026-07-26T06:15:00.000Z',
    }, 1);
  }

  const saleLines = [1, 2].map((lineNo) => ({
    schemaVersion: 1,
    saleId: SALE,
    lineNo,
    productId: PRODUCT,
    productNameSnapshot: 'Produk tracked',
    skuSnapshot: null,
    quantityScaled: 1,
    quantityScale: 1,
    unitPriceMinor: 5000,
    lineDiscountMinor: 0,
    lineGrossMinor: 5000,
    lineSubtotalMinor: 5000,
    stockTrackingSnapshot: true,
  }));
  await saleRepository.appendFinal(
    ACCOUNT,
    WORKSPACE,
    {
      schemaVersion: 1,
      saleId: SALE,
      workspaceId: WORKSPACE,
      cartId: 'cart_12121212-1212-4212-8212-121212121212',
      cartVersion: 1,
      status: 'final',
      currencyCode: 'IDR',
      discountMinor: 0,
      subtotalMinor: 10000,
      grandTotalMinor: 10000,
      lineCount: 2,
      paymentId: PAYMENT,
      receiptId: RECEIPT,
      operationId: 'op_13131313-1313-4313-8313-131313131313',
      actorScope: USER,
      actorRole: role,
      finalizedAtLocal: SALE_AT,
    },
    saleLines,
    {
      schemaVersion: 1,
      paymentId: PAYMENT,
      workspaceId: WORKSPACE,
      saleId: SALE,
      method: 'cash',
      status: 'recorded',
      currencyCode: 'IDR',
      amountDueMinor: 10000,
      amountTenderedMinor: 10000,
      amountAppliedMinor: 10000,
      changeMinor: 0,
      operationId: 'op_13131313-1313-4313-8313-131313131313',
      actorScope: USER,
      actorRole: role,
      recordedAtLocal: SALE_AT,
    },
    {
      schemaVersion: 1,
      receiptId: RECEIPT,
      workspaceId: WORKSPACE,
      saleId: SALE,
      paymentId: PAYMENT,
      currencyCode: 'IDR',
      subtotalMinor: 10000,
      discountMinor: 0,
      grandTotalMinor: 10000,
      amountTenderedMinor: 10000,
      changeMinor: 0,
      paymentMethod: 'cash',
      lineCount: 2,
      lines: saleLines,
      finalizedAtLocal: SALE_AT,
    },
  );
  await inventoryRepository.appendMovement(
    ACCOUNT,
    WORKSPACE,
    {
      schemaVersion: 1,
      movementId: 'movement_14141414-1414-4414-8414-141414141414',
      workspaceId: WORKSPACE,
      productId: PRODUCT,
      movementType: 'sale',
      quantityDelta: -2,
      reason: null,
      actorScope: USER,
      actorRole: role,
      sourceReference: SALE,
      operationId: 'op_14141414-1414-4414-8414-141414141414',
      createdAtLocal: SALE_AT,
    },
    {
      schemaVersion: 1,
      version: 2,
      workspaceId: WORKSPACE,
      productId: PRODUCT,
      quantityOnHand: 8,
      lastMovementId: 'movement_14141414-1414-4414-8414-141414141414',
      updatedAtLocal: SALE_AT,
    },
    1,
  );

  const context = createRepositoryContext(connection);
  const service = createSaleReversalService({
    repositoryContext: context,
    digestFactory: (value) => createPayloadDigest(value, webcrypto),
  });
  return {
    connection,
    context,
    inventoryRepository,
    saleRepository,
    saleReversalRepository,
    service,
  };
}

test('owner void atomik, Sale tetap immutable, dan stok tracked dipulihkan teragregasi', async (t) => {
  const fixture = await setup();
  t.after(() => fixture.connection.close());
  const before = await fixture.saleRepository.get(ACCOUNT, WORKSPACE, SALE);
  const result = await fixture.service.voidSale(command());
  const after = await fixture.saleRepository.get(ACCOUNT, WORKSPACE, SALE);

  assert.equal(result.status, 'committed');
  assert.deepEqual(after, before);
  assert.equal(result.reversal.originalSaleId, SALE);
  assert.equal(result.reversal.paymentId, PAYMENT);
  assert.equal(result.reversal.reversedAmountMinor, 10000);
  assert.equal(result.stockReversals.length, 1);
  assert.equal(result.stockReversals[0].movement.quantityDelta, 2);
  assert.equal((await fixture.inventoryRepository.getBalance(
    ACCOUNT, WORKSPACE, PRODUCT,
  )).quantityOnHand, 10);
  assert.equal((await fixture.inventoryRepository.listMovements(
    ACCOUNT, WORKSPACE, PRODUCT,
  )).filter((item) => item.movementType === 'void_reversal').length, 1);
});

test('retry command sama duplicate-safe dan payload berbeda ditolak', async (t) => {
  const fixture = await setup();
  t.after(() => fixture.connection.close());
  assert.equal((await fixture.service.voidSale(command())).status, 'committed');
  assert.equal((await fixture.service.voidSale(command())).status, 'duplicate-safe');
  await assert.rejects(fixture.service.voidSale(command({
    reasonCode: 'wrong_amount',
  })), { code: 'idempotency_mismatch' });
  assert.equal((await fixture.saleReversalRepository.listByWorkspace(
    ACCOUNT, WORKSPACE,
  )).length, 1);
  assert.equal((await fixture.inventoryRepository.listMovements(
    ACCOUNT, WORKSPACE, PRODUCT,
  )).filter((item) => item.movementType === 'void_reversal').length, 1);
});

test('cashier ditolak dan CashSession closed tidak dapat menerima void normal', async (t) => {
  const cashier = await setup({ role: 'cashier' });
  t.after(() => cashier.connection.close());
  await assert.rejects(cashier.service.voidSale(command({ actorRole: 'cashier' })), {
    code: 'data_invalid',
  });

  const closed = await setup({ closeSession: true });
  t.after(() => closed.connection.close());
  await assert.rejects(closed.service.voidSale(command()), { code: 'cash_session_closed' });
});

test('Sale yang sudah void tidak dapat di-void dengan operation baru', async (t) => {
  const fixture = await setup();
  t.after(() => fixture.connection.close());
  await fixture.service.voidSale(command());
  await assert.rejects(fixture.service.voidSale(command({
    reversalId: 'reversal_15151515-1515-4515-8515-151515151515',
    operationId: 'op_16161616-1616-4616-8616-161616161616',
    eventId: 'audit_17171717-1717-4717-8717-171717171717',
    stockMovementIds: ['movement_18181818-1818-4818-8818-181818181818'],
  })), { code: 'sale_immutable' });
});

test('kegagalan audit me-rollback reversal, stok, dan receipt', async (t) => {
  const fixture = await setup();
  t.after(() => fixture.connection.close());
  const failingContext = {
    run(storeNames, mode, callback) {
      return fixture.context.run(storeNames, mode, (repositories) => callback(Object.freeze({
        ...repositories,
        auditRepository: Object.freeze({
          ...repositories.auditRepository,
          append: async () => { throw new Error('injected audit failure'); },
        }),
      })));
    },
  };
  const service = createSaleReversalService({
    repositoryContext: failingContext,
    digestFactory: (value) => createPayloadDigest(value, webcrypto),
  });

  await assert.rejects(service.voidSale(command()), { code: 'transaction_aborted' });
  assert.equal(await fixture.saleReversalRepository.getBySale(ACCOUNT, WORKSPACE, SALE), null);
  assert.equal((await fixture.inventoryRepository.getBalance(
    ACCOUNT, WORKSPACE, PRODUCT,
  )).quantityOnHand, 8);
  assert.equal((await fixture.inventoryRepository.listMovements(
    ACCOUNT, WORKSPACE, PRODUCT,
  )).filter((item) => item.movementType === 'void_reversal').length, 0);
});
