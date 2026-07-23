import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createCartRepository } from '../../../assets/js/mandiri/pos/repositories/cart-repository.js';
import { createProductRepository } from '../../../assets/js/mandiri/pos/repositories/product-repository.js';
import { normalizeCartDraft, normalizeCartLine, previewCartDraft } from '../../../assets/js/mandiri/pos/domain/cart.js';
import { createCartService } from '../../../assets/js/mandiri/pos/services/cart-service.js';

const ACCOUNT = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const CART = 'cart_33333333-3333-4333-8333-333333333333';
const PRODUCT = 'product_44444444-4444-4444-8444-444444444444';
const OPERATION = 'op_55555555-5555-4555-8555-555555555555';
const EVENT = 'audit_66666666-6666-4666-8666-666666666666';
const AT = '2026-07-23T00:00:00.000Z';

const line = (overrides = {}) => ({
  schemaVersion: 1, cartId: CART, lineNo: 1, productId: PRODUCT,
  productNameSnapshot: 'Teh', skuSnapshot: 'TEH-1', quantityScaled: 2,
  quantityScale: 1, unitPriceMinor: 5000, lineDiscountMinor: 1000,
  lineGrossMinor: 10000, lineSubtotalMinor: 9000, ...overrides,
});
const draft = (overrides = {}) => ({
  schemaVersion: 1, version: 1, cartId: CART, workspaceId: WORKSPACE,
  status: 'draft', currencyCode: 'IDR', discountMinor: 500,
  subtotalMinor: 9000, grandTotalMinor: 8500, lineCount: 1,
  createdAtLocal: AT, updatedAtLocal: AT, ...overrides,
});
const product = (overrides = {}) => ({
  version: 1, productId: PRODUCT, workspaceId: WORKSPACE, name: 'Teh', sku: 'TEH-1',
  categoryId: null, sellingPriceMinor: 5000, purchasePriceMinor: null,
  stockTracking: false, active: true, ...overrides,
});

test('CartLine dan CartDraft valid immutable dengan kalkulasi uang konsisten', () => {
  const normalizedLine = normalizeCartLine(line());
  const normalizedDraft = normalizeCartDraft(draft(), { workspaceId: WORKSPACE });
  const preview = previewCartDraft(normalizedDraft, [normalizedLine]);
  assert.equal(preview.subtotalMinor, 9000);
  assert.equal(preview.grandTotalMinor, 8500);
  assert.equal(Object.isFrozen(normalizedLine), true);
  assert.equal(Object.isFrozen(normalizedDraft), true);
  assert.equal(Object.isFrozen(preview.lines), true);
});

test('Cart domain menolak unknown field, quantity, snapshot, diskon, dan overflow', () => {
  assert.throws(() => normalizeCartLine({ ...line(), unknown: true }));
  assert.throws(() => normalizeCartLine(line({ quantityScaled: 1.5 })));
  assert.throws(() => normalizeCartLine(line({ lineGrossMinor: 9999 })));
  assert.throws(() => normalizeCartLine(line({ lineDiscountMinor: 10001 })));
  assert.throws(() => normalizeCartDraft(draft({ grandTotalMinor: 1 })));
  const maximumLine = line({
    quantityScaled: 1, unitPriceMinor: Number.MAX_SAFE_INTEGER,
    lineDiscountMinor: 0, lineGrossMinor: Number.MAX_SAFE_INTEGER,
    lineSubtotalMinor: Number.MAX_SAFE_INTEGER,
  });
  assert.throws(() => previewCartDraft(
    draft({ discountMinor: 0, subtotalMinor: 0, grandTotalMinor: 0, lineCount: 2 }),
    [maximumLine, { ...maximumLine, lineNo: 2 }],
  ), { code: 'money_overflow' });
});

async function indexed(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(), keyRangeFactory: IDBKeyRange, databaseName: name,
  });
  return {
    connection,
    cartRepository: createCartRepository({ connection }),
    productRepository: createProductRepository({ connection }),
  };
}

for (const [label, fixture] of [['IndexedDB', indexed], ['Memory', async () => createMemoryRepositories()]]) {
  test(`${label}: cart repository create/update/get/list ter-scope dan immutable`, async () => {
    const value = await fixture(`cart-repository-${label}`);
    assert.deepEqual(Object.keys(value.cartRepository), ['create', 'update', 'get', 'list', 'listLines']);
    const created = await value.cartRepository.create(ACCOUNT, WORKSPACE, draft(), [line()]);
    assert.equal(created.lines.length, 1);
    assert.equal(Object.hasOwn(created.lines[0], 'accountScope'), false);
    assert.equal(Object.hasOwn(created.lines[0], 'workspaceId'), false);
    assert.equal((await value.cartRepository.list(ACCOUNT, WORKSPACE)).length, 1);
    assert.equal(await value.cartRepository.get(ACCOUNT_B, WORKSPACE, CART), null);
    assert.equal(await value.cartRepository.get(ACCOUNT, WORKSPACE_B, CART), null);
    const updated = await value.cartRepository.update(
      ACCOUNT, WORKSPACE,
      draft({ version: 2, discountMinor: 0, grandTotalMinor: 9000, updatedAtLocal: '2026-07-23T00:01:00.000Z' }),
      [line()], 1,
    );
    assert.equal(updated.version, 2);
    await assert.rejects(value.cartRepository.update(
      ACCOUNT, WORKSPACE, draft({ version: 3 }), [line()], 1,
    ), { code: 'version_conflict' });
    value.connection?.close();
  });

  test(`${label}: duplicate line rollback dan repository tidak menyediakan delete/global dump`, async () => {
    const value = await fixture(`cart-rollback-${label}`);
    await assert.rejects(value.cartRepository.create(
      ACCOUNT, WORKSPACE, draft({ lineCount: 2, subtotalMinor: 18000, grandTotalMinor: 17500 }),
      [line(), line()],
    ), { code: 'data_invalid' });
    assert.equal(await value.cartRepository.get(ACCOUNT, WORKSPACE, CART), null);
    for (const method of ['delete', 'getAll', 'listAll', 'dump']) {
      assert.equal(value.cartRepository[method], undefined);
    }
    value.connection?.close();
  });

  test(`${label}: CartLine wajib terikat ke CartDraft pada scope yang sama`, async () => {
    const value = await fixture(`cart-line-integrity-${label}`);
    await assert.rejects(value.cartRepository.create(
      ACCOUNT,
      WORKSPACE,
      draft(),
      [line({ cartId: 'cart_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })],
    ), { code: 'data_invalid' });
    assert.equal(await value.cartRepository.get(ACCOUNT, WORKSPACE, CART), null);
    value.connection?.close();
  });
}

test('CartLine persistence menyimpan scope pada keyPath tetapi public line membuang scope', async () => {
  const value = await indexed('cart-line-scope');
  await value.cartRepository.create(ACCOUNT, WORKSPACE, draft(), [line()]);
  const raw = await value.connection.runTransaction(['cartLines'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('cartLines').get([ACCOUNT, WORKSPACE, CART, 1]))
  ));
  assert.equal(raw.accountScope, ACCOUNT);
  assert.equal(raw.workspaceId, WORKSPACE);
  const publicLine = (await value.cartRepository.listLines(ACCOUNT, WORKSPACE, CART))[0];
  assert.equal(Object.hasOwn(publicLine, 'accountScope'), false);
  assert.equal(Object.hasOwn(publicLine, 'workspaceId'), false);
  value.connection.close();
});

async function serviceFixture(role = 'merchant_owner', productOverrides = {}) {
  const memory = createMemoryRepositories();
  await memory.membershipRepository.add(ACCOUNT, WORKSPACE, {
    version: 1, membershipId: 'membership_77777777-7777-4777-8777-777777777777',
    accountScope: ACCOUNT, workspaceId: WORKSPACE, userScope: 'user_scope_actor', role,
    status: 'active', createdAtLocal: AT, updatedAtLocal: AT,
  });
  await memory.productRepository.create(ACCOUNT, WORKSPACE, product(productOverrides));
  return {
    memory,
    service: createCartService({
      repositoryContext: memory.repositoryContext,
      digestFactory: (value) => createPayloadDigest(value, webcrypto),
    }),
  };
}

function command(overrides = {}) {
  return {
    schemaVersion: 1, accountScope: ACCOUNT, workspaceId: WORKSPACE,
    actorScope: 'user_scope_actor', actorRole: 'merchant_owner', operationId: OPERATION,
    eventId: EVENT, operationType: 'cart_create', createdAtLocal: AT,
    entity: { cartId: CART, discountMinor: 500, lines: [{ productId: PRODUCT, quantity: 2, lineDiscountMinor: 1000 }] },
    ...overrides,
  };
}

test('CartService membuat draft dan sale preview tanpa Sale committed serta retry idempotent', async () => {
  const { memory, service } = await serviceFixture();
  const first = await service.execute(command());
  const retry = await service.execute(command());
  assert.equal(first.status, 'committed');
  assert.equal(retry.status, 'duplicate-safe');
  assert.equal(first.salePreview.grandTotalMinor, 8500);
  assert.equal((await memory.cartRepository.list(ACCOUNT, WORKSPACE)).length, 1);
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, OPERATION)).length, 1);
  assert.equal(await memory.saleRepository.get(
    ACCOUNT, WORKSPACE, 'sale_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ), null);
});

test('CartService update memakai expectedVersion dan mendeteksi perubahan harga', async () => {
  const { memory, service } = await serviceFixture();
  await service.execute(command());
  await memory.productRepository.update(ACCOUNT, WORKSPACE, product({ version: 2, sellingPriceMinor: 6000 }), 1);
  const update = command({
    operationType: 'cart_update', expectedVersion: 1,
    operationId: 'op_88888888-8888-4888-8888-888888888888',
    eventId: 'audit_99999999-9999-4999-8999-999999999999',
    createdAtLocal: '2026-07-23T00:01:00.000Z',
  });
  await assert.rejects(service.execute(update), { code: 'price_changed' });
  assert.equal((await memory.cartRepository.get(ACCOUNT, WORKSPACE, CART)).version, 1);
});

test('CartService memeriksa version sebelum membaca product pada update', async () => {
  const { memory, service } = await serviceFixture();
  await service.execute(command());
  await assert.rejects(service.execute(command({
    operationType: 'cart_update',
    expectedVersion: 2,
    operationId: 'op_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    eventId: 'audit_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  })), { code: 'version_conflict' });
  assert.equal((await memory.cartRepository.get(ACCOUNT, WORKSPACE, CART)).version, 1);
});

test('CartService menolak payload idempotency berbeda, cashier, inactive, empty, dan stok kurang', async () => {
  const owner = await serviceFixture();
  await owner.service.execute(command());
  await assert.rejects(owner.service.execute(command({
    entity: { ...command().entity, discountMinor: 0 },
  })), { code: 'idempotency_mismatch' });

  const cashier = await serviceFixture('cashier');
  await assert.rejects(cashier.service.execute(command({
    actorRole: 'cashier',
  })), { code: 'permission_denied' });
  assert.deepEqual(await cashier.memory.cartRepository.list(ACCOUNT, WORKSPACE), []);

  const inactive = await serviceFixture('merchant_owner', { active: false });
  await assert.rejects(inactive.service.execute(command()), { code: 'inactive_product' });
  const empty = await serviceFixture();
  await assert.rejects(empty.service.execute(command({
    entity: { cartId: CART, discountMinor: 0, lines: [] },
  })), { code: 'empty_cart' });
  const tracked = await serviceFixture('merchant_owner', { stockTracking: true });
  await assert.rejects(tracked.service.execute(command()), { code: 'insufficient_local_stock' });
});

test('CartService rollback atomik saat audit gagal', async () => {
  const { memory, service } = await serviceFixture();
  await memory.auditRepository.append(ACCOUNT, WORKSPACE, {
    schemaVersion: 1, eventId: EVENT, accountScope: ACCOUNT, workspaceId: WORKSPACE,
    actorScope: 'user_scope_actor', actorRole: 'merchant_owner', action: 'fixture',
    entityType: 'product', entityId: PRODUCT,
    operationId: 'op_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    result: 'success', reasonCode: 'none', createdAtLocal: AT,
  });
  await assert.rejects(service.execute(command()), { code: 'constraint_violation' });
  assert.equal(await memory.cartRepository.get(ACCOUNT, WORKSPACE, CART), null);
  assert.equal(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, OPERATION), null);
});
