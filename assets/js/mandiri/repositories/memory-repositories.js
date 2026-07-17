import { normalizeAuditEvent } from '../domain/audit.js';
import { normalizeMembership } from '../domain/membership.js';
import { normalizeCode } from '../domain/validation.js';
import {
  normalizeWorkspace,
  WORKSPACE_STATUSES,
} from '../domain/workspace.js';
import {
  isMandiriStoreName,
  MANDIRI_ALLOWED_STORE_NAMES,
  MANDIRI_STORE_NAMES,
} from '../storage/schema.js';
import {
  mapStorageError,
  storageError,
} from '../storage/storage-errors.js';
import { normalizeOperationReceipt } from './operation-receipt-repository.js';
import {
  assertRecordScope,
  asStorageValidationError,
  clonePlainRecord,
  compareNewest,
  normalizeAccountScope,
  normalizeEntityIdentifier,
  normalizeExportListOptions,
  normalizeListOptions,
  normalizeWith,
  normalizeWorkspaceScope,
} from './repository-utils.js';

function createEmptyState() {
  return {
    workspaces: new Map(),
    memberships: new Map(),
    auditEvents: new Map(),
    operationReceipts: new Map(),
  };
}

function cloneNestedMap(map) {
  const copy = new Map();
  for (const [key, value] of map) {
    copy.set(key, value instanceof Map ? cloneNestedMap(value) : clonePlainRecord(value));
  }
  return copy;
}

function cloneState(state) {
  return {
    workspaces: cloneNestedMap(state.workspaces),
    memberships: cloneNestedMap(state.memberships),
    auditEvents: cloneNestedMap(state.auditEvents),
    operationReceipts: cloneNestedMap(state.operationReceipts),
  };
}

function getBucket(map, key) {
  return map.get(key) ?? null;
}

function ensureBucket(map, key) {
  if (!map.has(key)) map.set(key, new Map());
  return map.get(key);
}

function normalizeScopedWorkspace(accountScope, workspace) {
  const normalized = normalizeWith(normalizeWorkspace, workspace);
  assertRecordScope(normalized, accountScope);
  return normalized;
}

function normalizeScopedMembership(accountScope, workspaceId, membership) {
  const normalized = normalizeWith(
    normalizeMembership,
    membership,
    { accountScope, workspaceId },
  );
  assertRecordScope(normalized, accountScope, workspaceId);
  return normalized;
}

function normalizeScopedEvent(accountScope, workspaceId, event) {
  const normalized = normalizeWith(normalizeAuditEvent, event);
  assertRecordScope(normalized, accountScope, workspaceId);
  return normalized;
}

function normalizeScopedReceipt(accountScope, receipt) {
  const normalized = normalizeWith(normalizeOperationReceipt, receipt);
  assertRecordScope(normalized, accountScope);
  return normalized;
}

function sortWorkspaces(records) {
  return records.sort((left, right) => compareNewest(left, right, 'updatedAtLocal', 'workspaceId'));
}

function sortMemberships(records) {
  return records.sort((left, right) => compareNewest(left, right, 'updatedAtLocal', 'membershipId'));
}

function createMemoryRepositorySet({ getState, assertActive, allowedStores, mode }) {
  const assertStore = (storeName, write = false) => {
    assertActive();
    if (!allowedStores.has(storeName)) throw storageError('data_invalid');
    if (write && mode !== 'readwrite') throw storageError('data_invalid');
  };

  const workspaceRepository = Object.freeze({
    async add(explicitAccountScope, workspace) {
      assertStore(MANDIRI_STORE_NAMES.WORKSPACES, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const normalized = normalizeScopedWorkspace(accountScope, workspace);
      const accountBucket = ensureBucket(getState().workspaces, accountScope);
      if (accountBucket.has(normalized.workspaceId)) throw storageError('constraint_violation');
      accountBucket.set(normalized.workspaceId, clonePlainRecord(normalized));
      return normalizeScopedWorkspace(accountScope, normalized);
    },

    async getById(explicitAccountScope, workspaceIdValue) {
      assertStore(MANDIRI_STORE_NAMES.WORKSPACES);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeEntityIdentifier(workspaceIdValue, 'workspace');
      const record = getBucket(getState().workspaces, accountScope)?.get(workspaceId);
      return record === undefined ? null : normalizeScopedWorkspace(accountScope, record);
    },

    async listByAccount(explicitAccountScope) {
      assertStore(MANDIRI_STORE_NAMES.WORKSPACES);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const records = [...(getBucket(getState().workspaces, accountScope)?.values() ?? [])]
        .map((record) => normalizeScopedWorkspace(accountScope, record));
      return sortWorkspaces(records);
    },

    async listByStatus(explicitAccountScope, status) {
      assertStore(MANDIRI_STORE_NAMES.WORKSPACES);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      if (!WORKSPACE_STATUSES.includes(status)) throw storageError('data_invalid');
      const records = [...(getBucket(getState().workspaces, accountScope)?.values() ?? [])]
        .map((record) => normalizeScopedWorkspace(accountScope, record))
        .filter((record) => record.status === status);
      return sortWorkspaces(records);
    },
  });

  const listMembershipsByWorkspace = (explicitAccountScope, explicitWorkspaceId) => {
    assertStore(MANDIRI_STORE_NAMES.MEMBERSHIPS);
    const accountScope = normalizeAccountScope(explicitAccountScope);
    const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
    const workspaceBucket = getBucket(
      getBucket(getState().memberships, accountScope) ?? new Map(),
      workspaceId,
    );
    const records = [...(workspaceBucket?.values() ?? [])]
      .map((record) => normalizeScopedMembership(accountScope, workspaceId, record));
    return sortMemberships(records);
  };

  const membershipRepository = Object.freeze({
    async add(explicitAccountScope, explicitWorkspaceId, membership) {
      assertStore(MANDIRI_STORE_NAMES.MEMBERSHIPS, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const normalized = normalizeScopedMembership(accountScope, workspaceId, membership);
      const accountBucket = ensureBucket(getState().memberships, accountScope);
      const workspaceBucket = ensureBucket(accountBucket, workspaceId);
      if (
        workspaceBucket.has(normalized.membershipId)
        || [...workspaceBucket.values()].some((record) => record.userScope === normalized.userScope)
      ) {
        throw storageError('constraint_violation');
      }
      workspaceBucket.set(normalized.membershipId, clonePlainRecord(normalized));
      return normalizeScopedMembership(accountScope, workspaceId, normalized);
    },

    async getById(explicitAccountScope, explicitWorkspaceId, membershipIdValue) {
      assertStore(MANDIRI_STORE_NAMES.MEMBERSHIPS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const membershipId = normalizeEntityIdentifier(membershipIdValue, 'membership');
      const record = getBucket(getBucket(getState().memberships, accountScope) ?? new Map(), workspaceId)
        ?.get(membershipId);
      return record === undefined
        ? null
        : normalizeScopedMembership(accountScope, workspaceId, record);
    },

    async getByUserScope(explicitAccountScope, explicitWorkspaceId, userScopeValue) {
      assertStore(MANDIRI_STORE_NAMES.MEMBERSHIPS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const userScope = normalizeAccountScope(userScopeValue);
      const workspaceBucket = getBucket(
        getBucket(getState().memberships, accountScope) ?? new Map(),
        workspaceId,
      );
      const record = [...(workspaceBucket?.values() ?? [])]
        .find((candidate) => candidate.userScope === userScope);
      return record === undefined
        ? null
        : normalizeScopedMembership(accountScope, workspaceId, record);
    },

    async listByWorkspace(explicitAccountScope, explicitWorkspaceId) {
      return listMembershipsByWorkspace(explicitAccountScope, explicitWorkspaceId);
    },

    async listByStatus(explicitAccountScope, explicitWorkspaceId, status) {
      const records = listMembershipsByWorkspace(explicitAccountScope, explicitWorkspaceId);
      if (!['active', 'inactive'].includes(status)) throw storageError('data_invalid');
      return records.filter((record) => record.status === status);
    },

    async countActiveOwners(explicitAccountScope, explicitWorkspaceId) {
      const records = listMembershipsByWorkspace(explicitAccountScope, explicitWorkspaceId);
      return records.filter((record) => (
        record.role === 'merchant_owner' && record.status === 'active'
      )).length;
    },
  });

  const auditRepository = {
    async append(explicitAccountScope, explicitWorkspaceId, event) {
      assertStore(MANDIRI_STORE_NAMES.AUDIT_EVENTS, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const normalized = normalizeScopedEvent(accountScope, workspaceId, event);
      const accountBucket = ensureBucket(getState().auditEvents, accountScope);
      const workspaceBucket = ensureBucket(accountBucket, workspaceId);
      if (workspaceBucket.has(normalized.eventId)) throw storageError('constraint_violation');
      workspaceBucket.set(normalized.eventId, clonePlainRecord(normalized));
      return normalizeScopedEvent(accountScope, workspaceId, normalized);
    },

    async getById(explicitAccountScope, explicitWorkspaceId, eventIdValue) {
      assertStore(MANDIRI_STORE_NAMES.AUDIT_EVENTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const eventId = normalizeEntityIdentifier(eventIdValue, 'audit');
      const record = getBucket(
        getBucket(getState().auditEvents, accountScope) ?? new Map(),
        workspaceId,
      )?.get(eventId);
      return record === undefined ? null : normalizeScopedEvent(accountScope, workspaceId, record);
    },

    async listByWorkspace(explicitAccountScope, explicitWorkspaceId, optionsValue = {}) {
      assertStore(MANDIRI_STORE_NAMES.AUDIT_EVENTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const { limit, beforeCreatedAt } = normalizeListOptions(optionsValue);
      const workspaceBucket = getBucket(
        getBucket(getState().auditEvents, accountScope) ?? new Map(),
        workspaceId,
      );
      return [...(workspaceBucket?.values() ?? [])]
        .map((record) => normalizeScopedEvent(accountScope, workspaceId, record))
        .filter((record) => beforeCreatedAt === undefined || record.createdAtLocal < beforeCreatedAt)
        .sort((left, right) => (
          right.createdAtLocal.localeCompare(left.createdAtLocal)
          || left.eventId.localeCompare(right.eventId)
        ))
        .slice(0, limit);
    },

    async listByOperation(explicitAccountScope, operationIdValue) {
      assertStore(MANDIRI_STORE_NAMES.AUDIT_EVENTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const operationId = normalizeEntityIdentifier(operationIdValue, 'op');
      const accountBucket = getBucket(getState().auditEvents, accountScope);
      const records = [];
      for (const workspaceBucket of accountBucket?.values() ?? []) {
        for (const record of workspaceBucket.values()) {
          if (record.operationId === operationId) {
            records.push(normalizeWith(normalizeAuditEvent, record));
          }
        }
      }
      return records.sort((left, right) => (
        right.createdAtLocal.localeCompare(left.createdAtLocal)
        || left.eventId.localeCompare(right.eventId)
      ));
    },
  };

  Object.defineProperty(auditRepository, 'listForBackup', {
    configurable: false,
    enumerable: false,
    value: async (explicitAccountScope, explicitWorkspaceId, optionsValue) => {
      assertStore(MANDIRI_STORE_NAMES.AUDIT_EVENTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const { limit } = normalizeExportListOptions(optionsValue);
      const workspaceBucket = getBucket(
        getBucket(getState().auditEvents, accountScope) ?? new Map(),
        workspaceId,
      );
      return [...(workspaceBucket?.values() ?? [])]
        .map((record) => normalizeScopedEvent(accountScope, workspaceId, record))
        .sort((left, right) => (
          left.createdAtLocal.localeCompare(right.createdAtLocal)
          || left.eventId.localeCompare(right.eventId)
        ))
        .slice(0, limit);
    },
    writable: false,
  });
  Object.freeze(auditRepository);

  const operationReceiptRepository = {
    async append(explicitAccountScope, receipt) {
      assertStore(MANDIRI_STORE_NAMES.OPERATION_RECEIPTS, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const normalized = normalizeScopedReceipt(accountScope, receipt);
      const accountBucket = ensureBucket(getState().operationReceipts, accountScope);
      if (accountBucket.has(normalized.operationId)) throw storageError('constraint_violation');
      accountBucket.set(normalized.operationId, clonePlainRecord(normalized));
      return normalizeScopedReceipt(accountScope, normalized);
    },

    async getByOperationId(explicitAccountScope, operationIdValue) {
      assertStore(MANDIRI_STORE_NAMES.OPERATION_RECEIPTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const operationId = normalizeEntityIdentifier(operationIdValue, 'op');
      const record = getBucket(getState().operationReceipts, accountScope)?.get(operationId);
      return record === undefined ? null : normalizeScopedReceipt(accountScope, record);
    },

    async findByEntity(explicitAccountScope, explicitWorkspaceId, entityTypeValue, entityIdValue) {
      assertStore(MANDIRI_STORE_NAMES.OPERATION_RECEIPTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const entityId = normalizeEntityIdentifier(entityIdValue);
      let entityType;
      try {
        entityType = normalizeCode(entityTypeValue, { path: 'entityType', maxLength: 64 });
      } catch (error) {
        throw asStorageValidationError(error);
      }
      return [...(getBucket(getState().operationReceipts, accountScope)?.values() ?? [])]
        .map((record) => normalizeScopedReceipt(accountScope, record))
        .filter((record) => (
          record.workspaceId === workspaceId
          && record.entityType === entityType
          && record.entityId === entityId
        ))
        .sort((left, right) => (
          right.createdAtLocal.localeCompare(left.createdAtLocal)
          || left.operationId.localeCompare(right.operationId)
        ));
    },
  };

  Object.defineProperty(operationReceiptRepository, 'listForBackup', {
    configurable: false,
    enumerable: false,
    value: async (explicitAccountScope, explicitWorkspaceId, optionsValue) => {
      assertStore(MANDIRI_STORE_NAMES.OPERATION_RECEIPTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const { limit } = normalizeExportListOptions(optionsValue);
      return [...(getBucket(getState().operationReceipts, accountScope)?.values() ?? [])]
        .map((record) => normalizeScopedReceipt(accountScope, record))
        .filter((record) => record.workspaceId === workspaceId)
        .sort((left, right) => (
          left.createdAtLocal.localeCompare(right.createdAtLocal)
          || left.operationId.localeCompare(right.operationId)
        ))
        .slice(0, limit);
    },
    writable: false,
  });
  Object.freeze(operationReceiptRepository);

  return Object.freeze({
    workspaceRepository,
    membershipRepository,
    auditRepository,
    operationReceiptRepository,
  });
}

export function createMemoryRepositories() {
  const holder = { state: createEmptyState() };
  let transactionRunning = false;
  const rootRepositories = createMemoryRepositorySet({
    getState: () => holder.state,
    assertActive: () => {
      if (transactionRunning) throw storageError('data_invalid');
    },
    allowedStores: new Set(MANDIRI_ALLOWED_STORE_NAMES),
    mode: 'readwrite',
  });

  const repositoryContext = Object.freeze({
    async run(storeNames, mode, callback) {
      if (
        !Array.isArray(storeNames)
        || storeNames.length === 0
        || new Set(storeNames).size !== storeNames.length
        || !storeNames.every(isMandiriStoreName)
        || !['readonly', 'readwrite'].includes(mode)
        || typeof callback !== 'function'
      ) {
        throw storageError('data_invalid');
      }
      if (transactionRunning) throw storageError('data_invalid');

      transactionRunning = true;
      let active = true;
      const workingState = cloneState(holder.state);
      const scopedRepositories = createMemoryRepositorySet({
        getState: () => workingState,
        assertActive: () => {
          if (!active) throw storageError('transaction_aborted');
        },
        allowedStores: new Set(storeNames),
        mode,
      });

      try {
        const result = await callback(scopedRepositories);
        holder.state = workingState;
        active = false;
        transactionRunning = false;
        return result;
      } catch (error) {
        active = false;
        transactionRunning = false;
        throw mapStorageError(error, 'transaction_aborted');
      }
    },
  });

  return Object.freeze({
    ...rootRepositories,
    repositoryContext,
  });
}
