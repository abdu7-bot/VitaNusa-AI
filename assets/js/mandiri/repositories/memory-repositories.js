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
import { normalizeAttempt } from '../learning/domain/attempt.js';
import { normalizeProgress } from '../learning/domain/progress.js';
import { normalizeCategory } from '../pos/domain/category.js';
import { normalizeProduct } from '../pos/domain/product.js';
import { normalizeInventoryBalance, normalizeStockMovement } from '../pos/domain/inventory.js';
import { normalizeLearnerScope } from '../learning/domain/learning-validation.js';
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
    learningAttempts: new Map(),
    learningProgress: new Map(),
    categories: new Map(),
    products: new Map(),
    stockMovements: new Map(),
    inventoryBalances: new Map(),
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
    learningAttempts: cloneNestedMap(state.learningAttempts),
    learningProgress: cloneNestedMap(state.learningProgress),
    categories: cloneNestedMap(state.categories),
    products: cloneNestedMap(state.products),
    stockMovements: cloneNestedMap(state.stockMovements),
    inventoryBalances: cloneNestedMap(state.inventoryBalances),
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

function normalizeLearningScope(value) {
  try { return normalizeLearnerScope(value); } catch (error) {
    throw asStorageValidationError(error);
  }
}

function normalizeScopedAttempt(learnerScope, attempt) {
  const normalized = normalizeWith(normalizeAttempt, attempt);
  if (normalized.learnerScope !== learnerScope) throw storageError('scope_mismatch');
  return normalized;
}

function normalizeScopedProgress(learnerScope, progress) {
  const normalized = normalizeWith(normalizeProgress, progress);
  if (normalized.learnerScope !== learnerScope) throw storageError('scope_mismatch');
  return normalized;
}

function normalizeScopedCategory(accountScope, workspaceId, category) {
  const normalized = normalizeWith(normalizeCategory, category, { workspaceId });
  return Object.freeze({ accountScope, ...normalized });
}

function normalizeScopedProduct(accountScope, workspaceId, product) {
  const normalized = normalizeWith(normalizeProduct, product, { workspaceId });
  return Object.freeze({ accountScope, ...normalized });
}

function scopedInventory(normalizer, accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizer, input, { workspaceId });
  return Object.freeze({ accountScope, ...normalized });
}

function publicInventory(normalizer, record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return normalizeWith(normalizer, copy, { workspaceId: record.workspaceId });
}

function publicCategory(record) {
  const { accountScope: _accountScope, ...category } = record;
  return normalizeWith(normalizeCategory, category, { workspaceId: record.workspaceId });
}

function publicProduct(record) {
  const { accountScope: _accountScope, ...product } = record;
  return normalizeWith(normalizeProduct, product, { workspaceId: record.workspaceId });
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

  const learningAttemptRepository = {
    async addCompleted(explicitScope, attempt) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS, true);
      const learnerScope = normalizeLearningScope(explicitScope);
      const normalized = normalizeScopedAttempt(learnerScope, attempt);
      if (normalized.status !== 'completed') throw storageError('data_invalid');
      const bucket = ensureBucket(getState().learningAttempts, learnerScope);
      if (
        bucket.has(normalized.attemptId)
        || [...bucket.values()].some((record) => record.operationId === normalized.operationId)
      ) throw storageError('constraint_violation');
      bucket.set(normalized.attemptId, clonePlainRecord(normalized));
      return normalizeScopedAttempt(learnerScope, normalized);
    },
    async getById(explicitScope, attemptId) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS);
      const learnerScope = normalizeLearningScope(explicitScope);
      const record = getBucket(getState().learningAttempts, learnerScope)?.get(attemptId);
      return record === undefined ? null : normalizeScopedAttempt(learnerScope, record);
    },
    async getByOperationId(explicitScope, operationId) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS);
      const learnerScope = normalizeLearningScope(explicitScope);
      const record = [...(getBucket(getState().learningAttempts, learnerScope)?.values() ?? [])]
        .find((candidate) => candidate.operationId === operationId);
      return record === undefined ? null : normalizeScopedAttempt(learnerScope, record);
    },
    async listByLesson(explicitScope, lessonId) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS);
      const learnerScope = normalizeLearningScope(explicitScope);
      return [...(getBucket(getState().learningAttempts, learnerScope)?.values() ?? [])]
        .filter((record) => record.lessonId === lessonId)
        .map((record) => normalizeScopedAttempt(learnerScope, record));
    },
  };
  Object.defineProperty(learningAttemptRepository, 'listForBackup', {
    enumerable: false,
    value: async (explicitScope, optionsValue) => {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_ATTEMPTS);
      const learnerScope = normalizeLearningScope(explicitScope);
      const { limit } = normalizeExportListOptions(optionsValue);
      return [...(getBucket(getState().learningAttempts, learnerScope)?.values() ?? [])]
        .map((record) => normalizeScopedAttempt(learnerScope, record))
        .slice(0, limit);
    },
  });
  Object.freeze(learningAttemptRepository);

  const learningProgressRepository = {
    async get(explicitScope, key) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_PROGRESS);
      const learnerScope = normalizeLearningScope(explicitScope);
      const id = `${key.courseId}\u0000${key.moduleId}\u0000${key.lessonId}`;
      const record = getBucket(getState().learningProgress, learnerScope)?.get(id);
      return record === undefined ? null : normalizeScopedProgress(learnerScope, record);
    },
    async put(explicitScope, progress) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_PROGRESS, true);
      const learnerScope = normalizeLearningScope(explicitScope);
      const normalized = normalizeScopedProgress(learnerScope, progress);
      const id = `${normalized.courseId}\u0000${normalized.moduleId}\u0000${normalized.lessonId}`;
      ensureBucket(getState().learningProgress, learnerScope).set(id, clonePlainRecord(normalized));
      return normalizeScopedProgress(learnerScope, normalized);
    },
    async listByCourse(explicitScope, courseId) {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_PROGRESS);
      const learnerScope = normalizeLearningScope(explicitScope);
      return [...(getBucket(getState().learningProgress, learnerScope)?.values() ?? [])]
        .filter((record) => record.courseId === courseId)
        .map((record) => normalizeScopedProgress(learnerScope, record));
    },
  };
  Object.defineProperty(learningProgressRepository, 'listForBackup', {
    enumerable: false,
    value: async (explicitScope, optionsValue) => {
      assertStore(MANDIRI_STORE_NAMES.LEARNING_PROGRESS);
      const learnerScope = normalizeLearningScope(explicitScope);
      const { limit } = normalizeExportListOptions(optionsValue);
      return [...(getBucket(getState().learningProgress, learnerScope)?.values() ?? [])]
        .map((record) => normalizeScopedProgress(learnerScope, record))
        .slice(0, limit);
    },
  });
  Object.freeze(learningProgressRepository);

  const categoryRepository = Object.freeze({
    async create(explicitAccountScope, explicitWorkspaceId, input) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedCategory(accountScope, workspaceId, input);
      const accountBucket = ensureBucket(getState().categories, accountScope);
      const workspaceBucket = ensureBucket(accountBucket, workspaceId);
      if (workspaceBucket.has(record.categoryId)) throw storageError('constraint_violation');
      workspaceBucket.set(record.categoryId, clonePlainRecord(record));
      return publicCategory(record);
    },
    async update(explicitAccountScope, explicitWorkspaceId, input, expectedVersion) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedCategory(accountScope, workspaceId, input);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw storageError('data_invalid');
      }
      const workspaceBucket = getBucket(getBucket(getState().categories, accountScope) ?? new Map(), workspaceId);
      const current = workspaceBucket?.get(record.categoryId);
      if (!current) throw storageError('record_not_found');
      if (current.version !== expectedVersion || record.version !== expectedVersion + 1) {
        throw storageError('version_conflict');
      }
      workspaceBucket.set(record.categoryId, clonePlainRecord(record));
      return publicCategory(record);
    },
    async get(explicitAccountScope, explicitWorkspaceId, categoryIdValue) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const categoryId = normalizeEntityIdentifier(categoryIdValue, 'category');
      const record = getBucket(getBucket(getState().categories, accountScope) ?? new Map(), workspaceId)
        ?.get(categoryId);
      return record === undefined ? null : publicCategory(record);
    },
    async list(explicitAccountScope, explicitWorkspaceId) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return Object.freeze([...(getBucket(
        getBucket(getState().categories, accountScope) ?? new Map(),
        workspaceId,
      )?.values() ?? [])].map(publicCategory).sort((a, b) => a.name.localeCompare(b.name)));
    },
  });

  const productRepository = Object.freeze({
    async create(explicitAccountScope, explicitWorkspaceId, input) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES);
      assertStore(MANDIRI_STORE_NAMES.PRODUCTS, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedProduct(accountScope, workspaceId, input);
      const accountBucket = ensureBucket(getState().products, accountScope);
      const workspaceBucket = ensureBucket(accountBucket, workspaceId);
      if (workspaceBucket.has(record.productId)) throw storageError('constraint_violation');
      if (record.categoryId !== null) {
        const category = getBucket(getBucket(getState().categories, accountScope) ?? new Map(), workspaceId)
          ?.get(record.categoryId);
        if (!category) throw storageError('invalid_reference');
      }
      if (record.sku !== null && [...workspaceBucket.values()].some((item) => item.sku === record.sku)) {
        throw storageError('duplicate_sku');
      }
      workspaceBucket.set(record.productId, clonePlainRecord(record));
      return publicProduct(record);
    },
    async update(explicitAccountScope, explicitWorkspaceId, input, expectedVersion) {
      assertStore(MANDIRI_STORE_NAMES.CATEGORIES);
      assertStore(MANDIRI_STORE_NAMES.PRODUCTS, true);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const record = normalizeScopedProduct(accountScope, workspaceId, input);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw storageError('data_invalid');
      }
      const workspaceBucket = getBucket(getBucket(getState().products, accountScope) ?? new Map(), workspaceId);
      const current = workspaceBucket?.get(record.productId);
      if (!current) throw storageError('record_not_found');
      if (current.version !== expectedVersion || record.version !== expectedVersion + 1) {
        throw storageError('version_conflict');
      }
      if (record.categoryId !== null) {
        const category = getBucket(getBucket(getState().categories, accountScope) ?? new Map(), workspaceId)
          ?.get(record.categoryId);
        if (!category) throw storageError('invalid_reference');
      }
      if (record.sku !== null && [...workspaceBucket.values()].some((item) => (
        item.productId !== record.productId && item.sku === record.sku
      ))) throw storageError('duplicate_sku');
      workspaceBucket.set(record.productId, clonePlainRecord(record));
      return publicProduct(record);
    },
    async get(explicitAccountScope, explicitWorkspaceId, productIdValue) {
      assertStore(MANDIRI_STORE_NAMES.PRODUCTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      const productId = normalizeEntityIdentifier(productIdValue, 'product');
      const record = getBucket(getBucket(getState().products, accountScope) ?? new Map(), workspaceId)
        ?.get(productId);
      return record === undefined ? null : publicProduct(record);
    },
    async list(explicitAccountScope, explicitWorkspaceId) {
      assertStore(MANDIRI_STORE_NAMES.PRODUCTS);
      const accountScope = normalizeAccountScope(explicitAccountScope);
      const workspaceId = normalizeWorkspaceScope(explicitWorkspaceId);
      return Object.freeze([...(getBucket(
        getBucket(getState().products, accountScope) ?? new Map(),
        workspaceId,
      )?.values() ?? [])].map(publicProduct).sort((a, b) => a.name.localeCompare(b.name)));
    },
  });

  const inventoryRepository = {
    async appendMovement(accountValue, workspaceValue, movementInput, balanceInput, expectedVersion) {
      assertStore(MANDIRI_STORE_NAMES.PRODUCTS);
      assertStore(MANDIRI_STORE_NAMES.STOCK_MOVEMENTS, true);
      assertStore(MANDIRI_STORE_NAMES.INVENTORY_BALANCES, true);
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const movement = scopedInventory(normalizeStockMovement, accountScope, workspaceId, movementInput);
      const balance = scopedInventory(normalizeInventoryBalance, accountScope, workspaceId, balanceInput);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw storageError('data_invalid');
      if (movement.productId !== balance.productId || movement.movementId !== balance.lastMovementId) {
        throw storageError('data_invalid');
      }
      const product = getBucket(getBucket(getState().products, accountScope) ?? new Map(), workspaceId)
        ?.get(movement.productId);
      if (!product) throw storageError('invalid_reference');
      if (!product.stockTracking) throw storageError('stock_tracking_disabled');
      const movementBucket = ensureBucket(ensureBucket(getState().stockMovements, accountScope), workspaceId);
      if (
        movementBucket.has(movement.movementId)
        || [...movementBucket.values()].some((item) => item.operationId === movement.operationId)
      ) throw storageError('constraint_violation');
      const balanceBucket = ensureBucket(ensureBucket(getState().inventoryBalances, accountScope), workspaceId);
      const current = balanceBucket.get(movement.productId);
      const currentVersion = current?.version ?? 0;
      const currentQuantity = current?.quantityOnHand ?? 0;
      if (
        currentVersion !== expectedVersion
        || balance.version !== expectedVersion + 1
        || !Number.isSafeInteger(currentQuantity + movement.quantityDelta)
        || balance.quantityOnHand !== currentQuantity + movement.quantityDelta
      ) throw storageError('version_conflict');
      movementBucket.set(movement.movementId, clonePlainRecord(movement));
      balanceBucket.set(balance.productId, clonePlainRecord(balance));
      return Object.freeze({
        movement: publicInventory(normalizeStockMovement, movement),
        balance: publicInventory(normalizeInventoryBalance, balance),
      });
    },
    async getBalance(accountValue, workspaceValue, productValue) {
      assertStore(MANDIRI_STORE_NAMES.INVENTORY_BALANCES);
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const productId = normalizeEntityIdentifier(productValue, 'product');
      const record = getBucket(getBucket(getState().inventoryBalances, accountScope) ?? new Map(), workspaceId)
        ?.get(productId);
      return record ? publicInventory(normalizeInventoryBalance, record) : null;
    },
    async listBalances(accountValue, workspaceValue) {
      assertStore(MANDIRI_STORE_NAMES.INVENTORY_BALANCES);
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return Object.freeze([...(getBucket(
        getBucket(getState().inventoryBalances, accountScope) ?? new Map(), workspaceId,
      )?.values() ?? [])].map((record) => publicInventory(normalizeInventoryBalance, record)));
    },
    async listMovements(accountValue, workspaceValue, productValue) {
      assertStore(MANDIRI_STORE_NAMES.STOCK_MOVEMENTS);
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const productId = normalizeEntityIdentifier(productValue, 'product');
      return Object.freeze([...(getBucket(
        getBucket(getState().stockMovements, accountScope) ?? new Map(), workspaceId,
      )?.values() ?? [])]
        .filter((record) => record.productId === productId)
        .map((record) => publicInventory(normalizeStockMovement, record))
        .sort((a, b) => a.createdAtLocal.localeCompare(b.createdAtLocal)));
    },
  };
  Object.defineProperty(inventoryRepository, 'listForBackup', {
    enumerable: false,
    value: async (accountValue, workspaceValue) => {
      assertStore(MANDIRI_STORE_NAMES.STOCK_MOVEMENTS);
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return Object.freeze([...(getBucket(
        getBucket(getState().stockMovements, accountScope) ?? new Map(), workspaceId,
      )?.values() ?? [])].map((record) => publicInventory(normalizeStockMovement, record)));
    },
  });
  Object.freeze(inventoryRepository);

  return Object.freeze({
    workspaceRepository,
    membershipRepository,
    auditRepository,
    operationReceiptRepository,
    learningAttemptRepository,
    learningProgressRepository,
    categoryRepository,
    productRepository,
    inventoryRepository,
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
