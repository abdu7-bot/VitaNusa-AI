import { backupError, MandiriBackupError } from './backup-errors.js';
import { normalizeBackupDocument } from './backup-schema.js';

const RESERVED_WINDOWS_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SLUG_LENGTH = 64;

export function sanitizeWorkspaceFilenamePart(value) {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  let slug = normalized
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.\s_-]+|[.\s_-]+$/g, '');
  slug = [...slug].slice(0, MAX_SLUG_LENGTH).join('').replace(/[.\s_-]+$/g, '');
  if (!slug || slug === '.' || slug === '..' || RESERVED_WINDOWS_NAMES.test(slug)) {
    return 'Workspace';
  }
  return slug;
}

export function createBackupFilename(workspaceName, createdAt = new Date().toISOString()) {
  const date = typeof createdAt === 'string' ? createdAt.slice(0, 10) : '';
  if (!DATE_PATTERN.test(date)) throw backupError('download_failed');
  return `VitaNusa-Mandiri-Backup-${sanitizeWorkspaceFilenamePart(workspaceName)}-${date}.json`;
}

export function serializeBackupJson(backup) {
  const normalized = normalizeBackupDocument(backup);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function downloadBackupJson({
  backup,
  workspaceName,
  userInitiated = false,
  documentRef = globalThis.document,
  URLRef = globalThis.URL,
  BlobCtor = globalThis.Blob,
} = {}) {
  if (userInitiated !== true) throw backupError('download_failed');
  if (
    !documentRef?.createElement
    || !documentRef.body?.append
    || typeof URLRef?.createObjectURL !== 'function'
    || typeof URLRef?.revokeObjectURL !== 'function'
    || typeof BlobCtor !== 'function'
  ) {
    throw backupError('download_failed');
  }

  let objectUrl;
  let anchor;
  try {
    const json = serializeBackupJson(backup);
    const blob = new BlobCtor([json], { type: 'application/json;charset=utf-8' });
    objectUrl = URLRef.createObjectURL(blob);
    anchor = documentRef.createElement('a');
    anchor.href = objectUrl;
    anchor.download = createBackupFilename(workspaceName, backup.createdAt);
    anchor.hidden = true;
    documentRef.body.append(anchor);
    anchor.click();
    return Object.freeze({ filename: anchor.download, byteSize: blob.size });
  } catch (error) {
    if (error instanceof MandiriBackupError) throw error;
    throw backupError('download_failed', error);
  } finally {
    anchor?.remove?.();
    if (objectUrl !== undefined) URLRef.revokeObjectURL(objectUrl);
  }
}
