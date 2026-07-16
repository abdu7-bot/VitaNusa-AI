import { isValidEntityId } from './ids.js';
import { isWorkspaceRole } from './membership.js';
import {
  assertExactFields,
  assertPlainRecord,
  MandiriDomainError,
  normalizeCode,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from './validation.js';

export const AUDIT_RESULTS = Object.freeze(['success', 'denied', 'conflict', 'failed']);
export const AUDIT_REASON_CODES = Object.freeze([
  'none',
  'permission_denied',
  'role_denied',
  'owner_transfer_required',
  'scope_mismatch',
  'validation_failed',
  'unsafe_integer',
  'idempotency_mismatch',
  'version_conflict',
  'schema_unsupported',
  'storage_quota',
  'network_unavailable',
  'operation_failed',
]);

const AUDIT_FIELDS = Object.freeze([
  'schemaVersion',
  'eventId',
  'accountScope',
  'workspaceId',
  'actorScope',
  'actorRole',
  'action',
  'entityType',
  'entityId',
  'operationId',
  'result',
  'reasonCode',
  'createdAtLocal',
]);
const REQUIRED_AUDIT_FIELDS = Object.freeze(AUDIT_FIELDS.filter((field) => field !== 'schemaVersion'));
const AUDIT_FIELD_SET = new Set(AUDIT_FIELDS);

function assertId(value, expectedPrefix, path, code) {
  if (!isValidEntityId(value, expectedPrefix)) {
    throw new MandiriDomainError(code, `${path} tidak valid`, path);
  }
  return value;
}

export function normalizeAuditEvent(input) {
  assertExactFields(input, AUDIT_FIELDS, {
    requiredFields: REQUIRED_AUDIT_FIELDS,
    path: 'auditEvent',
  });
  if (!isWorkspaceRole(input.actorRole)) {
    throw new MandiriDomainError('unknown_workspace_role', 'actorRole tidak dikenal', 'auditEvent.actorRole');
  }
  if (!AUDIT_RESULTS.includes(input.result)) {
    throw new MandiriDomainError('unknown_audit_result', 'result audit tidak dikenal', 'auditEvent.result');
  }
  const reasonCode = normalizeCode(input.reasonCode, {
    path: 'auditEvent.reasonCode',
    maxLength: 64,
    pattern: /^[a-z][a-z0-9_]*$/,
  });
  if (!AUDIT_REASON_CODES.includes(reasonCode)) {
    throw new MandiriDomainError('unknown_reason_code', 'reasonCode tidak dikenal', 'auditEvent.reasonCode');
  }

  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      Object.hasOwn(input, 'schemaVersion') ? input.schemaVersion : 1,
      'auditEvent.schemaVersion',
    ),
    eventId: assertId(input.eventId, 'audit', 'auditEvent.eventId', 'invalid_event_id'),
    accountScope: normalizeScope(input.accountScope, 'auditEvent.accountScope'),
    workspaceId: assertId(
      input.workspaceId,
      'workspace',
      'auditEvent.workspaceId',
      'invalid_workspace_id',
    ),
    actorScope: normalizeScope(input.actorScope, 'auditEvent.actorScope'),
    actorRole: input.actorRole,
    action: normalizeCode(input.action, { path: 'auditEvent.action', maxLength: 80 }),
    entityType: normalizeCode(input.entityType, { path: 'auditEvent.entityType', maxLength: 64 }),
    entityId: assertId(input.entityId, undefined, 'auditEvent.entityId', 'invalid_entity_id'),
    operationId: assertId(
      input.operationId,
      'op',
      'auditEvent.operationId',
      'invalid_operation_id',
    ),
    result: input.result,
    reasonCode,
    createdAtLocal: normalizeIsoTimestamp(input.createdAtLocal, 'auditEvent.createdAtLocal'),
  });
}

export function validateAuditEvent(input) {
  normalizeAuditEvent(input);
  return true;
}

export function createAuditEvent(input) {
  return normalizeAuditEvent(input);
}

export function redactUnsafeAuditFields(input) {
  assertPlainRecord(input, 'auditEvent');
  const safeCopy = {};
  const removedFields = [];

  for (const key of Reflect.ownKeys(input)) {
    if (
      typeof key !== 'string'
      || !AUDIT_FIELD_SET.has(key)
      || !['string', 'number'].includes(typeof input[key])
    ) {
      removedFields.push(String(key));
      continue;
    }
    safeCopy[key] = input[key];
  }

  return Object.freeze({
    value: Object.freeze(safeCopy),
    removedFields: Object.freeze(removedFields.sort()),
  });
}
