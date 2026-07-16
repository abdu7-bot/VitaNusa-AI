import { applyMigrations } from './migrations.js';
import {
  isMandiriStoreName,
  MANDIRI_DATABASE_NAME,
  MANDIRI_DATABASE_VERSION,
} from './schema.js';
import {
  MandiriStorageError,
  mapStorageError,
  storageError,
} from './storage-errors.js';

const TRANSACTION_MODES = Object.freeze(['readonly', 'readwrite']);

export function requestToPromise(request) {
  if (!request || typeof request !== 'object') {
    return Promise.reject(storageError('data_invalid'));
  }
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapStorageError(request.error));
  });
}

function normalizeStoreNames(storeNames) {
  if (!Array.isArray(storeNames) || storeNames.length === 0) {
    throw storageError('data_invalid');
  }
  const normalized = [...new Set(storeNames)];
  if (normalized.length !== storeNames.length || !normalized.every(isMandiriStoreName)) {
    throw storageError('data_invalid');
  }
  return Object.freeze(normalized);
}

function createTransactionContext(transaction, storeNames, keyRangeFactory, isActive) {
  const allowedStores = new Set(storeNames);
  const assertActive = () => {
    if (!isActive()) throw storageError('transaction_aborted');
  };

  return Object.freeze({
    get active() {
      return isActive();
    },
    mode: transaction.mode,
    storeNames,
    keyRangeFactory,
    assertActive,
    assertWritable() {
      assertActive();
      if (transaction.mode !== 'readwrite') throw storageError('data_invalid');
    },
    objectStore(storeName) {
      assertActive();
      if (!allowedStores.has(storeName)) throw storageError('data_invalid');
      try {
        return transaction.objectStore(storeName);
      } catch (error) {
        throw mapStorageError(error, 'transaction_aborted');
      }
    },
    request(request) {
      assertActive();
      return requestToPromise(request);
    },
  });
}

class MandiriDatabaseConnection {
  #closed = false;

  #invalidatedByVersionChange = false;

  #transactionRunning = false;

  constructor(database, keyRangeFactory) {
    this.database = database;
    this.schemaVersion = database.version;
    this.keyRangeFactory = keyRangeFactory;

    database.onversionchange = () => {
      this.#invalidatedByVersionChange = true;
      this.#closed = true;
      database.close();
    };
  }

  #assertOpen() {
    if (this.#invalidatedByVersionChange) throw storageError('schema_too_new');
    if (this.#closed) throw storageError('database_open_failed');
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.database.close();
  }

  runTransaction(storeNames, mode, callback) {
    this.#assertOpen();
    const normalizedStores = normalizeStoreNames(storeNames);
    if (!TRANSACTION_MODES.includes(mode) || typeof callback !== 'function') {
      throw storageError('data_invalid');
    }
    if (this.#transactionRunning) {
      throw new MandiriStorageError(
        'data_invalid',
        'Nested atau concurrent transaction pada connection yang sama tidak diizinkan.',
      );
    }

    let transaction;
    try {
      transaction = this.database.transaction(normalizedStores, mode);
    } catch (error) {
      throw mapStorageError(error, 'transaction_aborted');
    }

    this.#transactionRunning = true;
    return new Promise((resolve, reject) => {
      let active = true;
      let callbackSettled = false;
      let callbackResult;
      let callbackError;
      let transactionCompleted = false;
      let transactionError;
      let completedBeforeCallback = false;
      let settled = false;

      const context = createTransactionContext(
        transaction,
        normalizedStores,
        this.keyRangeFactory,
        () => active,
      );

      const settle = () => {
        if (settled) return;
        if (callbackError && (!active || transactionError || transactionCompleted)) {
          settled = true;
          reject(callbackError);
          return;
        }
        if (transactionError && !active) {
          settled = true;
          reject(transactionError);
          return;
        }
        if (transactionCompleted && callbackSettled) {
          settled = true;
          if (completedBeforeCallback) {
            reject(new MandiriStorageError(
              'transaction_aborted',
              'Callback transaction berjalan setelah transaction menjadi inactive.',
            ));
          } else {
            resolve(callbackResult);
          }
        }
      };

      transaction.oncomplete = () => {
        active = false;
        transactionCompleted = true;
        completedBeforeCallback = !callbackSettled;
        this.#transactionRunning = false;
        settle();
      };
      transaction.onabort = () => {
        active = false;
        transactionError = callbackError
          ?? mapStorageError(transaction.error, 'transaction_aborted');
        this.#transactionRunning = false;
        settle();
      };
      transaction.onerror = () => {
        transactionError = callbackError
          ?? mapStorageError(transaction.error, 'transaction_aborted');
      };

      // Callback may await only requests scheduled on this context. Network calls,
      // timers, and external awaits can let IndexedDB auto-commit and are rejected.
      Promise.resolve()
        .then(() => callback(context))
        .then((result) => {
          callbackSettled = true;
          callbackResult = result;
          settle();
        })
        .catch((error) => {
          callbackSettled = true;
          callbackError = mapStorageError(error, 'transaction_aborted');
          if (active) {
            try {
              transaction.abort();
            } catch (abortError) {
              active = false;
              transactionError = mapStorageError(abortError, 'transaction_aborted');
              this.#transactionRunning = false;
            }
          }
          settle();
        });
    });
  }
}

export function openMandiriDatabase({
  indexedDBFactory = globalThis.indexedDB,
  keyRangeFactory = globalThis.IDBKeyRange,
  databaseName = MANDIRI_DATABASE_NAME,
} = {}) {
  if (!indexedDBFactory || typeof indexedDBFactory.open !== 'function') {
    return Promise.reject(storageError('indexeddb_unavailable'));
  }
  if (typeof databaseName !== 'string' || !databaseName.trim()) {
    return Promise.reject(storageError('data_invalid'));
  }

  return new Promise((resolve, reject) => {
    let request;
    let settled = false;
    let upgradeStarted = false;
    let migrationError;

    try {
      request = indexedDBFactory.open(databaseName, MANDIRI_DATABASE_VERSION);
    } catch (error) {
      if (error?.name === 'VersionError') {
        reject(storageError('schema_too_new', error));
      } else {
        reject(storageError('database_open_failed', error));
      }
      return;
    }

    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(storageError('database_open_blocked'));
    };
    request.onupgradeneeded = (event) => {
      upgradeStarted = true;
      try {
        applyMigrations({
          database: request.result,
          transaction: request.transaction,
          oldVersion: event.oldVersion,
          newVersion: event.newVersion,
        });
      } catch (error) {
        migrationError = mapStorageError(error, 'migration_failed');
        try {
          request.transaction.abort();
        } catch {
          // The open request error below produces the safe migration outcome.
        }
      }
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      if (migrationError) {
        reject(migrationError);
        return;
      }
      if (request.error?.name === 'VersionError') {
        reject(storageError('schema_too_new', request.error));
        return;
      }
      if (upgradeStarted && request.error?.name === 'AbortError') {
        reject(storageError('migration_failed', request.error));
        return;
      }
      reject(storageError('database_open_failed', request.error));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      if (database.version > MANDIRI_DATABASE_VERSION) {
        settled = true;
        database.close();
        reject(storageError('schema_too_new'));
        return;
      }
      settled = true;
      resolve(new MandiriDatabaseConnection(database, keyRangeFactory));
    };
  });
}
