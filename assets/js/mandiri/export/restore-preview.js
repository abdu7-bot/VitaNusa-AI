import { createPayloadDigest } from '../domain/ids.js';
import {
  backupError,
  MandiriBackupError,
  mapBackupError,
} from './backup-errors.js';
import {
  createBackupChecksumPayload,
  deepFreezeBackup,
  MAX_BACKUP_FILE_BYTES,
  normalizeBackupDocument,
} from './backup-schema.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function byteLength(value) {
  if (typeof TextEncoder !== 'function') throw backupError('file_read_failed');
  return new TextEncoder().encode(value).byteLength;
}

function parseBackupJson(text) {
  try {
    return JSON.parse(text, (key, value) => {
      if (DANGEROUS_KEYS.has(key)) throw backupError('dangerous_key');
      return value;
    });
  } catch (error) {
    if (error instanceof MandiriBackupError) throw error;
    throw backupError('json_invalid', error);
  }
}

export async function validateBackupDocument({
  backup,
  expectedAccountScope,
  digestFactory = createPayloadDigest,
} = {}) {
  if (typeof digestFactory !== 'function') throw backupError('checksum_failed');
  const normalized = normalizeBackupDocument(backup, { expectedAccountScope });
  let calculatedChecksum;
  try {
    calculatedChecksum = await digestFactory(createBackupChecksumPayload(normalized));
  } catch (error) {
    throw backupError('checksum_failed', error);
  }
  if (calculatedChecksum !== normalized.checksum) throw backupError('checksum_mismatch');
  return normalized;
}

export async function previewBackupText({
  text,
  expectedAccountScope,
  digestFactory = createPayloadDigest,
} = {}) {
  try {
    if (typeof text !== 'string' || text.length === 0) throw backupError('backup_invalid');
    if (byteLength(text) > MAX_BACKUP_FILE_BYTES) throw backupError('file_too_large');
    const parsed = parseBackupJson(text);
    const backup = await validateBackupDocument({
      backup: parsed,
      expectedAccountScope,
      digestFactory,
    });
    const workspace = backup.data.workspaces[0];

    return deepFreezeBackup({
      workspaceName: workspace.name,
      timezone: workspace.timezone,
      currencyCode: workspace.currencyCode,
      workspaceStatus: workspace.status,
      membershipCount: backup.recordCounts.memberships,
      auditEventCount: backup.recordCounts.auditEvents,
      operationReceiptCount: backup.recordCounts.operationReceipts,
      learningAttemptCount: backup.recordCounts.learningAttempts ?? 0,
      learningProgressCount: backup.recordCounts.learningProgress ?? 0,
      createdAt: backup.createdAt,
      formatVersion: backup.formatVersion,
      databaseSchemaVersion: backup.databaseSchemaVersion,
      checksumStatus: 'valid',
      scopeStatus: 'matched',
    });
  } catch (error) {
    if (error instanceof MandiriBackupError) throw error;
    throw mapBackupError(error, 'backup_invalid');
  }
}

export async function readBackupFile({
  file,
  expectedAccountScope,
  digestFactory = createPayloadDigest,
} = {}) {
  if (
    !file
    || typeof file !== 'object'
    || !Number.isSafeInteger(file.size)
    || file.size < 1
    || typeof file.text !== 'function'
  ) {
    throw backupError('backup_invalid');
  }
  if (file.size > MAX_BACKUP_FILE_BYTES) throw backupError('file_too_large');

  let text;
  try {
    text = await file.text();
  } catch (error) {
    throw backupError('file_read_failed', error);
  }
  return previewBackupText({ text, expectedAccountScope, digestFactory });
}
