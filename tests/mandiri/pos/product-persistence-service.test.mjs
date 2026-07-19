import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createProductPersistenceService } from '../../../assets/js/mandiri/pos/services/product-persistence-service.js';

const ACCOUNT = 'account_scope_a';
const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';
const CATEGORY = 'category_33333333-3333-4333-8333-333333333333';
const PRODUCT_A = 'product_44444444-4444-4444-8444-444444444444';
const PRODUCT_B = 'product_55555555-5555-4555-8555-555555555555';
const AT = '2026-07-20T00:00:00.000Z';
const digestFactory = (value) => createPayloadDigest(value, webcrypto);

function command(operationType, entity, overrides = {}) {
  return {
    schemaVersion: 1,
    accountScope: ACCOUNT,
    workspaceId: WORKSPACE,
    actorScope: 'user_scope_owner',
    actorRole: 'merchant_owner',
    operationId: 'op_66666666-6666-4666-8666-666666666666',
    eventId: 'audit_77777777-7777-4777-8777-777777777777',
    operationType,
    createdAtLocal: AT,
    entity,
    ...overrides,
  };
}

const category = () => ({
  version: 1, categoryId: CATEGORY, workspaceId: WORKSPACE, name: 'Minuman', active: true,
});
const product = (overrides = {}) => ({
  version: 1,
  productId: PRODUCT_A,
  workspaceId: WORKSPACE,
  name: 'Teh',
  sku: 'TEH-1',
  categoryId: CATEGORY,
  sellingPriceMinor: 5000,
  purchasePriceMinor: null,
  stockTracking: true,
  active: true,
  ...overrides,
});

test('create atomik menghasilkan entity, audit, receipt, dan retry idempotent', async () => {
  const memory = createMemoryRepositories();
  const service = createProductPersistenceService({ repositoryContext: memory.repositoryContext, digestFactory });
  const categoryCommand = command('category_create', category());
  const first = await service.execute(categoryCommand);
  const retry = await service.execute(categoryCommand);
  assert.equal(first.status, 'committed');
  assert.equal(retry.status, 'duplicate-safe');
  assert.equal((await memory.auditRepository.listByOperation(ACCOUNT, categoryCommand.operationId)).length, 1);
  assert.ok(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, categoryCommand.operationId));
});

test('duplicate SKU dan reference invalid rollback tanpa audit atau receipt parsial', async () => {
  const memory = createMemoryRepositories();
  const service = createProductPersistenceService({ repositoryContext: memory.repositoryContext, digestFactory });
  await service.execute(command('category_create', category()));
  const first = command('product_create', product(), {
    operationId: 'op_88888888-8888-4888-8888-888888888888',
    eventId: 'audit_99999999-9999-4999-8999-999999999999',
  });
  await service.execute(first);
  const duplicate = command('product_create', product({ productId: PRODUCT_B, sku: 'teh-1' }), {
    operationId: 'op_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    eventId: 'audit_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  });
  await assert.rejects(service.execute(duplicate), { code: 'duplicate_sku' });
  assert.equal(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, duplicate.operationId), null);
  assert.deepEqual(await memory.auditRepository.listByOperation(ACCOUNT, duplicate.operationId), []);

  const invalid = command('product_create', product({
    productId: PRODUCT_B,
    sku: 'OTHER',
    categoryId: 'category_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  }), {
    operationId: 'op_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    eventId: 'audit_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  });
  await assert.rejects(service.execute(invalid), { code: 'invalid_reference' });
  assert.equal(await memory.productRepository.get(ACCOUNT, WORKSPACE, PRODUCT_B), null);
});

test('update version conflict rollback dan operationId payload berbeda ditolak', async () => {
  const memory = createMemoryRepositories();
  const service = createProductPersistenceService({ repositoryContext: memory.repositoryContext, digestFactory });
  const create = command('category_create', category());
  await service.execute(create);
  await assert.rejects(service.execute({ ...create, entity: { ...category(), name: 'Berbeda' } }), {
    code: 'idempotency_mismatch',
  });
  const update = command('category_update', { ...category(), version: 2, name: 'Baru' }, {
    expectedVersion: 2,
    operationId: 'op_ffffffff-ffff-4fff-8fff-ffffffffffff',
    eventId: 'audit_12121212-1212-4212-8212-121212121212',
  });
  await assert.rejects(service.execute(update), { code: 'version_conflict' });
  assert.equal((await memory.categoryRepository.get(ACCOUNT, WORKSPACE, CATEGORY)).name, 'Minuman');
  assert.equal(await memory.operationReceiptRepository.getByOperationId(ACCOUNT, update.operationId), null);
});
