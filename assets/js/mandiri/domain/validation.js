export class MandiriDomainError extends Error {
  constructor(code, message, path = '') {
    super(path ? `${path}: ${message}` : message);
    this.name = 'MandiriDomainError';
    this.code = code;
    this.path = path;
  }
}

export function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainRecord(value, path = 'record') {
  if (!isPlainRecord(value)) {
    throw new MandiriDomainError('invalid_record', 'harus berupa object data biasa', path);
  }
  return value;
}

export function assertExactFields(
  value,
  allowedFields,
  { requiredFields = allowedFields, path = 'record' } = {},
) {
  assertPlainRecord(value, path);
  const allowed = new Set(allowedFields);

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new MandiriDomainError(
        'unknown_field',
        `field "${String(key)}" tidak diizinkan`,
        path,
      );
    }
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      throw new MandiriDomainError('missing_field', 'field wajib belum tersedia', `${path}.${field}`);
    }
  }

  return value;
}

export function normalizeTrimmedString(
  value,
  { path, minLength = 1, maxLength, pattern = null } = {},
) {
  if (typeof value !== 'string') {
    throw new MandiriDomainError('invalid_type', 'harus berupa string', path);
  }
  const normalized = value.trim();
  if (normalized.length < minLength) {
    throw new MandiriDomainError('string_too_short', `panjang minimum ${minLength}`, path);
  }
  if (maxLength !== undefined && normalized.length > maxLength) {
    throw new MandiriDomainError('string_too_long', `panjang maksimum ${maxLength}`, path);
  }
  if (pattern && !pattern.test(normalized)) {
    throw new MandiriDomainError('invalid_format', 'format tidak valid', path);
  }
  return normalized;
}

const SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,127}$/;

export function isValidScope(value) {
  return (
    typeof value === 'string'
    && value === value.trim()
    && !value.includes('@')
    && SCOPE_PATTERN.test(value)
  );
}

export function normalizeScope(value, path) {
  if (!isValidScope(value)) {
    throw new MandiriDomainError(
      'invalid_scope',
      'scope harus berupa identifier non-email sepanjang 3–128 karakter',
      path,
    );
  }
  return value;
}

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isValidIsoTimestamp(value) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function normalizeIsoTimestamp(value, path) {
  if (!isValidIsoTimestamp(value)) {
    throw new MandiriDomainError(
      'invalid_timestamp',
      'timestamp harus ISO-8601 UTC dari Date.toISOString()',
      path,
    );
  }
  return value;
}

export function normalizePositiveVersion(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MandiriDomainError('invalid_version', 'version harus safe integer minimal 1', path);
  }
  return value;
}

export function isValidTimeZone(value) {
  if (typeof value !== 'string' || value !== value.trim() || !value || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value, path) {
  if (!isValidTimeZone(value)) {
    throw new MandiriDomainError('invalid_timezone', 'timezone IANA tidak valid', path);
  }
  return value;
}

export function normalizeCode(
  value,
  { path, maxLength = 80, pattern = /^[a-z][a-z0-9_.-]*$/ } = {},
) {
  return normalizeTrimmedString(value, {
    path,
    minLength: 1,
    maxLength,
    pattern,
  });
}
