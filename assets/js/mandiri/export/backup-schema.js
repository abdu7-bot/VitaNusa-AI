import { normalizeAuditEvent } from '../domain/audit.js';
import { isValidEntityId } from '../domain/ids.js';
import { normalizeMembership } from '../domain/membership.js';
import {
  assertExactFields,
  normalizeIsoTimestamp,
  normalizeScope,
} from '../domain/validation.js';
import { normalizeWorkspace } from '../domain/workspace.js';
import { normalizeOperationReceipt } from '../repositories/operation-receipt-repository.js';
import { normalizeAttempt } from '../learning/domain/attempt.js';
import { normalizeProgress } from '../learning/domain/progress.js';
import { normalizeCategory } from '../pos/domain/category.js';
import { normalizeCartDraft, normalizeCartLine } from '../pos/domain/cart.js';
import { normalizeProduct } from '../pos/domain/product.js';
import { normalizeInventoryBalance, normalizeStockMovement } from '../pos/domain/inventory.js';
import { previewCartDraft } from '../pos/domain/cart.js';
import { backupError, mapBackupError } from './backup-errors.js';

export const MANDIRI_BACKUP_FORMAT = 'vitanusa-mandiri-backup';
export const MANDIRI_BACKUP_FORMAT_VERSION = 5;
export const MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION = 5;
export const MANDIRI_BACKUP_CHECKSUM_ALGORITHM = 'SHA-256';
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_VALIDATION_DEPTH = 32;

export const MANDIRI_BACKUP_RECORD_LIMITS = Object.freeze({
  workspaces: 1,
  memberships: 100,
  auditEvents: 5000,
  operationReceipts: 5000,
  learningAttempts: 5000,
  learningProgress: 2000,
  categories: 1000,
  products: 10000,
  stockMovements: 50000,
  inventoryBalances: 10000,
  cartDrafts: 10000,
  cartLines: 50000,
});
const V1_COLLECTION_FIELDS = Object.freeze([
  'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
]);
const V2_COLLECTION_FIELDS = Object.freeze([
  ...V1_COLLECTION_FIELDS, 'learningAttempts', 'learningProgress',
]);
const V3_COLLECTION_FIELDS = Object.freeze([
  ...V2_COLLECTION_FIELDS, 'categories', 'products',
]);
const V4_COLLECTION_FIELDS = Object.freeze([
  ...V3_COLLECTION_FIELDS, 'stockMovements', 'inventoryBalances',
]);
const V5_COLLECTION_FIELDS = Object.freeze([
  ...V4_COLLECTION_FIELDS, 'cartDrafts', 'cartLines',
]);

const ROOT_FIELDS = Object.freeze([
  'format',
  'formatVersion',
  'databaseSchemaVersion',
  'createdAt',
  'accountScope',
  'workspaceId',
  'checksumAlgorithm',
  'checksum',
  'recordCounts',
  'data',
]);
const COLLECTION_FIELDS = Object.freeze(Object.keys(MANDIRI_BACKUP_RECORD_LIMITS));
const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ACCOUNT_SCOPE_PATTERN = /^account:[0-9a-f]{64}$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function deepFreezeBackup(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreezeBackup(value[key], seen);
  }
  return Object.freeze(value);
}

export function assertSafeBackupValue(
  value,
  { maxDepth = MAX_BACKUP_VALIDATION_DEPTH, maxNodes = 200000 } = {},
) {
  const ancestors = new WeakSet();
  let nodes = 0;

  function visit(current, depth) {
    nodes += 1;
    if (nodes > maxNodes || depth > maxDepth) throw backupError('dangerous_key');
    if (current === null || typeof current !== 'object') return;
    if (ancestors.has(current)) throw backupError('dangerous_key');
    const prototype = Object.getPrototypeOf(current);
    if (
      (Array.isArray(current) && prototype !== Array.prototype)
      || (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null)
    ) {
      throw backupError('dangerous_key');
    }
    ancestors.add(current);
    try {
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== 'string' || DANGEROUS_KEYS.has(key)) {
          throw backupError('dangerous_key');
        }
        if (Array.isArray(current) && key === 'length') continue;
        visit(current[key], depth + 1);
      }
    } finally {
      ancestors.delete(current);
    }
  }

  visit(value, 0);
  return true;
}

export function normalizeBackupAccountScope(value) {
  let scope;
  try {
    scope = normalizeScope(value, 'backup.accountScope');
  } catch (error) {
    throw mapBackupError(error, 'backup_invalid');
  }
  if (!ACCOUNT_SCOPE_PATTERN.test(scope)) throw backupError('backup_invalid');
  return scope;
}

export function normalizeBackupWorkspaceId(value) {
  if (!isValidEntityId(value, 'workspace')) throw backupError('backup_invalid');
  return value;
}

function exact(value, fields, path) {
  try {
    return assertExactFields(value, fields, { requiredFields: fields, path });
  } catch (error) {
    throw mapBackupError(error, 'backup_invalid');
  }
}

function fieldsForVersion(formatVersion) {
  if (formatVersion === 1) return V1_COLLECTION_FIELDS;
  if (formatVersion === 2) return V2_COLLECTION_FIELDS;
  if (formatVersion === 3) return V3_COLLECTION_FIELDS;
  if (formatVersion === 4) return V4_COLLECTION_FIELDS;
  return V5_COLLECTION_FIELDS;
}

function normalizeCounts(value, collectionFields) {
  exact(value, collectionFields, 'backup.recordCounts');
  const output = {};
  for (const field of collectionFields) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) {
      throw backupError('backup_invalid');
    }
    output[field] = value[field];
  }
  return Object.freeze(output);
}

function assertCollection(value, name) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw backupError('backup_invalid');
  }
  if (value.length > MANDIRI_BACKUP_RECORD_LIMITS[name]) {
    throw backupError('record_limit_exceeded');
  }
  return value;
}

function normalizeRecords(data, accountScope, workspaceId, collectionFields) {
  exact(data, collectionFields, 'backup.data');
  for (const field of collectionFields) assertCollection(data[field], field);
  if (data.workspaces.length !== 1) throw backupError('integrity_error');

  let workspaces;
  let memberships;
  let auditEvents;
  let operationReceipts;
  let learningAttempts = [];
  let learningProgress = [];
  let categories = [];
  let products = [];
  let stockMovements = [];
  let inventoryBalances = [];
  let cartDrafts = [];
  let cartLines = [];
  try {
    workspaces = data.workspaces.map((record) => normalizeWorkspace(record));
    memberships = data.memberships.map((record) => normalizeMembership(record, {
      accountScope,
      workspaceId,
    }));
    auditEvents = data.auditEvents.map((record) => normalizeAuditEvent(record));
    operationReceipts = data.operationReceipts.map((record) => normalizeOperationReceipt(record));
    if (collectionFields.includes('learningAttempts')) {
      learningAttempts = data.learningAttempts.map((record) => normalizeAttempt(record));
      learningProgress = data.learningProgress.map((record) => normalizeProgress(record));
    }
    if (collectionFields.includes('categories')) {
      categories = data.categories.map((record) => normalizeCategory(record, { workspaceId }));
      products = data.products.map((record) => normalizeProduct(record, { workspaceId }));
    }
    if (collectionFields.includes('stockMovements')) {
      stockMovements = data.stockMovements.map((record) => normalizeStockMovement(record, { workspaceId }));
      inventoryBalances = data.inventoryBalances.map((record) => normalizeInventoryBalance(record, { workspaceId }));
    }
    if (collectionFields.includes('cartDrafts')) {
      cartDrafts = data.cartDrafts.map((record) => normalizeCartDraft(record, { workspaceId }));
      cartLines = data.cartLines.map((record) => normalizeCartLine(record, { workspaceId }));
    }
  } catch (error) {
    if (['cross_account_scope', 'cross_workspace_scope', 'scope_mismatch'].includes(error?.code)) {
      throw backupError('integrity_error', error);
    }
    throw mapBackupError(error, 'backup_invalid');
  }

  const workspace = workspaces[0];
  if (
    workspace.accountScope !== accountScope
    || workspace.workspaceId !== workspaceId
    || workspace.status !== 'active'
  ) {
    throw backupError('integrity_error');
  }

  const scopedCollections = [memberships, auditEvents, operationReceipts];
  if (scopedCollections.some((records) => records.some((record) => (
    record.accountScope !== accountScope || record.workspaceId !== workspaceId
  )))) {
    throw backupError('integrity_error');
  }

  if (!memberships.some((record) => (
    record.role === 'merchant_owner' && record.status === 'active'
  ))) {
    throw backupError('integrity_error');
  }

  const identifiers = [
    [memberships, 'membershipId'],
    [auditEvents, 'eventId'],
    [operationReceipts, 'operationId'],
  ];
  for (const [records, field] of identifiers) {
    const values = records.map((record) => record[field]);
    if (new Set(values).size !== values.length) throw backupError('integrity_error');
  }

  for (const event of auditEvents) {
    if (event.entityType === 'workspace' && event.entityId !== workspaceId) {
      throw backupError('integrity_error');
    }
  }
  for (const receipt of operationReceipts) {
    if (receipt.entityType === 'workspace' && receipt.entityId !== workspaceId) {
      throw backupError('integrity_error');
    }
  }

  const expectedLearnerScope = `user:${accountScope.slice('account:'.length)}`;
  if (
    learningAttempts.some((record) => record.learnerScope !== expectedLearnerScope)
    || learningProgress.some((record) => record.learnerScope !== expectedLearnerScope)
  ) {
    throw backupError('integrity_error');
  }
  if (new Set(learningAttempts.map((record) => record.attemptId)).size !== learningAttempts.length) {
    throw backupError('integrity_error');
  }
  if (
    learningAttempts.some((record) => record.status !== 'completed')
    || new Set(learningAttempts.map((record) => record.operationId)).size !== learningAttempts.length
  ) {
    throw backupError('integrity_error');
  }
  const progressKeys = learningProgress.map((record) => (
    `${record.courseId}\u0000${record.moduleId}\u0000${record.lessonId}`
  ));
  if (new Set(progressKeys).size !== progressKeys.length) throw backupError('integrity_error');
  const attemptsById = new Map(learningAttempts.map((attempt) => [attempt.attemptId, attempt]));
  for (const progress of learningProgress) {
    const matchingAttempts = learningAttempts.filter((attempt) => (
      attempt.courseId === progress.courseId
      && attempt.moduleId === progress.moduleId
      && attempt.lessonId === progress.lessonId
      && attempt.contentVersion === progress.contentVersion
    ));
    const lastAttempt = attemptsById.get(progress.lastAttemptId);
    const bestScore = matchingAttempts.reduce(
      (best, attempt) => Math.max(best, attempt.scoreBasisPoints),
      -1,
    );
    if (
      !lastAttempt
      || !matchingAttempts.includes(lastAttempt)
      || progress.attemptCount !== matchingAttempts.length
      || progress.bestScoreBasisPoints !== bestScore
      || progress.lastPracticedAtLocal !== lastAttempt.completedAtLocal
    ) {
      throw backupError('integrity_error');
    }
  }

  if (new Set(categories.map((record) => record.categoryId)).size !== categories.length) {
    throw backupError('integrity_error');
  }
  if (new Set(products.map((record) => record.productId)).size !== products.length) {
    throw backupError('integrity_error');
  }
  const categoryIds = new Set(categories.map((record) => record.categoryId));
  const skus = products.filter((record) => record.sku !== null).map((record) => record.sku);
  if (
    new Set(skus).size !== skus.length
    || products.some((record) => record.categoryId !== null && !categoryIds.has(record.categoryId))
  ) throw backupError('integrity_error');

  const productsById = new Map(products.map((record) => [record.productId, record]));
  const cartDraftsById = new Map(cartDrafts.map((record) => [record.cartId, record]));
  if (collectionFields.includes('cartDrafts')) {
    if (
      new Set(cartDrafts.map((record) => record.cartId)).size !== cartDrafts.length
      || new Set(cartLines.map((record) => `${record.cartId}\u0000${record.lineNo}`)).size !== cartLines.length
      || cartLines.some((record) => !cartDraftsById.has(record.cartId))
      || cartLines.some((record) => !productsById.get(record.productId))
    ) throw backupError('integrity_error');
    for (const draft of cartDrafts) {
      const linesForCart = cartLines.filter((record) => record.cartId === draft.cartId);
      try {
        previewCartDraft(draft, linesForCart);
      } catch (error) {
        throw backupError('integrity_error', error);
      }
    }
  }
  const movementIds = stockMovements.map((record) => record.movementId);
  if (
    new Set(movementIds).size !== movementIds.length
    || new Set(stockMovements.map((record) => record.operationId)).size !== stockMovements.length
    || new Set(inventoryBalances.map((record) => record.productId)).size !== inventoryBalances.length
    || stockMovements.some((record) => !productsById.get(record.productId)?.stockTracking)
    || inventoryBalances.some((record) => !productsById.get(record.productId)?.stockTracking)
  ) throw backupError('integrity_error');
  for (const balance of inventoryBalances) {
    const ledger = stockMovements.filter((record) => record.productId === balance.productId);
    const total = ledger.reduce((sum, record) => sum + record.quantityDelta, 0);
    const lastMovement = ledger.find((record) => record.movementId === balance.lastMovementId);
    if (
      !Number.isSafeInteger(total)
      || ledger.length !== balance.version
      || total !== balance.quantityOnHand
      || !lastMovement
      || lastMovement.createdAtLocal !== balance.updatedAtLocal
    ) throw backupError('integrity_error');
  }
  if (stockMovements.some((record) => (
    !inventoryBalances.some((balance) => balance.productId === record.productId)
  ))) throw backupError('integrity_error');

  return Object.freeze({
    workspaces: Object.freeze(workspaces),
    memberships: Object.freeze(memberships),
    auditEvents: Object.freeze(auditEvents),
    operationReceipts: Object.freeze(operationReceipts),
    ...(collectionFields.includes('learningAttempts') ? {
      learningAttempts: Object.freeze(learningAttempts),
      learningProgress: Object.freeze(learningProgress),
    } : {}),
    ...(collectionFields.includes('categories') ? {
      categories: Object.freeze(categories),
      products: Object.freeze(products),
    } : {}),
    ...(collectionFields.includes('stockMovements') ? {
      stockMovements: Object.freeze(stockMovements),
      inventoryBalances: Object.freeze(inventoryBalances),
    } : {}),
    ...(collectionFields.includes('cartDrafts') ? {
      cartDrafts: Object.freeze(cartDrafts),
      cartLines: Object.freeze(cartLines),
    } : {}),
  });
}

export function createBackupChecksumPayload(backup) {
  return Object.freeze({
    format: backup.format,
    formatVersion: backup.formatVersion,
    databaseSchemaVersion: backup.databaseSchemaVersion,
    createdAt: backup.createdAt,
    accountScope: backup.accountScope,
    workspaceId: backup.workspaceId,
    checksumAlgorithm: backup.checksumAlgorithm,
    recordCounts: backup.recordCounts,
    data: backup.data,
  });
}

export function normalizeBackupDocument(input, { expectedAccountScope } = {}) {
  assertSafeBackupValue(input);
  exact(input, ROOT_FIELDS, 'backup');
  if (input.format !== MANDIRI_BACKUP_FORMAT) throw backupError('format_unknown');
  if (![1, 2, 3, 4, MANDIRI_BACKUP_FORMAT_VERSION].includes(input.formatVersion)) {
    throw backupError('format_version_unsupported');
  }
  if (
    !Number.isSafeInteger(input.databaseSchemaVersion)
    || input.databaseSchemaVersion < 1
    || input.databaseSchemaVersion > MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION
    || (input.formatVersion === 1 && input.databaseSchemaVersion !== 1)
    || (input.formatVersion === 2 && input.databaseSchemaVersion !== 2)
    || (input.formatVersion === 3 && input.databaseSchemaVersion !== 3)
    || (input.formatVersion === 4 && input.databaseSchemaVersion !== 4)
    || (input.formatVersion === 5 && input.databaseSchemaVersion !== 5)
  ) {
    throw backupError('schema_version_unsupported');
  }
  if (input.checksumAlgorithm !== MANDIRI_BACKUP_CHECKSUM_ALGORITHM) {
    throw backupError('backup_invalid');
  }
  if (typeof input.checksum !== 'string' || !CHECKSUM_PATTERN.test(input.checksum)) {
    throw backupError('backup_invalid');
  }

  let createdAt;
  try {
    createdAt = normalizeIsoTimestamp(input.createdAt, 'backup.createdAt');
  } catch (error) {
    throw mapBackupError(error, 'backup_invalid');
  }
  const accountScope = normalizeBackupAccountScope(input.accountScope);
  if (expectedAccountScope !== undefined) {
    const expected = normalizeBackupAccountScope(expectedAccountScope);
    if (accountScope !== expected) throw backupError('scope_mismatch');
  }
  const workspaceId = normalizeBackupWorkspaceId(input.workspaceId);
  const collectionFields = fieldsForVersion(input.formatVersion);
  const recordCounts = normalizeCounts(input.recordCounts, collectionFields);
  const data = normalizeRecords(input.data, accountScope, workspaceId, collectionFields);

  for (const field of collectionFields) {
    if (recordCounts[field] !== data[field].length) throw backupError('integrity_error');
  }

  return deepFreezeBackup({
    format: MANDIRI_BACKUP_FORMAT,
    formatVersion: input.formatVersion,
    databaseSchemaVersion: input.databaseSchemaVersion,
    createdAt,
    accountScope,
    workspaceId,
    checksumAlgorithm: MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
    checksum: input.checksum,
    recordCounts,
    data,
  });
}
