import {
  MEMBERSHIP_STATUSES,
  normalizeMembership,
} from '../domain/membership.js';
import { MANDIRI_STORE_NAMES } from '../storage/schema.js';
import { storageError } from '../storage/storage-errors.js';
import {
  assertRecordScope,
  compareNewest,
  createRepositoryExecutor,
  keyRangeOnly,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeWith,
  normalizeWorkspaceScope,
} from './repository-utils.js';

const STORE_NAME = MANDIRI_STORE_NAMES.MEMBERSHIPS;

function normalizeScopedMembership(accountScope, workspaceId, membership) {
  const normalized = normalizeWith(
    normalizeMembership,
    membership,
    { accountScope, workspaceId },
  );
  assertRecordScope(normalized, accountScope, workspaceId);
  return normalized;
}

function sortMemberships(records) {
  return records.sort((left, right) => (
    compareNewest(left, right, 'updatedAtLocal', 'membershipId')
  ));
}

export function createMembershipRepository(options) {
  const executor = createRepositoryExecutor(options);

  return Object.freeze({
    async add(explicitAccountScope, explicitWorkspaceId, membership) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const normalized = normalizeScopedMembership(accountScope, workspaceId, membership);
      return executor.run([STORE_NAME], 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(STORE_NAME).add(normalized));
        return normalizeScopedMembership(accountScope, workspaceId, normalized);
      });
    },

    async getById(explicitAccountScope, explicitWorkspaceId, membershipIdValue) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const membershipId = normalizeEntityIdentifier(membershipIdValue, 'membership');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const value = await transaction.request(
          transaction.objectStore(STORE_NAME).get([accountScope, workspaceId, membershipId]),
        );
        return value === undefined
          ? null
          : normalizeScopedMembership(accountScope, workspaceId, value);
      });
    },

    async getByUserScope(explicitAccountScope, explicitWorkspaceId, userScope) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const normalizedUserScope = normalizeAccountScope(userScope);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspaceUser');
        const value = await transaction.request(
          index.get([accountScope, workspaceId, normalizedUserScope]),
        );
        return value === undefined
          ? null
          : normalizeScopedMembership(accountScope, workspaceId, value);
      });
    },

    async listByWorkspace(explicitAccountScope, explicitWorkspaceId) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspace');
        const records = await transaction.request(
          index.getAll(keyRangeOnly(transaction, [accountScope, workspaceId])),
        );
        return sortMemberships(records.map((record) => (
          normalizeScopedMembership(accountScope, workspaceId, record)
        )));
      });
    },

    async listByStatus(explicitAccountScope, explicitWorkspaceId, status) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      if (!MEMBERSHIP_STATUSES.includes(status)) throw storageError('data_invalid');
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspaceStatus');
        const records = await transaction.request(
          index.getAll(keyRangeOnly(transaction, [accountScope, workspaceId, status])),
        );
        return sortMemberships(records.map((record) => (
          normalizeScopedMembership(accountScope, workspaceId, record)
        )));
      });
    },

    async countActiveOwners(explicitAccountScope, explicitWorkspaceId) {
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return executor.run([STORE_NAME], 'readonly', async (transaction) => {
        const index = transaction.objectStore(STORE_NAME).index('byWorkspaceStatus');
        const records = await transaction.request(
          index.getAll(keyRangeOnly(transaction, [accountScope, workspaceId, 'active'])),
        );
        return records
          .map((record) => normalizeScopedMembership(accountScope, workspaceId, record))
          .filter((record) => record.role === 'merchant_owner')
          .length;
      });
    },
  });
}
