import { createPayloadDigest } from '../domain/ids.js';
import { normalizeIsoTimestamp } from '../domain/validation.js';
import { ATOMIC_WORKSPACE_STORE_NAMES } from '../repositories/repository-context.js';
import {
  backupError,
  MandiriBackupError,
  mapBackupError,
} from './backup-errors.js';
import {
  createBackupChecksumPayload,
  deepFreezeBackup,
  MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
  MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION,
  MANDIRI_BACKUP_FORMAT,
  MANDIRI_BACKUP_FORMAT_VERSION,
  MANDIRI_BACKUP_RECORD_LIMITS,
  normalizeBackupAccountScope,
  normalizeBackupDocument,
  normalizeBackupWorkspaceId,
} from './backup-schema.js';

const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;

function compareId(field) {
  return (left, right) => left[field].localeCompare(right[field]);
}

function sortedRecords(records, field) {
  return Object.freeze([...records].sort(compareId(field)));
}

function assertRecordLimit(records, name) {
  if (!Array.isArray(records) || records.length > MANDIRI_BACKUP_RECORD_LIMITS[name]) {
    throw backupError('record_limit_exceeded');
  }
  return records;
}

async function readScopedBackupRecords(repositoryContext, accountScope, workspaceId) {
  return repositoryContext.run(
    ATOMIC_WORKSPACE_STORE_NAMES,
    'readonly',
    async (repositories) => {
      if (
        typeof repositories.auditRepository?.listForBackup !== 'function'
        || typeof repositories.operationReceiptRepository?.listForBackup !== 'function'
      ) {
        throw backupError('backup_invalid');
      }

      // Schedule every request while the same IndexedDB transaction is active.
      const workspacePromise = repositories.workspaceRepository.listByAccount(accountScope);
      const membershipPromise = repositories.membershipRepository.listByWorkspace(
        accountScope,
        workspaceId,
      );
      const auditPromise = repositories.auditRepository.listForBackup(
        accountScope,
        workspaceId,
        { limit: MANDIRI_BACKUP_RECORD_LIMITS.auditEvents + 1 },
      );
      const receiptPromise = repositories.operationReceiptRepository.listForBackup(
        accountScope,
        workspaceId,
        { limit: MANDIRI_BACKUP_RECORD_LIMITS.operationReceipts + 1 },
      );

      const [workspaces, memberships, auditEvents, operationReceipts] = await Promise.all([
        workspacePromise,
        membershipPromise,
        auditPromise,
        receiptPromise,
      ]);
      return { workspaces, memberships, auditEvents, operationReceipts };
    },
  );
}

export function createBackupService({
  repositoryContext,
  digestFactory = createPayloadDigest,
  now = () => new Date().toISOString(),
} = {}) {
  if (
    !repositoryContext
    || typeof repositoryContext.run !== 'function'
    || typeof digestFactory !== 'function'
    || typeof now !== 'function'
  ) {
    throw backupError('backup_invalid');
  }

  async function createWorkspaceBackup({ accountScope: accountScopeValue, workspaceId: workspaceIdValue } = {}) {
    try {
      const accountScope = normalizeBackupAccountScope(accountScopeValue);
      const workspaceId = normalizeBackupWorkspaceId(workspaceIdValue);
      const records = await readScopedBackupRecords(repositoryContext, accountScope, workspaceId);

      if (records.workspaces.length === 0) throw backupError('workspace_not_found');
      if (records.workspaces.length !== 1) throw backupError('integrity_error');
      const workspace = records.workspaces[0];
      if (
        workspace.accountScope !== accountScope
        || workspace.workspaceId !== workspaceId
        || workspace.status !== 'active'
      ) {
        throw backupError('workspace_not_found');
      }

      for (const [name, values] of Object.entries(records)) {
        assertRecordLimit(values, name);
      }

      const createdAt = normalizeIsoTimestamp(now(), 'backup.createdAt');
      const data = Object.freeze({
        workspaces: Object.freeze([workspace]),
        memberships: sortedRecords(records.memberships, 'membershipId'),
        auditEvents: sortedRecords(records.auditEvents, 'eventId'),
        operationReceipts: sortedRecords(records.operationReceipts, 'operationId'),
      });
      const recordCounts = Object.freeze(Object.fromEntries(
        Object.entries(data).map(([name, values]) => [name, values.length]),
      ));
      const unsignedBackup = deepFreezeBackup({
        format: MANDIRI_BACKUP_FORMAT,
        formatVersion: MANDIRI_BACKUP_FORMAT_VERSION,
        databaseSchemaVersion: MANDIRI_BACKUP_DATABASE_SCHEMA_VERSION,
        createdAt,
        accountScope,
        workspaceId,
        checksumAlgorithm: MANDIRI_BACKUP_CHECKSUM_ALGORITHM,
        recordCounts,
        data,
      });

      let checksum;
      try {
        checksum = await digestFactory(createBackupChecksumPayload(unsignedBackup));
      } catch (error) {
        throw backupError('checksum_failed', error);
      }
      if (typeof checksum !== 'string' || !CHECKSUM_PATTERN.test(checksum)) {
        throw backupError('checksum_failed');
      }

      return normalizeBackupDocument({ ...unsignedBackup, checksum }, { expectedAccountScope: accountScope });
    } catch (error) {
      if (error instanceof MandiriBackupError) throw error;
      throw mapBackupError(error, 'integrity_error');
    }
  }

  return Object.freeze({ createWorkspaceBackup });
}
