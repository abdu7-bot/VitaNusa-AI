import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  clonePlainRecord,
  createRepositoryExecutor,
  keyRangeBound,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWith,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import { normalizeExpense } from '../domain/expense.js';

const STORE = MANDIRI_STORE_NAMES.EXPENSES;

function scoped(accountScope, expense) {
  return Object.freeze({ accountScope, ...expense });
}

function publicExpense(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return normalizeWith(normalizeExpense, copy, { workspaceId: record.workspaceId });
}

export function createExpenseRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async append(accountValue, workspaceValue, expenseInput) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const expense = normalizeWith(normalizeExpense, expenseInput, { workspaceId });
      return executor.run([STORE], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE).add(scoped(accountScope, expense)));
        return publicExpense(scoped(accountScope, expense));
      });
    },

    async get(accountValue, workspaceValue, expenseValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const expenseId = normalizeEntityIdentifier(expenseValue, 'expense');
      return executor.run([STORE], 'readonly', async (transaction) => {
        const record = await transaction.request(
          transaction.objectStore(STORE).get([accountScope, workspaceId, expenseId]),
        );
        return record === undefined ? null : publicExpense(record);
      });
    },

    async listByCashSession(accountValue, workspaceValue, cashSessionValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const cashSessionId = normalizeEntityIdentifier(cashSessionValue, 'cashsession');
      return executor.run([STORE], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(STORE).index('byCashSessionRecordedAt').getAll(keyRangeBound(
            transaction,
            [accountScope, workspaceId, cashSessionId, ''],
            [accountScope, workspaceId, cashSessionId, '\uffff'],
          )),
        );
        return Object.freeze(records.map(publicExpense));
      });
    },
  };

  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: async (accountValue, workspaceValue) => {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([STORE], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(STORE).index('byWorkspaceRecordedAt').getAll(keyRangeBound(
            transaction,
            [accountScope, workspaceId, ''],
            [accountScope, workspaceId, '\uffff'],
          )),
        );
        if (records.some((record) => (
          record.accountScope !== accountScope || record.workspaceId !== workspaceId
        ))) throw storageError('scope_mismatch');
        return Object.freeze(records.map(publicExpense));
      });
    },
  });
  return Object.freeze(repository);
}
