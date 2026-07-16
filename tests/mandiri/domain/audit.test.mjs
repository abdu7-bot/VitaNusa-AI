import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuditEvent,
  redactUnsafeAuditFields,
  validateAuditEvent,
} from '../../../assets/js/mandiri/domain/audit.js';

function validAuditEvent(overrides = {}) {
  return {
    eventId: 'audit_11111111-1111-4111-8111-111111111111',
    accountScope: 'account_scope_a',
    workspaceId: 'workspace_22222222-2222-4222-8222-222222222222',
    actorScope: 'user_scope_a',
    actorRole: 'merchant_owner',
    action: 'workspace_created',
    entityType: 'workspace',
    entityId: 'workspace_22222222-2222-4222-8222-222222222222',
    operationId: 'op_33333333-3333-4333-8333-333333333333',
    result: 'success',
    reasonCode: 'none',
    createdAtLocal: '2026-07-16T10:00:00.000Z',
    ...overrides,
  };
}

test('audit event valid diterima dan immutable', () => {
  const event = createAuditEvent(validAuditEvent());
  assert.equal(validateAuditEvent(validAuditEvent()), true);
  assert.equal(event.schemaVersion, 1);
  assert.equal(Object.isFrozen(event), true);
});

test('field tambahan audit ditolak', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ unexpected: true })), {
    code: 'unknown_field',
  });
});

test('token ditolak dari record audit utama', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ accessToken: 'not-a-real-token' })), {
    code: 'unknown_field',
  });
});

test('password ditolak dari record audit utama', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ password: 'not-a-real-password' })), {
    code: 'unknown_field',
  });
});

test('result tidak dikenal ditolak', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ result: 'ignored' })), {
    code: 'unknown_audit_result',
  });
});

test('actor role tidak dikenal ditolak', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ actorRole: 'platform_admin' })), {
    code: 'unknown_workspace_role',
  });
});

test('operation ID invalid ditolak', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ operationId: 'operation-invalid' })), {
    code: 'invalid_operation_id',
  });
});

test('reasonCode terlalu panjang ditolak', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ reasonCode: `a${'b'.repeat(64)}` })), {
    code: 'string_too_long',
  });
});

test('redaction menghasilkan salinan aman dan melaporkan field yang dihapus', () => {
  const input = validAuditEvent({
    token: 'not-a-real-token',
    password: 'not-a-real-password',
    prompt: 'isi prompt tidak boleh disimpan',
    before: { role: 'cashier' },
  });
  const result = redactUnsafeAuditFields(input);
  assert.notEqual(result.value, input);
  assert.equal(result.value.action, input.action);
  assert.equal(Object.hasOwn(result.value, 'token'), false);
  assert.deepEqual(result.removedFields, ['before', 'password', 'prompt', 'token']);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.removedFields), true);
});

test('redaction dan createAuditEvent tidak memutasi input asli', () => {
  const input = validAuditEvent({ token: 'not-a-real-token' });
  const snapshot = structuredClone(input);
  const redacted = redactUnsafeAuditFields(input);
  const event = createAuditEvent(redacted.value);
  assert.deepEqual(input, snapshot);
  assert.notEqual(event, input);
});

test('reasonCode harus berasal dari allowlist terkontrol', () => {
  assert.throws(() => createAuditEvent(validAuditEvent({ reasonCode: 'custom_free_text' })), {
    code: 'unknown_reason_code',
  });
});
