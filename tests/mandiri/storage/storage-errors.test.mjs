import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MandiriStorageError,
  MANDIRI_STORAGE_ERROR_CODES,
  mapStorageError,
  storageError,
} from '../../../assets/js/mandiri/storage/storage-errors.js';

test('storage error mempunyai kode dan pesan aman', () => {
  const error = storageError('quota_exceeded', new Error('payload-rahasia'));
  assert.equal(error instanceof MandiriStorageError, true);
  assert.equal(error.code, 'quota_exceeded');
  assert.doesNotMatch(error.message, /payload-rahasia/);
  assert.deepEqual(error.cause, { name: 'Error' });
  assert.equal(Object.hasOwn(error.cause, 'message'), false);
  assert.equal(Object.keys(error).includes('cause'), false);
});

test('cause dengan nama tidak dikenal tidak menyimpan payload', () => {
  const error = storageError('storage_unknown', {
    name: 'TOKEN-rahasia',
    message: 'record lengkap pengguna',
    payload: { accessToken: 'abc' },
  });
  assert.deepEqual(error.cause, { name: 'Error' });
  assert.doesNotMatch(JSON.stringify(error.cause), /TOKEN|record|accessToken|abc/i);
});

test('kode storage minimum tersedia', () => {
  for (const code of [
    'indexeddb_unavailable',
    'database_open_failed',
    'database_open_blocked',
    'schema_too_new',
    'migration_failed',
    'transaction_aborted',
    'constraint_violation',
    'quota_exceeded',
    'data_invalid',
    'scope_mismatch',
    'record_not_found',
    'storage_unknown',
  ]) {
    assert.equal(MANDIRI_STORAGE_ERROR_CODES.includes(code), true);
  }
});

test('DOMException name dipetakan tanpa browser message mentah', () => {
  const constraint = mapStorageError({ name: 'ConstraintError', message: 'TOKEN-ASLI' });
  const quota = mapStorageError({ name: 'QuotaExceededError', message: 'DATA-PENGGUNA' });
  const data = mapStorageError({ name: 'DataError', message: 'PAYLOAD-LENGKAP' });
  assert.equal(constraint.code, 'constraint_violation');
  assert.equal(quota.code, 'quota_exceeded');
  assert.equal(data.code, 'data_invalid');
  assert.doesNotMatch(`${constraint.message}${quota.message}${data.message}`, /TOKEN|PENGGUNA|PAYLOAD/);
});

test('VersionError menghasilkan schema_too_new dengan pesan wajib', () => {
  const error = mapStorageError({ name: 'VersionError' });
  assert.equal(error.code, 'schema_too_new');
  assert.equal(
    error.message,
    'Versi data lokal lebih baru daripada aplikasi ini. Data tidak akan diubah. Perbarui aplikasi sebelum melanjutkan.',
  );
});

test('unknown error memakai fallback aman', () => {
  const error = mapStorageError({ name: 'BrowserSpecificError', message: 'secret=abc' });
  assert.equal(error.code, 'storage_unknown');
  assert.doesNotMatch(error.message, /secret|abc/);
});
