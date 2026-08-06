import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import {
  clonePlainRecord,
  createRepositoryExecutor,
  keyRangeBound,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWith,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import { normalizeSaleReversal } from '../domain/sale-reversal.js';

const STORE = MANDIRI_STORE_NAMES.SALE_REVERSALS;

function scoped(accountScope, reversal) {
  return Object.freeze({ accountScope, ...reversal });
}

function publicRecord(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return normalizeWith(normalizeSaleReversal, copy, { workspaceId: record.workspaceId });
}

function sortReversals(records) {
  return records.sort((left, right) => (
    left.reversedAtLocal.localeCompare(right.reversedAtLocal)
    || left.reversalId.localeCompare(right.reversalId)
  ));
}

export function createSaleReversalRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async append(accountValue, workspaceValue, reversalInput) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const reversal = normalizeWith(
        normalizeSaleReversal,
        reversalInput,
        { workspaceId },
      );
      return executor.run([STORE], 'readwrite', async (transaction) => {
        await transaction.request(
          transaction.objectStore(STORE).add(scoped(accountScope, reversal)),
        );
        return reversal;
      });
    },

    async get(accountValue, workspaceValue, reversalValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const reversalId = normalizeEntityIdentifier(reversalValue, 'reversal');
      return executor.run([STORE], 'readonly', async (transaction) => {
        const record = await transaction.request(
          transaction.objectStore(STORE).get([accountScope, workspaceId, reversalId]),
        );
        return record ? publicRecord(record) : null;
      });
    },

    async getBySale(accountValue, workspaceValue, saleValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const saleId = normalizeEntityIdentifier(saleValue, 'sale');
      return executor.run([STORE], 'readonly', async (transaction) => {
        const record = await transaction.request(
          transaction.objectStore(STORE).index('byOriginalSale').get(
            keyRangeOnly(transaction, [accountScope, workspaceId, saleId]),
          ),
        );
        return record ? publicRecord(record) : null;
      });
    },

    async listByWorkspace(accountValue, workspaceValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([STORE], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(STORE).index('byWorkspaceReversedAt').getAll(
            keyRangeBound(
              transaction,
              [accountScope, workspaceId, ''],
              [accountScope, workspaceId, '\uffff'],
            ),
          ),
        );
        return Object.freeze(sortReversals(records.map(publicRecord)));
      });
    },
  };

  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: repository.listByWorkspace,
  });

  return Object.freeze(repository);
}
