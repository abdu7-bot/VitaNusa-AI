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
import { backupError, mapBackupError } from './backup-errors.js';

export const MANDIRI_BACKUP_FORMAT = 'vitanusa-mandiri-backup';
export const MANDIRI_BACKUP_FORMAT_VERSION = 2;
export const MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION = 2;
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
});
const V1_COLLECTION_FIELDS = Object.freeze([
  'workspaces', 'memberships', 'auditEvents', 'operationReceipts',
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
  return formatVersion === 1 ? V1_COLLECTION_FIELDS : COLLECTION_FIELDS;
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

  return Object.freeze({
    workspaces: Object.freeze(workspaces),
    memberships: Object.freeze(memberships),
    auditEvents: Object.freeze(auditEvents),
    operationReceipts: Object.freeze(operationReceipts),
    ...(collectionFields.includes('learningAttempts') ? {
      learningAttempts: Object.freeze(learningAttempts),
      learningProgress: Object.freeze(learningProgress),
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
  if (![1, MANDIRI_BACKUP_FORMAT_VERSION].includes(input.formatVersion)) {
    throw backupError('format_version_unsupported');
  }
  if (
    !Number.isSafeInteger(input.databaseSchemaVersion)
    || input.databaseSchemaVersion < 1
    || input.databaseSchemaVersion > MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION
    || (input.formatVersion === 1 && input.databaseSchemaVersion !== 1)
    || (input.formatVersion === 2 && input.databaseSchemaVersion !== 2)
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
