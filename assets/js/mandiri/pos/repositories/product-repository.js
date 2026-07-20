import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { MandiriStorageError, storageError } from '../../storage/storage-errors.js';
import {
  createRepositoryExecutor,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import {
  normalizeScopedProduct,
  publicProduct,
} from './pos-repository-utils.js';

const CATEGORY_STORE = MANDIRI_STORE_NAMES.CATEGORIES;
const PRODUCT_STORE = MANDIRI_STORE_NAMES.PRODUCTS;
const STORE_NAMES = Object.freeze([CATEGORY_STORE, PRODUCT_STORE]);

async function assertCategoryReference(transaction, record) {
  if (record.categoryId === null) return;
  const category = await transaction.request(transaction.objectStore(CATEGORY_STORE).get([
    record.accountScope,
    record.workspaceId,
    record.categoryId,
  ]));
  if (category === undefined) throw storageError('invalid_reference');
}

async function findBySku(transaction, record) {
  if (record.sku === null) return null;
  const index = transaction.objectStore(PRODUCT_STORE).index('byWorkspaceSku');
  return transaction.request(index.get([
    record.accountScope,
    record.workspaceId,
    record.sku,
  ]));
}

async function writeProduct(transaction, method, record) {
  const store = transaction.objectStore(PRODUCT_STORE);
  try {
    await transaction.request(store[method](record));
  } catch (error) {
    if (record.sku !== null && error instanceof MandiriStorageError && error.code === 'constraint_violation') {
      throw storageError('duplicate_sku', error);
    }
    throw error;
  }
}

export function createProductRepository(options) {
  const executor = createRepositoryExecutor(options);
  return Object.freeze({
    async create(explicitAccountScope, explicitWorkspaceId, input) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedProduct(accountScope, workspaceId, input);
      return executor.run(STORE_NAMES, 'readwrite', async (transaction) => {
        const store = transaction.objectStore(PRODUCT_STORE);
        const existing = await transaction.request(store.get([
          accountScope, workspaceId, record.productId,
        ]));
        if (existing !== undefined) throw storageError('constraint_violation');
        await assertCategoryReference(transaction, record);
        const skuOwner = await findBySku(transaction, record);
        if (skuOwner !== undefined && skuOwner !== null) throw storageError('duplicate_sku');
        await writeProduct(transaction, 'add', record);
        return publicProduct(record);
      });
    },

    async update(explicitAccountScope, explicitWorkspaceId, input, expectedVersion) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedProduct(accountScope, workspaceId, input);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw storageError('data_invalid');
      }
      return executor.run(STORE_NAMES, 'readwrite', async (transaction) => {
        const store = transaction.objectStore(PRODUCT_STORE);
        const key = [accountScope, workspaceId, record.productId];
        const current = await transaction.request(store.get(key));
        if (current === undefined) throw storageError('record_not_found');
        if (current.version !== expectedVersion || record.version !== expectedVersion + 1) {
          throw storageError('version_conflict');
        }
        await assertCategoryReference(transaction, record);
        const skuOwner = await findBySku(transaction, record);
        if (skuOwner && skuOwner.productId !== record.productId) throw storageError('duplicate_sku');
        await writeProduct(transaction, 'put', record);
        return publicProduct(record);
      });
    },

    async get(explicitAccountScope, explicitWorkspaceId, productIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const productId = normalizeEntityIdentifier(productIdValue, 'product');
      return executor.run([PRODUCT_STORE], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(PRODUCT_STORE).get([accountScope, workspaceId, productId]),
        );
        return value === undefined ? null : publicProduct(value);
      });
    },

    async list(explicitAccountScope, explicitWorkspaceId) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run([PRODUCT_STORE], 'readonly', async (transaction) => {
        const index = transaction.objectStore(PRODUCT_STORE).index('byWorkspace');
        const records = await transaction.request(index.getAll(keyRangeOnly(
          transaction,
          [accountScope, workspaceId],
        )));
        return Object.freeze(records.map(publicProduct).sort((a, b) => a.name.localeCompare(b.name)));
      });
    },
  });
}
