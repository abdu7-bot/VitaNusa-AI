import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { createRepositoryContext } from '../../../assets/js/mandiri/repositories/repository-context.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createCategoryRepository } from '../../../assets/js/mandiri/pos/repositories/category-repository.js';
import { createProductRepository } from '../../../assets/js/mandiri/pos/repositories/product-repository.js';

const ACCOUNT_A = 'account_scope_a';
const ACCOUNT_B = 'account_scope_b';
const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const CATEGORY_A = 'category_33333333-3333-4333-8333-333333333333';
const PRODUCT_A = 'product_44444444-4444-4444-8444-444444444444';
const PRODUCT_B = 'product_55555555-5555-4555-8555-555555555555';

const category = (overrides = {}) => ({
  version: 1,
  categoryId: CATEGORY_A,
  workspaceId: WORKSPACE_A,
  name: 'Minuman',
  active: true,
  ...overrides,
});
const product = (overrides = {}) => ({
  version: 1,
  productId: PRODUCT_A,
  workspaceId: WORKSPACE_A,
  name: 'Teh',
  sku: 'TEH-1',
  categoryId: CATEGORY_A,
  sellingPriceMinor: 5000,
  purchasePriceMinor: null,
  stockTracking: true,
  active: true,
  ...overrides,
});

async function indexed(name) {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: name,
  });
  return {
    connection,
    repositoryContext: createRepositoryContext(connection),
    categoryRepository: createCategoryRepository({ connection }),
    productRepository: createProductRepository({ connection }),
  };
}

for (const [label, fixture] of [['IndexedDB', indexed], ['Memory', async () => createMemoryRepositories()]]) {
  test(`${label}: contract create/update/get/list ter-scope tanpa API global atau delete`, async () => {
    const value = await fixture(`pos-contract-${label}`);
    assert.deepEqual(Object.keys(value.categoryRepository), ['create', 'update', 'get', 'list']);
    assert.deepEqual(Object.keys(value.productRepository), ['create', 'update', 'get', 'list']);
    await value.categoryRepository.create(ACCOUNT_A, WORKSPACE_A, category());
    await value.productRepository.create(ACCOUNT_A, WORKSPACE_A, product());
    assert.equal((await value.productRepository.get(ACCOUNT_A, WORKSPACE_A, PRODUCT_A)).name, 'Teh');
    assert.equal((await value.productRepository.list(ACCOUNT_A, WORKSPACE_A)).length, 1);
    assert.equal(await value.productRepository.get(ACCOUNT_B, WORKSPACE_A, PRODUCT_A), null);
    assert.equal(await value.productRepository.get(ACCOUNT_A, WORKSPACE_B, PRODUCT_A), null);
    assert.deepEqual(await value.productRepository.list(ACCOUNT_B, WORKSPACE_A), []);
    value.connection?.close();
  });

  test(`${label}: SKU unik, null jamak, lintas workspace, dan update SKU sendiri`, async () => {
    const value = await fixture(`pos-sku-${label}`);
    await value.categoryRepository.create(ACCOUNT_A, WORKSPACE_A, category());
    await value.categoryRepository.create(ACCOUNT_A, WORKSPACE_B, category({ workspaceId: WORKSPACE_B }));
    await value.productRepository.create(ACCOUNT_A, WORKSPACE_A, product());
    await assert.rejects(value.productRepository.create(
      ACCOUNT_A,
      WORKSPACE_A,
      product({ productId: PRODUCT_B, sku: 'teh-1', name: 'Teh lain' }),
    ), { code: 'duplicate_sku' });
    await value.productRepository.create(
      ACCOUNT_A,
      WORKSPACE_B,
      product({ productId: PRODUCT_B, workspaceId: WORKSPACE_B, sku: 'teh-1' }),
    );
    await value.productRepository.create(
      ACCOUNT_A,
      WORKSPACE_A,
      product({ productId: PRODUCT_B, sku: null, name: 'Tanpa SKU 1' }),
    );
    await value.productRepository.create(
      ACCOUNT_A,
      WORKSPACE_A,
      product({
        productId: 'product_66666666-6666-4666-8666-666666666666',
        sku: null,
        name: 'Tanpa SKU 2',
      }),
    );
    const updated = await value.productRepository.update(
      ACCOUNT_A,
      WORKSPACE_A,
      product({ version: 2, name: 'Teh Baru', sku: 'TEH-1' }),
      1,
    );
    assert.equal(updated.version, 2);
    assert.equal(updated.sku, 'TEH-1');
    value.connection?.close();
  });

  test(`${label}: category reference dan optimistic version conflict rollback`, async () => {
    const value = await fixture(`pos-reference-${label}`);
    await assert.rejects(value.productRepository.create(ACCOUNT_A, WORKSPACE_A, product()), {
      code: 'invalid_reference',
    });
    await value.categoryRepository.create(ACCOUNT_A, WORKSPACE_A, category());
    await value.productRepository.create(ACCOUNT_A, WORKSPACE_A, product());
    await assert.rejects(value.productRepository.update(
      ACCOUNT_A,
      WORKSPACE_A,
      product({ version: 3, name: 'Tidak tersimpan' }),
      2,
    ), { code: 'version_conflict' });
    assert.equal((await value.productRepository.get(ACCOUNT_A, WORKSPACE_A, PRODUCT_A)).name, 'Teh');
    await assert.rejects(value.productRepository.create(
      ACCOUNT_A,
      WORKSPACE_A,
      product({
        productId: PRODUCT_B,
        categoryId: 'category_77777777-7777-4777-8777-777777777777',
      }),
    ), { code: 'invalid_reference' });
    value.connection?.close();
  });
}
