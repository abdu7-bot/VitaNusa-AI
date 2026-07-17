import { normalizeAuditEvent } from '../domain/audit.js';
import { normalizeIsoTimestamp } from '../domain/validation.js';
import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import {
  assertRecordScope,
  asStorageValidationError,
  createRepositoryExecutor,
  cursorToArray,
  keyRangeBound,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeExportListOptions,
  normalizeListOptions,
  normalizeWith,
  normalizeWorkspaceScope,
} from './repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.AUDIT_EVENTS;

function normalizeScopedEvent(accountScope, workspaceId, event) {
  const normalized = normalizeWith(normalizeAuditEvent, event);
  assertRecordScope(normalized, accountScope, workspaceId);
  return normalized;
}

export function createAuditRepository(options) {
  const executor = createRepositoryExecutor(options);

  const repository = {
    async append(explicitAccountScope, explicitWorkspaceId, event) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const normalized = normalizeScopedEvent(accountScope, workspaceId, event);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).add(normalized));
        return normalizeScopedEvent(accountScope, workspaceId, normalized);
      });
    },

    async getById(explicitAccountScope, explicitWorkspaceId, eventIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const eventId = normalizeEntityIdentifier(eventIdValue, 'audit');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([accountScope, workspaceId, eventId]),
        );
        return value === undefined ? null : normalizeScopedEvent(accountScope, workspaceId, value);
      });
    },

    async listByWorkspace(explicitAccountScope, explicitWorkspaceId, optionsValue = {}) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const { limit, beforeCreatedAt } = normalizeListOptions(optionsValue);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const upperTimestamp = beforeCreatedAt ?? '\uffff';
        const range = keyRangeBound(
          transaction,
          [accountScope, workspaceId, ''],
          [accountScope, workspaceId, upperTimestamp],
          false,
          beforeCreatedAt !== undefined,
        );
        const index = transaction.objectStore(STORE_NAME).index('byWorkspaceCreatedAt');
        const records = await cursorToArray(index, range, { direction: 'prev', limit });
        return records.map((record) => normalizeScopedEvent(accountScope, workspaceId, record));
      });
    },

    async listByOperation(explicitAccountScope, operationIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const operationId = normalizeEntityIdentifier(operationIdValue, 'op');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byOperation');
        const records = await transaction.request(
          index.getAll(keyRangeOnly(transaction, [accountScope, operationId])),
        );
        return records
          .map((record) => {
            try {
              normalizeIsoTimestamp(record.createdAtLocal, 'auditEvent.createdAtLocal');
            } catch (error) {
              throw asStorageValidationError(error);
            }
            return normalizeWith(normalizeAuditEvent, record);
          })
          .filter((record) => record.accountScope === accountScope)
          .sort((left, right) => (
            right.createdAtLocal.localeCompare(left.createdAtLocal)
            || left.eventId.localeCompare(right.eventId)
          ));
      });
    },
  };

  // Backup export uses a scoped, bounded cursor. It is intentionally non-enumerable
  // so the public repository contract stays focused on application reads.
  Object.defineProperty(repository, 'listForBackup', {
    configurable: false,
    enumerable: false,
    value: async (explicitAccountScope, explicitWorkspaceId, optionsValue) => {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const { limit } = normalizeExportListOptions(optionsValue);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspaceCreatedAt');
        const range = keyRangeBound(
          transaction,
          [accountScope, workspaceId, ''],
          [accountScope, workspaceId, '\uffff'],
        );
        const records = await cursorToArray(index, range, { direction: 'next', limit });
        return records.map((record) => normalizeScopedEvent(accountScope, workspaceId, record));
      });
    },
    writable: false,
  });

  return Object.freeze(repository);
}
