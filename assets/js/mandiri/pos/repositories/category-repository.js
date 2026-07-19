import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  createRepositoryExecutor,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import {
  normalizeScopedCategory,
  publicCategory,
} from './pos-repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.CATEGORIES;

export function createCategoryRepository(options) {
  const executor = createRepositoryExecutor(options);
  return Object.freeze({
    async create(explicitAccountScope, explicitWorkspaceId, input) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedCategory(accountScope, workspaceId, input);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).add(record));
        return publicCategory(record);
      });
    },

    async update(explicitAccountScope, explicitWorkspaceId, input, expectedVersion) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedCategory(accountScope, workspaceId, input);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw storageError('data_invalid');
      }
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        const store = transaction.objectStore(STORE_NAME);
        const key = [accountScope, workspaceId, record.categoryId];
        const current = await transaction.request(store.get(key));
        if (current === undefined) throw storageError('record_not_found');
        if (current.version !== expectedVersion || record.version !== expectedVersion + 1) {
          throw storageError('version_conflict');
        }
        await transaction.request(store.put(record));
        return publicCategory(record);
      });
    },

    async get(explicitAccountScope, explicitWorkspaceId, categoryIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const categoryId = normalizeEntityIdentifier(categoryIdValue, 'category');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([accountScope, workspaceId, categoryId]),
        );
        return value === undefined ? null : publicCategory(value);
      });
    },

    async list(explicitAccountScope, explicitWorkspaceId) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspace');
        const records = await transaction.request(index.getAll(keyRangeOnly(
          transaction,
          [accountScope, workspaceId],
        )));
        return Object.freeze(records.map(publicCategory).sort((a, b) => a.name.localeCompare(b.name)));
      });
    },
  });
}
