import { isValidEntityId } from '../../domain/ids.js';
import {
  MandiriDomainError,
  normalizePositiveVersion,
} from '../../domain/validation.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const HTML_TAG_PATTERN = /<\s*\/?\s*[a-z][^>]*>/iu;

export function assertProductExactFields(
  value,
  allowedFields,
  { requiredFields = allowedFields, path = 'record' } = {},
) {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new MandiriDomainError('invalid_record', 'harus berupa object data biasa', path);
  }
  const allowed = new Set(allowedFields);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || DANGEROUS_KEYS.has(key)) {
      throw new MandiriDomainError('dangerous_key', 'key berbahaya tidak diizinkan', `${path}.${String(key)}`);
    }
    if (!allowed.has(key)) {
      throw new MandiriDomainError('unknown_field', `field "${key}" tidak diizinkan`, `${path}.${key}`);
    }
  }
  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      throw new MandiriDomainError('missing_field', 'field wajib belum tersedia', `${path}.${field}`);
    }
  }
  return value;
}

export function normalizeProductText(value, { path, maxLength }) {
  if (typeof value !== 'string') {
    throw new MandiriDomainError('invalid_type', 'harus berupa string', path);
  }
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!normalized) {
    throw new MandiriDomainError('string_too_short', 'panjang minimum 1', path);
  }
  if (normalized.length > maxLength) {
    throw new MandiriDomainError('string_too_long', `panjang maksimum ${maxLength}`, path);
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized) || HTML_TAG_PATTERN.test(normalized)) {
    throw new MandiriDomainError('plain_text_required', 'harus berupa plain text aman', path);
  }
  return normalized;
}

export function normalizeWorkspaceEntityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    throw new MandiriDomainError(`invalid_${prefix}_id`, `${prefix} ID tidak valid`, path);
  }
  return value;
}

export function normalizeWorkspaceScope(value, expectedWorkspaceId, path) {
  const workspaceId = normalizeWorkspaceEntityId(value, 'workspace', path);
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new MandiriDomainError('cross_workspace_scope', 'entity berada pada workspace lain', path);
  }
  return workspaceId;
}

export function normalizeEntityVersions(input, path) {
  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      Object.hasOwn(input, 'schemaVersion') ? input.schemaVersion : 1,
      `${path}.schemaVersion`,
    ),
    version: normalizePositiveVersion(
      Object.hasOwn(input, 'version') ? input.version : 1,
      `${path}.version`,
    ),
  });
}

export function normalizeBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new MandiriDomainError('invalid_boolean', 'harus berupa boolean', path);
  }
  return value;
}
