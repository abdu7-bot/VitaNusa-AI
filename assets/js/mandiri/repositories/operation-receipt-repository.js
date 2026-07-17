import { isValidEntityId } from '../domain/ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeCode,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from '../domain/validation.js';
import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import { storageError } from '../storage/storage-errors.js';
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
  normalizeWith,
  normalizeWorkspaceScope,
} from './repository-utils.js';

export const OPERATION_RECEIPT_RESULTS = Object.freeze(['committed', 'rejected']);

const RECEIPT_FIELDS = Object.freeze([
  'schemaVersion',
  'accountScope',
  'workspaceId',
  'operationId',
  'operationType',
  'payloadDigest',
  'entityType',
  'entityId',
  'result',
  'createdAtLocal',
]);
const PAYLOAD_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const STORE_NAME = MANDIRI_STORE_NAMES.OPERATION_RECEIPTS;

function assertId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError('invalid_entity_id', 'ID tidak valid', path);
  }
  return value;
}

export function normalizeOperationReceipt(input) {
  try {
    assertExactFields(input, RECEIPT_FIELDS, {
      requiredFields: RECEIPT_FIELDS,
      path: 'operationReceipt',
    });
    if (!PAYLOAD_DIGEST_PATTERN.test(input.payloadDigest)) {
      throw new MandiriDomainError(
        'invalid_payload_digest',
        'payloadDigest harus SHA-256 canonical yang didukung',
        'operationReceipt.payloadDigest',
      );
    }
    if (!OPERATION_RECEIPT_RESULTS.includes(input.result)) {
      throw new MandiriDomainError(
        'unknown_receipt_result',
        'result receipt tidak dikenal',
        'operationReceipt.result',
      );
    }

    return Object.freeze({
      schemaVersion: normalizePositiveVersion(input.schemaVersion, 'operationReceipt.schemaVersion'),
      accountScope: normalizeScope(input.accountScope, 'operationReceipt.accountScope'),
      workspaceId: assertId(input.workspaceId, 'workspace', 'operationReceipt.workspaceId'),
      operationId: assertId(input.operationId, 'op', 'operationReceipt.operationId'),
      operationType: normalizeCode(input.operationType, {
        path: 'operationReceipt.operationType',
        maxLength: 80,
      }),
      payloadDigest: input.payloadDigest,
      entityType: normalizeCode(input.entityType, {
        path: 'operationReceipt.entityType',
        maxLength: 64,
      }),
      entityId: assertId(input.entityId, undefined, 'operationReceipt.entityId'),
      result: input.result,
      createdAtLocal: normalizeIsoTimestamp(
        input.createdAtLocal,
        'operationReceipt.createdAtLocal',
      ),
    });
  } catch (error) {
    throw asStorageValidationError(error);
  }
}

function normalizeScopedReceipt(accountScope, receipt) {
  const normalized = normalizeWith(normalizeOperationReceipt, receipt);
  assertRecordScope(normalized, accountScope);
  return normalized;
}

export function createOperationReceiptRepository(options) {
  const executor = createRepositoryExecutor(options);

  const repository = {
    async append(explicitAccountScope, receipt) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const normalized = normalizeScopedReceipt(accountScope, receipt);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).add(normalized));
        return normalizeScopedReceipt(accountScope, normalized);
      });
    },

    async getByOperationId(explicitAccountScope, operationIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const operationId = normalizeEntityIdentifier(operationIdValue, 'op');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([accountScope, operationId]),
        );
        return value === undefined ? null : normalizeScopedReceipt(accountScope, value);
      });
    },

    async findByEntity(explicitAccountScope, explicitWorkspaceId, entityTypeValue, entityIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const entityId = normalizeEntityIdentifier(entityIdValue);
      let entityType;
      try {
        entityType = normalizeCode(entityTypeValue, { path: 'entityType', maxLength: 64 });
      } catch (error) {
        throw asStorageValidationError(error);
      }
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byEntity');
        const records = await transaction.request(index.getAll(keyRangeOnly(
          transaction,
          [accountScope, workspaceId, entityType, entityId],
        )));
        return records
          .map((record) => normalizeScopedReceipt(accountScope, record))
          .filter((record) => record.workspaceId === workspaceId)
          .sort((left, right) => (
            right.createdAtLocal.localeCompare(left.createdAtLocal)
            || left.operationId.localeCompare(right.operationId)
          ));
      });
    },
  };

  // The export reader is scoped to one account/workspace and refuses unbounded reads.
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
        return records.map((record) => {
          const normalized = normalizeScopedReceipt(accountScope, record);
          if (normalized.workspaceId !== workspaceId) throw storageError('scope_mismatch');
          return normalized;
        });
      });
    },
    writable: false,
  });

  return Object.freeze(repository);
}
