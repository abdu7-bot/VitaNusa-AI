const SAFE_MESSAGES = Object.freeze({
  indexeddb_unavailable: 'Penyimpanan lokal IndexedDB tidak tersedia pada perangkat ini.',
  database_open_failed: 'Data lokal tidak dapat dibuka. Coba tutup lalu buka kembali aplikasi.',
  database_open_blocked: 'Pembaruan data lokal diblokir oleh tab VitaNusa lain. Tutup tab lain lalu coba lagi.',
  schema_too_new: 'Versi data lokal lebih baru daripada aplikasi ini. Data tidak akan diubah. Perbarui aplikasi sebelum melanjutkan.',
  migration_failed: 'Pembaruan struktur data lokal gagal. Data lama tidak dihapus.',
  transaction_aborted: 'Perubahan data lokal dibatalkan dan tidak disimpan.',
  constraint_violation: 'Data tersebut sudah ada atau melanggar batas penyimpanan.',
  quota_exceeded: 'Ruang penyimpanan lokal tidak mencukupi. Data tidak dihapus otomatis.',
  data_invalid: 'Data lokal tidak valid dan tidak disimpan.',
  scope_mismatch: 'Data berada di luar akun atau workspace yang dipilih.',
  record_not_found: 'Data yang diminta tidak ditemukan pada scope ini.',
  duplicate_sku: 'SKU sudah digunakan oleh produk lain pada workspace ini.',
  version_conflict: 'Data telah berubah. Muat ulang sebelum mencoba kembali.',
  invalid_reference: 'Referensi data tidak valid untuk workspace ini.',
  idempotency_mismatch: 'Operation ID telah digunakan dengan payload berbeda.',
  permission_denied: 'Role workspace aktif tidak memiliki izin untuk perubahan ini.',
  storage_unknown: 'Penyimpanan lokal mengalami masalah yang tidak dikenal.',
});

export const MANDIRI_STORAGE_ERROR_CODES = Object.freeze(Object.keys(SAFE_MESSAGES));

const SAFE_CAUSE_NAMES = new Set([
  'AbortError',
  'ConstraintError',
  'DataError',
  'Error',
  'InvalidAccessError',
  'InvalidStateError',
  'MandiriDomainError',
  'MandiriStorageError',
  'NotFoundError',
  'QuotaExceededError',
  'ReadOnlyError',
  'TransactionInactiveError',
  'TypeError',
  'UnknownError',
  'VersionError',
]);

function sanitizeCause(cause) {
  if (cause === undefined) return undefined;
  const name = typeof cause?.name === 'string' && SAFE_CAUSE_NAMES.has(cause.name)
    ? cause.name
    : 'Error';
  return Object.freeze({ name });
}

export class MandiriStorageError extends Error {
  constructor(code, message = SAFE_MESSAGES[code], { cause } = {}) {
    const safeCode = Object.hasOwn(SAFE_MESSAGES, code) ? code : 'storage_unknown';
    super(message ?? SAFE_MESSAGES[safeCode]);
    this.name = 'MandiriStorageError';
    this.code = safeCode;
    const safeCause = sanitizeCause(cause);
    if (safeCause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: false,
        enumerable: false,
        value: safeCause,
        writable: false,
      });
    }
  }
}

export function storageError(code, cause) {
  return new MandiriStorageError(code, SAFE_MESSAGES[code], { cause });
}

export function mapStorageError(error, fallbackCode = 'storage_unknown') {
  if (error instanceof MandiriStorageError) return error;

  const codeByName = Object.freeze({
    AbortError: 'transaction_aborted',
    ConstraintError: 'constraint_violation',
    DataError: 'data_invalid',
    InvalidAccessError: 'data_invalid',
    InvalidStateError: 'transaction_aborted',
    NotFoundError: 'data_invalid',
    QuotaExceededError: 'quota_exceeded',
    ReadOnlyError: 'data_invalid',
    TransactionInactiveError: 'transaction_aborted',
    VersionError: 'schema_too_new',
    UnknownError: 'storage_unknown',
  });
  const mappedCode = codeByName[error?.name] ?? fallbackCode;
  return storageError(mappedCode, error);
}

export function getSafeStorageMessage(code) {
  return SAFE_MESSAGES[code] ?? SAFE_MESSAGES.storage_unknown;
}
