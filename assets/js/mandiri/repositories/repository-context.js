import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import { storageError } from '../storage/storage-errors.js';
import { createAuditRepository } from './audit-repository.js';
import { createMembershipRepository } from './membership-repository.js';
import { createOperationReceiptRepository } from './operation-receipt-repository.js';
import { createWorkspaceRepository } from './workspace-repository.js';
import { createLearningAttemptRepository } from '../learning/repositories/learning-attempt-repository.js';
import { createLearningProgressRepository } from '../learning/repositories/learning-progress-repository.js';
import { createCategoryRepository } from '../pos/repositories/category-repository.js';
import { createCartRepository } from '../pos/repositories/cart-repository.js';
import { createProductRepository } from '../pos/repositories/product-repository.js';
import { createInventoryRepository } from '../pos/repositories/inventory-repository.js';

export const ATOMIC_WORKSPACE_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.WORKSPACES,
  MANDIRI_STORE_NAMES.MEMBERSHIPS,
  MANDIRI_STORE_NAMES.AUDIT_EVENTS,
  MANDIRI_STORE_NAMES.OPERATION_RECEIPTS,
]);

export const ATOMIC_LEARNING_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS,
  MANDIRI_STORE_NAMES.LEARNING_PROGRESS,
]);

export const ATOMIC_PRODUCT_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.CATEGORIES,
  MANDIRI_STORE_NAMES.PRODUCTS,
  MANDIRI_STORE_NAMES.MEMBERSHIPS,
  MANDIRI_STORE_NAMES.AUDIT_EVENTS,
  MANDIRI_STORE_NAMES.OPERATION_RECEIPTS,
]);

export const ATOMIC_CART_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.CART_DRAFTS,
  MANDIRI_STORE_NAMES.CART_LINES,
  MANDIRI_STORE_NAMES.PRODUCTS,
  MANDIRI_STORE_NAMES.INVENTORY_BALANCES,
  MANDIRI_STORE_NAMES.MEMBERSHIPS,
  MANDIRI_STORE_NAMES.AUDIT_EVENTS,
  MANDIRI_STORE_NAMES.OPERATION_RECEIPTS,
]);

export const ATOMIC_INVENTORY_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.PRODUCTS,
  MANDIRI_STORE_NAMES.STOCK_MOVEMENTS,
  MANDIRI_STORE_NAMES.INVENTORY_BALANCES,
  MANDIRI_STORE_NAMES.MEMBERSHIPS,
  MANDIRI_STORE_NAMES.AUDIT_EVENTS,
  MANDIRI_STORE_NAMES.OPERATION_RECEIPTS,
]);

export function createRepositoryContext(connection) {
  if (!connection || typeof connection.runTransaction !== 'function') {
    throw storageError('data_invalid');
  }

  return Object.freeze({
    run(storeNames, mode, callback) {
      if (typeof callback !== 'function') throw storageError('data_invalid');
      return connection.runTransaction(storeNames, mode, async (transactionContext) => {
        const repositories = Object.freeze({
          workspaceRepository: createWorkspaceRepository({ transactionContext }),
          membershipRepository: createMembershipRepository({ transactionContext }),
          auditRepository: createAuditRepository({ transactionContext }),
          operationReceiptRepository: createOperationReceiptRepository({ transactionContext }),
          learningAttemptRepository: createLearningAttemptRepository({ transactionContext }),
          learningProgressRepository: createLearningProgressRepository({ transactionContext }),
          categoryRepository: createCategoryRepository({ transactionContext }),
          cartRepository: createCartRepository({ transactionContext }),
          productRepository: createProductRepository({ transactionContext }),
          inventoryRepository: createInventoryRepository({ transactionContext }),
        });
        return callback(repositories);
      });
    },
  });
}
