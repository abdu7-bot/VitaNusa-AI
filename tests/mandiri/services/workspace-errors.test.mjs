import test from 'node:test';
import assert from 'node:assert/strict';
import { MandiriDomainError } from '../../../assets/js/mandiri/domain/validation.js';
import { storageError } from '../../../assets/js/mandiri/storage/storage-errors.js';
import {
  getWorkspaceErrorMessage,
  isRetryableWorkspaceError,
  MandiriWorkspaceError,
  mapWorkspaceError,
  WORKSPACE_ERROR_CODES,
  workspaceError,
} from '../../../assets/js/mandiri/services/workspace-errors.js';

test('seluruh kode workspace menghasilkan pesan aman', () => {
  for (const code of WORKSPACE_ERROR_CODES) {
    const error = workspaceError(code);
    assert.equal(error.code, code);
    assert.equal(error.message, getWorkspaceErrorMessage(code));
    assert.doesNotMatch(error.message, /uid|stack|digest|firebase/i);
  }
});

test('kode tidak dikenal menjadi unknown_error', () => {
  const error = workspaceError('record-secret');
  assert.equal(error.code, 'unknown_error');
  assert.equal(error.message, getWorkspaceErrorMessage('unknown_error'));
});

test('storage error dipetakan tanpa payload mentah', () => {
  const source = storageError('quota_exceeded', new Error('payload-sensitive-value'));
  const mapped = mapWorkspaceError(source);

  assert.equal(mapped.code, 'quota_exceeded');
  assert.doesNotMatch(mapped.message, /payload-sensitive-value/);
  assert.doesNotMatch(JSON.stringify(mapped), /payload-sensitive-value/);
});

test('scope domain error dipetakan ke scope_mismatch', () => {
  const mapped = mapWorkspaceError(new MandiriDomainError('scope_mismatch', 'raw account key'));
  assert.equal(mapped.code, 'scope_mismatch');
  assert.doesNotMatch(mapped.message, /raw account key/);
});

test('invalid domain input memakai fallback aman', () => {
  const mapped = mapWorkspaceError(
    new MandiriDomainError('invalid_timezone', 'internal detail'),
    'invalid_workspace_input',
  );
  assert.equal(mapped.code, 'invalid_workspace_input');
  assert.doesNotMatch(mapped.message, /internal detail/);
});

test('MandiriWorkspaceError yang sudah aman dipertahankan', () => {
  const original = workspaceError('integrity_error');
  assert.equal(mapWorkspaceError(original), original);
});

test('hanya error storage yang layak dicoba ulang ditandai retryable', () => {
  assert.equal(isRetryableWorkspaceError(workspaceError('transaction_aborted')), true);
  assert.equal(isRetryableWorkspaceError(workspaceError('quota_exceeded')), true);
  assert.equal(isRetryableWorkspaceError(workspaceError('idempotency_mismatch')), false);
  assert.equal(isRetryableWorkspaceError(workspaceError('workspace_already_exists')), false);
});

test('cause disanitasi menjadi metadata pendek', () => {
  const cause = Object.assign(new Error('secret record value'), {
    code: 'quota_exceeded',
    record: { password: 'not-real' },
  });
  const error = new MandiriWorkspaceError('storage_error', { cause });

  assert.deepEqual(error.cause, { name: 'Error', code: 'quota_exceeded' });
  assert.equal(Object.hasOwn(error.cause, 'record'), false);
  assert.doesNotMatch(JSON.stringify(error), /not-real/);
});
