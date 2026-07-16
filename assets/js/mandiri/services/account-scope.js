import { createPayloadDigest } from '../domain/ids.js';
import {
  assertPlainRecord,
  MandiriDomainError,
  normalizeScope,
} from '../domain/validation.js';

const DIGEST_PATTERN = /^sha256:([0-9a-f]{64})$/;
const FORBIDDEN_USER_FIELDS = new Set([
  'accesstoken',
  'credential',
  'password',
  'privatekey',
  'refreshtoken',
  'serviceaccount',
  'token',
]);

function normalizeFieldName(value) {
  return value.replace(/[-_]/g, '').toLowerCase();
}

function normalizeUid(user) {
  assertPlainRecord(user, 'user');
  for (const key of Reflect.ownKeys(user)) {
    if (typeof key !== 'string' || FORBIDDEN_USER_FIELDS.has(normalizeFieldName(key))) {
      throw new MandiriDomainError(
        'unsafe_user_field',
        'object pengguna memuat field kredensial yang tidak diizinkan',
        'user',
      );
    }
  }

  if (typeof user.uid !== 'string') {
    throw new MandiriDomainError('invalid_uid', 'UID wajib berupa string', 'user.uid');
  }
  const uid = user.uid.trim();
  if (!uid || uid.length > 128 || uid.includes('@')) {
    throw new MandiriDomainError(
      'invalid_uid',
      'UID wajib tersedia, bukan email, dan maksimum 128 karakter',
      'user.uid',
    );
  }
  return uid;
}

export async function createLocalScopesFromUser(
  user,
  { digest = createPayloadDigest } = {},
) {
  if (typeof digest !== 'function') {
    throw new MandiriDomainError('invalid_digest_function', 'digest scope tidak tersedia');
  }

  const uid = normalizeUid(user);
  const digestValue = await digest(Object.freeze({ uid }));
  const match = typeof digestValue === 'string' ? digestValue.match(DIGEST_PATTERN) : null;
  if (!match) {
    throw new MandiriDomainError('invalid_scope_digest', 'digest scope tidak valid');
  }

  const accountScope = normalizeScope(`account:${match[1]}`, 'accountScope');
  const userScope = normalizeScope(`user:${match[1]}`, 'userScope');
  return Object.freeze({ accountScope, userScope });
}

export async function createAccountScopeFromUser(user, options) {
  return (await createLocalScopesFromUser(user, options)).accountScope;
}

export async function createUserScopeFromUser(user, options) {
  return (await createLocalScopesFromUser(user, options)).userScope;
}
