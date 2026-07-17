import { isValidEntityId } from '../../domain/ids.js';
import {
  isPlainRecord,
  isValidIsoTimestamp,
} from '../../domain/validation.js';
import { NusaBelajarDomainError } from './learning-errors.js';

export const LEARNING_SCHEMA_VERSION = 1;
export const LEARNING_LOCALE = 'id-ID';
export const CONTENT_STATUSES = Object.freeze(['draft', 'published', 'retired']);

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CONTENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FORBIDDEN_TAG_PATTERN = /<\s*\/?\s*[a-z][^>]*>/iu;
const EVENT_HANDLER_PATTERN = /\bon[a-z]+\s*=/iu;
const DANGEROUS_SCHEME_PATTERN = /\b(?:javascript|data|vbscript|file|blob)\s*:/iu;
const ARBITRARY_URL_PATTERN = /\b[a-z][a-z0-9+.-]{1,31}:\/\//iu;
const MARKDOWN_URL_PATTERN = /\[[^\]]*\]\s*\([^)]*\)/u;

function fail(code, path, message) {
  throw new NusaBelajarDomainError(code, message, path);
}

export function assertLearningPlainRecord(value, path = 'record') {
  if (!isPlainRecord(value)) {
    fail('invalid_record', path, 'harus berupa object data biasa');
  }
  return value;
}

export function assertLearningExactFields(
  value,
  allowedFields,
  { requiredFields = allowedFields, path = 'record' } = {},
) {
  assertLearningPlainRecord(value, path);
  const allowed = new Set(allowedFields);

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || DANGEROUS_KEYS.has(key)) {
      fail('dangerous_key', `${path}.${String(key)}`, 'key berbahaya tidak diizinkan');
    }
    if (!allowed.has(key)) {
      fail('unknown_field', `${path}.${key}`, `field "${key}" tidak diizinkan`);
    }
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) {
      fail('missing_field', `${path}.${field}`, 'field wajib belum tersedia');
    }
  }
  return value;
}

export function assertSafeDataStructure(
  value,
  { path = 'value', maxDepth = 20, maxNodes = 50000 } = {},
) {
  const ancestors = new WeakSet();
  let nodes = 0;

  function visit(current, currentPath, depth) {
    nodes += 1;
    if (nodes > maxNodes) {
      fail('collection_too_large', currentPath, 'struktur data melampaui batas aman');
    }
    if (depth > maxDepth) {
      fail('excessive_nesting', currentPath, `kedalaman maksimum ${maxDepth}`);
    }
    if (current === null || ['string', 'boolean'].includes(typeof current)) return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current) || (Number.isInteger(current) && !Number.isSafeInteger(current))) {
        fail('invalid_number', currentPath, 'angka harus finite dan safe');
      }
      return;
    }
    if (typeof current !== 'object') {
      fail('unsupported_value', currentPath, `tipe ${typeof current} tidak didukung`);
    }
    if (ancestors.has(current)) {
      fail('cyclic_value', currentPath, 'struktur data tidak boleh bersiklus');
    }
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          fail('unsafe_prototype', currentPath, 'prototype array tidak didukung');
        }
        for (const key of Reflect.ownKeys(current)) {
          if (key === 'length') continue;
          if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) {
            fail('unsupported_value', currentPath, 'array memiliki property tambahan');
          }
        }
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.hasOwn(current, index)) {
            fail('sparse_array', `${currentPath}[${index}]`, 'array renggang tidak didukung');
          }
          visit(current[index], `${currentPath}[${index}]`, depth + 1);
        }
        return;
      }

      assertLearningPlainRecord(current, currentPath);
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== 'string' || DANGEROUS_KEYS.has(key)) {
          fail('dangerous_key', `${currentPath}.${String(key)}`, 'key berbahaya tidak diizinkan');
        }
        visit(current[key], `${currentPath}.${key}`, depth + 1);
      }
    } finally {
      ancestors.delete(current);
    }
  }

  visit(value, path, 0);
  return true;
}

export function deepFreezeLearningValue(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreezeLearningValue(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}

export function cloneLearningValue(value, options) {
  assertSafeDataStructure(value, options);

  function clone(current) {
    if (current === null || typeof current !== 'object') return current;
    if (Array.isArray(current)) return current.map((item) => clone(item));
    const copy = Object.create(null);
    for (const key of Object.keys(current)) copy[key] = clone(current[key]);
    return copy;
  }

  return clone(value);
}

export function normalizeSchemaVersion(value, path) {
  const resolved = value === undefined ? LEARNING_SCHEMA_VERSION : value;
  if (!Number.isSafeInteger(resolved) || resolved !== LEARNING_SCHEMA_VERSION) {
    fail('invalid_schema_version', path, `schemaVersion harus ${LEARNING_SCHEMA_VERSION}`);
  }
  return resolved;
}

export function normalizeContentVersion(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('invalid_content_version', path, 'contentVersion harus safe integer positif');
  }
  return value;
}

export function normalizeLocale(value, path) {
  if (value !== LEARNING_LOCALE) {
    fail('unsupported_locale', path, `locale MVP harus ${LEARNING_LOCALE}`);
  }
  return value;
}

export function normalizeContentStatus(value, path) {
  if (!CONTENT_STATUSES.includes(value)) {
    fail('unknown_content_status', path, 'status konten tidak dikenal');
  }
  return value;
}

export function normalizeContentId(value, prefix, path) {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || value.length > 120
    || !CONTENT_ID_PATTERN.test(value)
    || !value.startsWith(`${prefix}-`)
  ) {
    fail('invalid_content_id', path, `ID harus safe slug dengan prefix ${prefix}-`);
  }
  return value;
}

export function normalizeEntityId(value, prefix, path) {
  if (!isValidEntityId(value, prefix)) {
    fail('invalid_entity_id', path, `ID ${prefix} tidak valid`);
  }
  return value;
}

export function normalizePlainText(
  value,
  { path, minLength = 1, maxLength = 1000, allowEmpty = false } = {},
) {
  if (typeof value !== 'string') fail('invalid_type', path, 'harus berupa string');
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const minimum = allowEmpty ? 0 : minLength;
  if (normalized.length < minimum) fail('string_too_short', path, `panjang minimum ${minimum}`);
  if (normalized.length > maxLength) fail('string_too_long', path, `panjang maksimum ${maxLength}`);
  if (FORBIDDEN_TAG_PATTERN.test(normalized)) fail('raw_html_forbidden', path, 'raw HTML tidak diizinkan');
  if (EVENT_HANDLER_PATTERN.test(normalized)) fail('event_handler_forbidden', path, 'event handler tidak diizinkan');
  if (DANGEROUS_SCHEME_PATTERN.test(normalized)) fail('dangerous_url', path, 'URL scheme berbahaya tidak diizinkan');
  if (ARBITRARY_URL_PATTERN.test(normalized) || MARKDOWN_URL_PATTERN.test(normalized)) {
    fail('arbitrary_url_forbidden', path, 'URL atau tautan arbitrary tidak diizinkan');
  }
  return normalized;
}

export function normalizeContentStringArray(
  value,
  {
    path,
    prefix,
    minItems = 0,
    maxItems = 10000,
    unique = true,
  } = {},
) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('invalid_type', path, 'harus berupa array biasa');
  }
  if (value.length < minItems) fail('array_too_short', path, `minimal ${minItems} item`);
  if (value.length > maxItems) fail('array_too_long', path, `maksimum ${maxItems} item`);
  const normalized = value.map((item, index) => (
    normalizeContentId(item, prefix, `${path}[${index}]`)
  ));
  if (unique && new Set(normalized).size !== normalized.length) {
    fail('duplicate_id', path, 'ID dalam array harus unik');
  }
  return normalized;
}

export function normalizeSafeInteger(
  value,
  { path, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail('invalid_integer', path, `harus safe integer antara ${min} dan ${max}`);
  }
  return value;
}

export function calculateBasisPointScore(correctCount, questionCount, path = 'score') {
  normalizeSafeInteger(questionCount, { path: `${path}.questionCount`, min: 1, max: 10000 });
  normalizeSafeInteger(correctCount, {
    path: `${path}.correctCount`,
    min: 0,
    max: questionCount,
  });
  const numerator = (BigInt(correctCount) * 10000n) + (BigInt(questionCount) / 2n);
  return Number(numerator / BigInt(questionCount));
}

export function normalizeIsoTimestamp(value, path) {
  if (!isValidIsoTimestamp(value)) {
    fail('invalid_timestamp', path, 'timestamp harus ISO-8601 UTC dari Date.toISOString()');
  }
  return value;
}

export function normalizeLearnerScope(value, path = 'learnerScope') {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || !/^(?:user|guest):[a-z0-9][a-z0-9_-]{2,127}$/i.test(value)
    || value.includes('@')
  ) {
    fail('invalid_learner_scope', path, 'learnerScope harus identifier user atau guest non-email');
  }
  return value;
}

export function normalizeCommonContentFields(input, path) {
  return {
    schemaVersion: normalizeSchemaVersion(input.schemaVersion, `${path}.schemaVersion`),
    contentVersion: normalizeContentVersion(input.contentVersion, `${path}.contentVersion`),
    locale: normalizeLocale(input.locale, `${path}.locale`),
    status: normalizeContentStatus(input.status, `${path}.status`),
  };
}

export function normalizedContentTextForComparison(value, { caseSensitive = false } = {}) {
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('id-ID');
}
