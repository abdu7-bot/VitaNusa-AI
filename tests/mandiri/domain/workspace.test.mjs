import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceRecord,
  normalizeWorkspace,
  validateWorkspace,
} from '../../../assets/js/mandiri/domain/workspace.js';

const WORKSPACE_ID = 'workspace_11111111-1111-4111-8111-111111111111';

function validWorkspace(overrides = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    accountScope: 'account_scope_a',
    name: 'Warung Amanah',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    status: 'active',
    createdAtLocal: '2026-07-16T10:00:00.000Z',
    updatedAtLocal: '2026-07-16T10:00:00.000Z',
    ...overrides,
  };
}

test('workspace valid diterima dan menghasilkan record immutable', () => {
  const record = createWorkspaceRecord(validWorkspace());
  assert.equal(validateWorkspace(validWorkspace()), true);
  assert.equal(record.workspaceId, WORKSPACE_ID);
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.version, 1);
  assert.equal(Object.isFrozen(record), true);
});

test('nama workspace di-trim pada normalized copy', () => {
  const record = normalizeWorkspace(validWorkspace({ name: '  Warung Amanah  ' }));
  assert.equal(record.name, 'Warung Amanah');
});

test('nama workspace kosong ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ name: '   ' })), {
    code: 'string_too_short',
  });
});

test('nama workspace lebih dari 120 karakter ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ name: 'a'.repeat(121) })), {
    code: 'string_too_long',
  });
});

test('currency selain IDR ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ currencyCode: 'USD' })), {
    code: 'unsupported_currency',
  });
});

test('status workspace tidak dikenal ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ status: 'deleted' })), {
    code: 'unknown_workspace_status',
  });
});

test('accountScope kosong ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ accountScope: '' })), {
    code: 'invalid_scope',
  });
});

test('field tambahan ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ unexpected: true })), {
    code: 'unknown_field',
  });
});

test('token field ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ token: 'not-a-real-token' })), {
    code: 'unknown_field',
  });
});

test('normalisasi workspace tidak memutasi input', () => {
  const input = validWorkspace({ name: '  Warung Amanah  ' });
  const snapshot = structuredClone(input);
  const result = normalizeWorkspace(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(result, input);
});

test('workspace ID, timezone, timestamp, dan version invalid ditolak', () => {
  assert.throws(() => normalizeWorkspace(validWorkspace({ workspaceId: 'workspace-invalid' })));
  assert.throws(() => normalizeWorkspace(validWorkspace({ timezone: 'Mars/Jakarta' })));
  assert.throws(() => normalizeWorkspace(validWorkspace({ createdAtLocal: 'kemarin' })));
  assert.throws(() => normalizeWorkspace(validWorkspace({ schemaVersion: 0 })));
});
