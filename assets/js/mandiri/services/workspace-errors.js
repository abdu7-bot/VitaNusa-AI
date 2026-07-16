import { MandiriDomainError } from '../domain/validation.js';
import { MandiriStorageError } from '../storage/storage-errors.js';

const SAFE_MESSAGES = Object.freeze({
  auth_required: 'Login diperlukan untuk memisahkan workspace lokal antar-akun.',
  feature_disabled: 'VitaNusa Mandiri belum tersedia pada build ini.',
  invalid_workspace_input: 'Data workspace belum valid. Periksa nama, zona waktu, dan mata uang.',
  workspace_already_exists: 'Akun ini sudah memiliki workspace lokal pada perangkat ini.',
  operation_in_flight: 'Pembuatan workspace lokal masih berlangsung. Tunggu hingga selesai.',
  idempotency_mismatch: 'Permintaan ini memakai ID operasi yang sama dengan data berbeda. Tidak ada perubahan baru yang dibuat.',
  integrity_error: 'Data workspace lokal tidak konsisten. Tidak ada data yang diubah.',
  indexeddb_unavailable: 'Penyimpanan lokal IndexedDB tidak tersedia pada perangkat ini.',
  database_open_blocked: 'Penyimpanan lokal sedang dipakai tab lain. Tutup tab lain lalu coba lagi.',
  quota_exceeded: 'Ruang penyimpanan lokal tidak mencukupi. Tidak ada data yang dihapus otomatis.',
  transaction_aborted: 'Pembuatan workspace dibatalkan. Tidak ada perubahan parsial yang disimpan.',
  scope_mismatch: 'Data berada di luar akun lokal yang sedang aktif.',
  storage_error: 'Penyimpanan lokal mengalami kendala. Tidak ada data yang dikirim ke cloud.',
  unknown_error: 'Terjadi kendala yang tidak dikenal. Tidak ada data baru yang disimpan.',
});

export const WORKSPACE_ERROR_CODES = Object.freeze(Object.keys(SAFE_MESSAGES));

function safeCause(cause) {
  if (cause === undefined) return undefined;
  const name = typeof cause?.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(cause.name)
    ? cause.name
    : 'Error';
  const code = typeof cause?.code === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(cause.code)
    ? cause.code
    : undefined;
  return Object.freeze(code ? { name, code } : { name });
}

export class MandiriWorkspaceError extends Error {
  constructor(code, { cause } = {}) {
    const safeCode = Object.hasOwn(SAFE_MESSAGES, code) ? code : 'unknown_error';
    super(SAFE_MESSAGES[safeCode]);
    this.name = 'MandiriWorkspaceError';
    this.code = safeCode;
    const sanitizedCause = safeCause(cause);
    if (sanitizedCause) {
      Object.defineProperty(this, 'cause', {
        configurable: false,
        enumerable: false,
        value: sanitizedCause,
        writable: false,
      });
    }
  }
}

export function workspaceError(code, cause) {
  return new MandiriWorkspaceError(code, { cause });
}

export function mapWorkspaceError(error, fallbackCode = 'unknown_error') {
  if (error instanceof MandiriWorkspaceError) return error;

  if (error instanceof MandiriStorageError) {
    const codeMap = {
      indexeddb_unavailable: 'indexeddb_unavailable',
      database_open_blocked: 'database_open_blocked',
      quota_exceeded: 'quota_exceeded',
      transaction_aborted: 'transaction_aborted',
      scope_mismatch: 'scope_mismatch',
    };
    return workspaceError(codeMap[error.code] ?? 'storage_error', error);
  }

  if (error instanceof MandiriDomainError) {
    if (error.code === 'idempotency_mismatch') {
      return workspaceError('idempotency_mismatch', error);
    }
    if (['cross_account_scope', 'cross_workspace_scope', 'scope_mismatch'].includes(error.code)) {
      return workspaceError('scope_mismatch', error);
    }
    return workspaceError(fallbackCode, error);
  }

  return workspaceError(fallbackCode, error);
}

export function isRetryableWorkspaceError(error) {
  const code = error instanceof MandiriWorkspaceError ? error.code : mapWorkspaceError(error).code;
  return [
    'database_open_blocked',
    'indexeddb_unavailable',
    'operation_in_flight',
    'quota_exceeded',
    'storage_error',
    'transaction_aborted',
    'unknown_error',
  ].includes(code);
}

export function getWorkspaceErrorMessage(code) {
  return SAFE_MESSAGES[code] ?? SAFE_MESSAGES.unknown_error;
}
