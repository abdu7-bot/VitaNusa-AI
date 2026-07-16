import { isValidEntityId } from './ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
  normalizeTimeZone,
  normalizeTrimmedString,
} from './validation.js';

export const WORKSPACE_STATUSES = Object.freeze(['active', 'archived']);
export const WORKSPACE_CURRENCY_CODES = Object.freeze(['IDR']);

const WORKSPACE_FIELDS = Object.freeze([
  'schemaVersion',
  'version',
  'workspaceId',
  'accountScope',
  'name',
  'timezone',
  'currencyCode',
  'status',
  'createdAtLocal',
  'updatedAtLocal',
]);
const REQUIRED_WORKSPACE_FIELDS = Object.freeze([
  'workspaceId',
  'accountScope',
  'name',
  'timezone',
  'currencyCode',
  'status',
  'createdAtLocal',
  'updatedAtLocal',
]);

function normalizeWorkspaceId(value) {
  if (!isValidEntityId(value, 'workspace')) {
    throw new MandiriDomainError('invalid_workspace_id', 'workspaceId tidak valid', 'workspace.workspaceId');
  }
  return value;
}

export function normalizeWorkspace(input) {
  assertExactFields(input, WORKSPACE_FIELDS, {
    requiredFields: REQUIRED_WORKSPACE_FIELDS,
    path: 'workspace',
  });

  const createdAtLocal = normalizeIsoTimestamp(input.createdAtLocal, 'workspace.createdAtLocal');
  const updatedAtLocal = normalizeIsoTimestamp(input.updatedAtLocal, 'workspace.updatedAtLocal');
  if (updatedAtLocal < createdAtLocal) {
    throw new MandiriDomainError(
      'invalid_timestamp_order',
      'updatedAtLocal tidak boleh lebih awal dari createdAtLocal',
      'workspace.updatedAtLocal',
    );
  }

  const currencyCode = normalizeTrimmedString(input.currencyCode, {
    path: 'workspace.currencyCode',
    minLength: 3,
    maxLength: 3,
    pattern: /^[A-Z]{3}$/,
  });
  if (!WORKSPACE_CURRENCY_CODES.includes(currencyCode)) {
    throw new MandiriDomainError('unsupported_currency', 'MVP hanya mendukung IDR', 'workspace.currencyCode');
  }
  if (!WORKSPACE_STATUSES.includes(input.status)) {
    throw new MandiriDomainError('unknown_workspace_status', 'status workspace tidak dikenal', 'workspace.status');
  }

  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      Object.hasOwn(input, 'schemaVersion') ? input.schemaVersion : 1,
      'workspace.schemaVersion',
    ),
    version: normalizePositiveVersion(
      Object.hasOwn(input, 'version') ? input.version : 1,
      'workspace.version',
    ),
    workspaceId: normalizeWorkspaceId(input.workspaceId),
    accountScope: normalizeScope(input.accountScope, 'workspace.accountScope'),
    name: normalizeTrimmedString(input.name, {
      path: 'workspace.name',
      minLength: 1,
      maxLength: 120,
    }),
    timezone: normalizeTimeZone(input.timezone, 'workspace.timezone'),
    currencyCode,
    status: input.status,
    createdAtLocal,
    updatedAtLocal,
  });
}

export function validateWorkspace(input) {
  normalizeWorkspace(input);
  return true;
}

export function createWorkspaceRecord(input) {
  return normalizeWorkspace(input);
}
