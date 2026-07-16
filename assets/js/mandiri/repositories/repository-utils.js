import { isValidEntityId } from '../domain/ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizeScope,
} from '../domain/validation.js';
import { isMandiriStoreName } from '../storage/schema.js';
import {
  MandiriStorageError,
  mapStorageError,
  storageError,
} from '../storage/storage-errors.js';

export function asStorageValidationError(error) {
  if (error instanceof MandiriStorageError) return error;
  if (error instanceof MandiriDomainError) {
    if (['cross_account_scope', 'cross_workspace_scope', 'scope_mismatch'].includes(error.code)) {
      return storageError('scope_mismatch', error);
    }
    return storageError('data_invalid', error);
  }
  return mapStorageError(error, 'data_invalid');
}

export function normalizeAccountScope(value) {
  try {
    return normalizeScope(value, 'accountScope');
  } catch (error) {
    throw storageError('scope_mismatch', error);
  }
}

export function normalizeWorkspaceScope(value) {
  if (!isValidEntityId(value, 'workspace')) throw storageError('scope_mismatch');
  return value;
}

export function normalizeEntityIdentifier(value, expectedPrefix) {
  if (!isValidEntityId(value, expectedPrefix)) throw storageError('data_invalid');
  return value;
}

export function assertRecordScope(record, accountScope, workspaceId) {
  if (record.accountScope !== accountScope) throw storageError('scope_mismatch');
  if (workspaceId !== undefined && record.workspaceId !== workspaceId) {
    throw storageError('scope_mismatch');
  }
  return record;
}

function cloneValue(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw storageError('data_invalid');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw storageError('data_invalid');
  if (ancestors.has(value)) throw storageError('data_invalid');
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) throw storageError('data_invalid');
      const output = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw storageError('data_invalid');
        output.push(cloneValue(value[index], `${path}[${index}]`, ancestors));
      }
      if (Reflect.ownKeys(value).some((key) => key !== 'length' && !/^(0|[1-9]\d*)$/.test(String(key)))) {
        throw storageError('data_invalid');
      }
      return output;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw storageError('data_invalid');
    const output = {};
    for (const key of Reflect.ownKeys(value)) {
      if (
        typeof key !== 'string'
        || ['__proto__', 'prototype', 'constructor'].includes(key)
      ) {
        throw storageError('data_invalid');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw storageError('data_invalid');
      output[key] = cloneValue(descriptor.value, `${path}.${key}`, ancestors);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

export function clonePlainRecord(value, path = 'record') {
  const clone = cloneValue(value, path, new WeakSet());
  if (clone === null || typeof clone !== 'object' || Array.isArray(clone)) {
    throw storageError('data_invalid');
  }
  return clone;
}

export function normalizeWith(normalizer, record, ...args) {
  try {
    return normalizer(clonePlainRecord(record), ...args);
  } catch (error) {
    throw asStorageValidationError(error);
  }
}

export function createRepositoryExecutor({ connection, transactionContext } = {}) {
  if ((connection ? 1 : 0) + (transactionContext ? 1 : 0) !== 1) {
    throw storageError('data_invalid');
  }
  if (connection && typeof connection.runTransaction !== 'function') {
    throw storageError('data_invalid');
  }

  return Object.freeze({
    run(storeNames, mode, callback) {
      if (!Array.isArray(storeNames) || !storeNames.every(isMandiriStoreName)) {
        return Promise.reject(storageError('data_invalid'));
      }
      if (!transactionContext) return connection.runTransaction(storeNames, mode, callback);

      try {
        transactionContext.assertActive();
        for (const storeName of storeNames) {
          if (!transactionContext.storeNames.includes(storeName)) throw storageError('data_invalid');
        }
        if (mode === 'readwrite') transactionContext.assertWritable();
        return Promise.resolve(callback(transactionContext));
      } catch (error) {
        return Promise.reject(mapStorageError(error, 'transaction_aborted'));
      }
    },
  });
}

export function keyRangeOnly(transactionContext, key) {
  const factory = transactionContext.keyRangeFactory;
  if (!factory || typeof factory.only !== 'function') throw storageError('indexeddb_unavailable');
  try {
    return factory.only(key);
  } catch (error) {
    throw mapStorageError(error, 'data_invalid');
  }
}

export function keyRangeBound(transactionContext, lower, upper, lowerOpen = false, upperOpen = false) {
  const factory = transactionContext.keyRangeFactory;
  if (!factory || typeof factory.bound !== 'function') throw storageError('indexeddb_unavailable');
  try {
    return factory.bound(lower, upper, lowerOpen, upperOpen);
  } catch (error) {
    throw mapStorageError(error, 'data_invalid');
  }
}

export function cursorToArray(source, range, { direction = 'next', limit = Infinity } = {}) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = source.openCursor(range, direction);
    } catch (error) {
      reject(mapStorageError(error, 'data_invalid'));
      return;
    }
    const output = [];
    request.onerror = () => reject(mapStorageError(request.error));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || output.length >= limit) {
        resolve(output);
        return;
      }
      try {
        output.push(clonePlainRecord(cursor.value));
      } catch (error) {
        reject(error);
        return;
      }
      if (output.length >= limit) {
        resolve(output);
        return;
      }
      cursor.continue();
    };
  });
}

export function normalizeListOptions(options = {}) {
  try {
    assertExactFields(options, ['limit', 'beforeCreatedAt'], {
      requiredFields: [],
      path: 'options',
    });
  } catch (error) {
    throw asStorageValidationError(error);
  }
  const limit = Object.hasOwn(options, 'limit') ? options.limit : 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw storageError('data_invalid');
  }
  let beforeCreatedAt;
  if (Object.hasOwn(options, 'beforeCreatedAt')) {
    try {
      beforeCreatedAt = normalizeIsoTimestamp(options.beforeCreatedAt, 'options.beforeCreatedAt');
    } catch (error) {
      throw asStorageValidationError(error);
    }
  }
  return Object.freeze({ limit, beforeCreatedAt });
}

export function compareNewest(left, right, timestampField, idField) {
  const timeOrder = right[timestampField].localeCompare(left[timestampField]);
  return timeOrder || left[idField].localeCompare(right[idField]);
}

export function assertNoUnknownOptions(options, allowedFields, path = 'options') {
  try {
    assertExactFields(options, allowedFields, { requiredFields: [], path });
  } catch (error) {
    throw asStorageValidationError(error);
  }
}
