import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
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
import { normalizeCashSession } from '../domain/cash-session.js';

const STORE = MANDIRI_STORE_NAMES.CASH_SESSIONS;

function scoped(accountScope, session) {
  return Object.freeze({ accountScope, ...session });
}

function publicSession(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return normalizeWith(normalizeCashSession, copy, { workspaceId: record.workspaceId });
}

function assertTransition(current, next, expectedVersion) {
  if (current.version !== expectedVersion || next.version !== expectedVersion + 1) {
    throw storageError('version_conflict');
  }
  if (current.status !== 'open') throw storageError('cash_session_closed');
  for (const field of [
    'schemaVersion', 'cashSessionId', 'workspaceId', 'openingCashMinor',
    'openedByScope', 'openedByRole', 'openOperationId', 'openedAtLocal',
  ]) {
    if (current[field] !== next[field]) throw storageError('data_invalid');
  }
  if (next.updatedAtLocal < current.updatedAtLocal) throw storageError('data_invalid');
}

export function createCashSessionRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async create(accountValue, workspaceValue, sessionInput) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const session = normalizeWith(normalizeCashSession, sessionInput, { workspaceId });
      if (session.status !== 'open' || session.version !== 1) throw storageError('data_invalid');
      return executor.run([STORE], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE).add(scoped(accountScope, session)));
        return publicSession(scoped(accountScope, session));
      });
    },

    async get(accountValue, workspaceValue, sessionValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const cashSessionId = normalizeEntityIdentifier(sessionValue, 'cashsession');
      return executor.run([STORE], 'readonly', async (transaction) => {
        const record = await transaction.request(
          transaction.objectStore(STORE).get([accountScope, workspaceId, cashSessionId]),
        );
        return record === undefined ? null : publicSession(record);
      });
    },

    async findOpen(accountValue, workspaceValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([STORE], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(STORE).index('byWorkspaceStatus').getAll(keyRangeOnly(
            transaction,
            [accountScope, workspaceId, 'open'],
          )),
        );
        if (records.length > 1) throw storageError('data_invalid');
        return records.length === 0 ? null : publicSession(records[0]);
      });
    },

    async listByWorkspace(accountValue, workspaceValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run([STORE], 'readonly', async (transaction) => {
        const records = await transaction.request(
          transaction.objectStore(STORE).index('byWorkspaceOpenedAt').getAll(keyRangeBound(
            transaction,
            [accountScope, workspaceId, ''],
            [accountScope, workspaceId, '\uffff'],
          )),
        );
        return Object.freeze(records.map(publicSession));
      });
    },

    async update(accountValue, workspaceValue, sessionInput, expectedVersion) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const next = normalizeWith(normalizeCashSession, sessionInput, { workspaceId });
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw storageError('data_invalid');
      }
      return executor.run([STORE], 'readwrite', async (transaction) => {
        const store = transaction.objectStore(STORE);
        const currentRecord = await transaction.request(
          store.get([accountScope, workspaceId, next.cashSessionId]),
        );
        if (!currentRecord) throw storageError('record_not_found');
        const current = publicSession(currentRecord);
        assertTransition(current, next, expectedVersion);
        await transaction.request(store.put(scoped(accountScope, next)));
        return publicSession(scoped(accountScope, next));
      });
    },
  };

  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: repository.listByWorkspace,
  });
  return Object.freeze(repository);
}
