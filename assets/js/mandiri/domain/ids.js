import {
  assertPlainRecord,
  MandiriDomainError,
} from './validation.js';

const PREFIX_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ENTITY_ID_PATTERN = /^([a-z][a-z0-9-]{0,31})_([0-9a-f-]{36})$/;
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'authorization',
  'accesstoken',
  'refreshtoken',
  'token',
  'password',
  'secret',
  'privatekey',
]);

function normalizePrefix(prefix) {
  if (typeof prefix !== 'string' || !PREFIX_PATTERN.test(prefix)) {
    throw new MandiriDomainError(
      'invalid_id_prefix',
      'prefix ID harus lowercase ASCII, diawali huruf, dan maksimum 32 karakter',
      'prefix',
    );
  }
  return prefix;
}

function getCrypto(cryptoRef) {
  if (!cryptoRef || typeof cryptoRef !== 'object') {
    throw new MandiriDomainError('crypto_unavailable', 'Web Crypto tidak tersedia', 'crypto');
  }
  return cryptoRef;
}

function bytesToUuid(bytes) {
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function createUuid(cryptoRef = globalThis.crypto) {
  const cryptoApi = getCrypto(cryptoRef);
  if (typeof cryptoApi.randomUUID === 'function') {
    const uuid = cryptoApi.randomUUID();
    if (!UUID_V4_PATTERN.test(uuid)) {
      throw new MandiriDomainError('invalid_crypto_uuid', 'randomUUID menghasilkan UUID invalid');
    }
    return uuid;
  }
  if (typeof cryptoApi.getRandomValues !== 'function') {
    throw new MandiriDomainError(
      'crypto_unavailable',
      'fallback crypto.getRandomValues tidak tersedia',
      'crypto',
    );
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

export function createEntityId(prefix, cryptoRef = globalThis.crypto) {
  return `${normalizePrefix(prefix)}_${createUuid(cryptoRef)}`;
}

export function createOperationId(cryptoRef = globalThis.crypto) {
  return createEntityId('op', cryptoRef);
}

export function isValidEntityId(value, expectedPrefix) {
  if (typeof value !== 'string') return false;
  const match = value.match(ENTITY_ID_PATTERN);
  if (!match || !UUID_V4_PATTERN.test(match[2])) return false;
  if (expectedPrefix !== undefined) {
    return PREFIX_PATTERN.test(expectedPrefix) && match[1] === expectedPrefix;
  }
  return true;
}

function normalizePayloadKey(key, path) {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  if (['__proto__', 'prototype', 'constructor'].includes(key) || FORBIDDEN_PAYLOAD_KEYS.has(normalized)) {
    throw new MandiriDomainError(
      'unsafe_payload_field',
      `field "${key}" tidak boleh masuk payload operasi`,
      path,
    );
  }
  return key;
}

function canonicalizeValue(value, path, ancestors) {
  if (value === null) return 'null';

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MandiriDomainError('unsupported_payload_type', 'angka harus finite', path);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new MandiriDomainError('unsafe_integer', 'integer payload harus safe integer', path);
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (typeof value !== 'object') {
    throw new MandiriDomainError(
      'unsupported_payload_type',
      `tipe ${typeof value} tidak didukung`,
      path,
    );
  }

  if (ancestors.has(value)) {
    throw new MandiriDomainError('cyclic_payload', 'payload tidak boleh memiliki siklus', path);
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new MandiriDomainError('unsafe_prototype', 'prototype array tidak didukung', path);
      }
      for (const key of Reflect.ownKeys(value)) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) {
          throw new MandiriDomainError('unsupported_payload_type', 'array memiliki property tambahan', path);
        }
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new MandiriDomainError('sparse_array', 'array renggang tidak didukung', `${path}[${index}]`);
        }
        items.push(canonicalizeValue(value[index], `${path}[${index}]`, ancestors));
      }
      return `[${items.join(',')}]`;
    }

    assertPlainRecord(value, path);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      throw new MandiriDomainError('unsupported_payload_type', 'symbol key tidak didukung', path);
    }
    const keys = ownKeys.map((key) => normalizePayloadKey(key, `${path}.${key}`)).sort();
    const pairs = keys.map((key) => (
      `${JSON.stringify(key)}:${canonicalizeValue(value[key], `${path}.${key}`, ancestors)}`
    ));
    return `{${pairs.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizePayload(payload) {
  return canonicalizeValue(payload, 'payload', new WeakSet());
}

export async function createPayloadDigest(payload, cryptoRef = globalThis.crypto) {
  const cryptoApi = getCrypto(cryptoRef);
  if (!cryptoApi.subtle || typeof cryptoApi.subtle.digest !== 'function') {
    throw new MandiriDomainError('crypto_unavailable', 'crypto.subtle.digest tidak tersedia', 'crypto');
  }
  if (typeof TextEncoder !== 'function') {
    throw new MandiriDomainError('text_encoder_unavailable', 'TextEncoder tidak tersedia');
  }

  const canonical = canonicalizePayload(payload);
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hex = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

export function createOperationGuard({ digest = createPayloadDigest } = {}) {
  if (typeof digest !== 'function') {
    throw new MandiriDomainError('invalid_digest_function', 'digest harus berupa fungsi');
  }
  const seen = new Map();

  const check = async (operationId, payload) => {
    if (!isValidEntityId(operationId, 'op')) {
      throw new MandiriDomainError('invalid_operation_id', 'operationId tidak valid', 'operationId');
    }
    const payloadDigest = await digest(payload);
    const existingDigest = seen.get(operationId);

    if (existingDigest === undefined) {
      seen.set(operationId, payloadDigest);
      return Object.freeze({
        status: 'accepted',
        duplicate: false,
        operationId,
        payloadDigest,
      });
    }

    if (existingDigest !== payloadDigest) {
      throw new MandiriDomainError(
        'idempotency_mismatch',
        'operationId telah digunakan dengan payload berbeda',
        'operationId',
      );
    }

    return Object.freeze({
      status: 'duplicate',
      duplicate: true,
      operationId,
      payloadDigest,
    });
  };

  return Object.freeze({
    check,
    register: check,
    has(operationId) {
      return isValidEntityId(operationId, 'op') && seen.has(operationId);
    },
    get size() {
      return seen.size;
    },
  });
}
