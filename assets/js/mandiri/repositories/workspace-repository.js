import {
  normalizeWorkspace,
  WORKSPACE_STATUSES,
} from '../domain/workspace.js';
import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import { storageError } from '../storage/storage-errors.js';
import {
  assertRecordScope,
  compareNewest,
  createRepositoryExecutor,
  cursorToArray,
  keyRangeBound,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWith,
} from './repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.WORKSPACES;

function normalizeScopedWorkspace(accountScope, workspace) {
  const normalized = normalizeWith(normalizeWorkspace, workspace);
  assertRecordScope(normalized, accountScope);
  return normalized;
}

function sortWorkspaces(records) {
  return records.sort((left, right) => compareNewest(left, right, 'updatedAtLocal', 'workspaceId'));
}

export function createWorkspaceRepository(options) {
  const executor = createRepositoryExecutor(options);

  return Object.freeze({
    async add(explicitAccountScope, workspace) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const normalized = normalizeScopedWorkspace(accountScope, workspace);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        const store = transaction.objectStore(STORE_NAME);
        await transaction.request(store.add(normalized));
        return normalizeScopedWorkspace(accountScope, normalized);
      });
    },

    async getById(explicitAccountScope, workspaceIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeEntityIdentifier(workspaceIdValue, 'workspace');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([accountScope, workspaceId]),
        );
        return value === undefined ? null : normalizeScopedWorkspace(accountScope, value);
      });
    },

    async listByAccount(explicitAccountScope) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byAccountUpdatedAt');
        const range = keyRangeBound(
          transaction,
          [accountScope, ''],
          [accountScope, '\uffff'],
        );
        const records = await cursorToArray(index, range, { direction: 'prev' });
        return sortWorkspaces(records.map((record) => normalizeScopedWorkspace(accountScope, record)));
      });
    },

    async listByStatus(explicitAccountScope, status) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      if (!WORKSPACE_STATUSES.includes(status)) throw storageError('data_invalid');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byAccountStatus');
        const range = keyRangeOnly(transaction, [accountScope, status]);
        const records = await transaction.request(index.getAll(range));
        return sortWorkspaces(records.map((record) => normalizeScopedWorkspace(accountScope, record)));
      });
    },
  });
}
