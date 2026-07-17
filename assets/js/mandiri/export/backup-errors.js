import { MandiriDomainError } from '../domain/validation.js';
import { MandiriStorageError } from '../storage/storage-errors.js';

const SAFE_MESSAGES = Object.freeze({
  auth_required: 'Login diperlukan sebelum membuat atau memeriksa backup lokal.',
  feature_disabled: 'VitaNusa Mandiri belum tersedia pada build ini.',
  workspace_not_found: 'Workspace lokal aktif tidak ditemukan pada akun ini.',
  scope_mismatch: 'File ini dibuat untuk akun VitaNusa yang berbeda. Tidak ada data yang diubah.',
  integrity_error: 'Data workspace lokal tidak konsisten. Backup tidak dibuat atau digunakan.',
  record_limit_exceeded: 'Jumlah record melebihi batas backup Fase 1. Backup parsial tidak dibuat.',
  checksum_failed: 'Checksum backup tidak dapat dibuat atau diperiksa.',
  backup_invalid: 'Struktur backup tidak valid. Tidak ada data yang diubah.',
  download_failed: 'File backup belum dapat diunduh. Coba lagi dari perangkat ini.',
  file_too_large: 'Ukuran file melebihi batas 5 MiB. File tidak dibaca.',
  file_read_failed: 'File backup tidak dapat dibaca pada perangkat ini.',
  json_invalid: 'Isi file bukan JSON backup yang valid.',
  format_unknown: 'Format file bukan backup VitaNusa Mandiri yang didukung.',
  format_version_unsupported: 'Versi format backup belum didukung oleh aplikasi ini.',
  schema_version_unsupported: 'File dibuat oleh versi VitaNusa Mandiri yang lebih baru. Perbarui aplikasi sebelum memeriksa file ini.',
  checksum_mismatch: 'File backup berubah atau rusak. File tidak dapat digunakan untuk pemulihan.',
  dangerous_key: 'File memuat struktur object yang tidak aman dan ditolak.',
  restore_write_forbidden: 'Fase 1 hanya dapat memeriksa backup dan tidak dapat menulis data pemulihan.',
  unknown_error: 'Terjadi kendala yang tidak dikenal. Tidak ada data yang diubah.',
});

export const MANDIRI_BACKUP_ERROR_CODES = Object.freeze(Object.keys(SAFE_MESSAGES));

function sanitizeCause(cause) {
  if (cause === undefined) return undefined;
  const name = typeof cause?.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(cause.name)
    ? cause.name
    : 'Error';
  const code = typeof cause?.code === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(cause.code)
    ? cause.code
    : undefined;
  return Object.freeze(code ? { name, code } : { name });
}

export class MandiriBackupError extends Error {
  constructor(code, { cause } = {}) {
    const safeCode = Object.hasOwn(SAFE_MESSAGES, code) ? code : 'unknown_error';
    super(SAFE_MESSAGES[safeCode]);
    this.name = 'MandiriBackupError';
    this.code = safeCode;
    const safeCause = sanitizeCause(cause);
    if (safeCause) {
      Object.defineProperty(this, 'cause', {
        configurable: false,
        enumerable: false,
        value: safeCause,
        writable: false,
      });
    }
  }
}

export function backupError(code, cause) {
  return new MandiriBackupError(code, { cause });
}

export function mapBackupError(error, fallbackCode = 'unknown_error') {
  if (error instanceof MandiriBackupError) return error;

  if (error instanceof MandiriStorageError) {
    if (error.code === 'scope_mismatch') return backupError('scope_mismatch', error);
    if (error.code === 'record_not_found') return backupError('workspace_not_found', error);
    if (error.code === 'schema_too_new') return backupError('schema_version_unsupported', error);
    return backupError(fallbackCode, error);
  }

  if (error instanceof MandiriDomainError) {
    if (['cross_account_scope', 'cross_workspace_scope', 'scope_mismatch'].includes(error.code)) {
      return backupError('scope_mismatch', error);
    }
    if (['unsafe_payload_field', 'unsafe_prototype'].includes(error.code)) {
      return backupError('dangerous_key', error);
    }
    return backupError(fallbackCode, error);
  }

  return backupError(fallbackCode, error);
}

export function getBackupErrorMessage(code) {
  return SAFE_MESSAGES[code] ?? SAFE_MESSAGES.unknown_error;
}
