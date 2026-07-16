import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import { storageError } from '../storage/storage-errors.js';
import { createAuditRepository } from './audit-repository.js';
import { createMembershipRepository } from './membership-repository.js';
import { createOperationReceiptRepository } from './operation-receipt-repository.js';
import { createWorkspaceRepository } from './workspace-repository.js';

export const ATOMIC_WORKSPACE_STORE_NAMES = Object.freeze([
  MANDIRI_STORE_NAMES.WORKSPACES,
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
        });
        return callback(repositories);
      });
    },
  });
}
