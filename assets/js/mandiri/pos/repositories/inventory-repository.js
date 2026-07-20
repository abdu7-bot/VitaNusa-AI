import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  createRepositoryExecutor,
  keyRangeBound,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import {
  normalizeScopedInventoryBalance,
  normalizeScopedStockMovement,
  publicInventoryBalance,
  publicStockMovement,
} from './pos-repository-utils.js';

const MOVEMENTS = MANDIRI_STORE_NAMES.STOCK_MOVEMENTS;
const BALANCES = MANDIRI_STORE_NAMES.INVENTORY_BALANCES;
const PRODUCTS = MANDIRI_STORE_NAMES.PRODUCTS;
const STORES = Object.freeze([MOVEMENTS, BALANCES, PRODUCTS]);

export function createInventoryRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async appendMovement(accountValue, workspaceValue, movementInput, balanceInput, expectedVersion) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const movement = normalizeScopedStockMovement(accountScope, workspaceId, movementInput);
      const balance = normalizeScopedInventoryBalance(accountScope, workspaceId, balanceInput);
      if (movement.productId !== balance.productId || movement.movementId !== balance.lastMovementId) {
        throw storageError('data_invalid');
      }
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw storageError('data_invalid');
      return executor.run(STORES, 'readwrite', async (transaction) => {
        const product = await transaction.request(transaction.objectStore(PRODUCTS).get([
          accountScope, workspaceId, movement.productId,
        ]));
        if (!product) throw storageError('invalid_reference');
        if (product.stockTracking !== true) throw storageError('stock_tracking_disabled');
        const balanceStore = transaction.objectStore(BALANCES);
        const balanceKey = [accountScope, workspaceId, movement.productId];
        const current = await transaction.request(balanceStore.get(balanceKey));
        const currentVersion = current?.version ?? 0;
        const currentQuantity = current?.quantityOnHand ?? 0;
        if (
          currentVersion !== expectedVersion
          || balance.version !== expectedVersion + 1
          || !Number.isSafeInteger(currentQuantity + movement.quantityDelta)
          || balance.quantityOnHand !== currentQuantity + movement.quantityDelta
        ) throw storageError('version_conflict');
        await transaction.request(transaction.objectStore(MOVEMENTS).add(movement));
        await transaction.request(balanceStore.put(balance));
        return Object.freeze({
          movement: publicStockMovement(movement),
          balance: publicInventoryBalance(balance),
        });
      });
    },

    async getBalance(accountValue, workspaceValue, productValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const productId = normalizeEntityIdentifier(productValue, 'product');
      return executor.run([BALANCES], 'readonly', async (transaction) => {
        const value = await transaction.request(transaction.objectStore(BALANCES).get([
          accountScope, workspaceId, productId,
        ]));
        return value ? publicInventoryBalance(value) : null;
      });
    },

    async listBalances(accountValue, workspaceValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([BALANCES], 'readonly', async (transaction) => {
        const records = await transaction.request(transaction.objectStore(BALANCES)
          .index('byWorkspace').getAll(keyRangeOnly(transaction, [accountScope, workspaceId])));
        return Object.freeze(records.map(publicInventoryBalance));
      });
    },

    async listMovements(accountValue, workspaceValue, productValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const productId = normalizeEntityIdentifier(productValue, 'product');
      return executor.run([MOVEMENTS], 'readonly', async (transaction) => {
        const records = await transaction.request(transaction.objectStore(MOVEMENTS)
          .index('byProductCreatedAt').getAll(keyRangeBound(
            transaction,
            [accountScope, workspaceId, productId, ''],
            [accountScope, workspaceId, productId, '\uffff'],
          )));
        return Object.freeze(records.map(publicStockMovement));
      });
    },
  };
  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: async (accountValue, workspaceValue) => {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([MOVEMENTS], 'readonly', async (transaction) => {
        const records = await transaction.request(transaction.objectStore(MOVEMENTS)
          .index('byWorkspaceCreatedAt').getAll(keyRangeBound(
            transaction,
            [accountScope, workspaceId, ''],
            [accountScope, workspaceId, '\uffff'],
          )));
        return Object.freeze(records.map(publicStockMovement));
      });
    },
  });
  return Object.freeze(repository);
}
