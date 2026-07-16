import {
  MANDIRI_DATABASE_VERSION,
  MANDIRI_SCHEMA_V1,
  MANDIRI_STORE_NAMES,
} from './schema.js';
import {
  MandiriStorageError,
  mapStorageError,
  storageError,
} from './storage-errors.js';

function keyPathsEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

function ensureIndex(objectStore, indexName, definition) {
  if (!objectStore.indexNames.contains(indexName)) {
    objectStore.createIndex(indexName, definition.keyPath, {
      unique: definition.unique,
      multiEntry: definition.multiEntry,
    });
    return;
  }

  const current = objectStore.index(indexName);
  if (
    !keyPathsEqual(current.keyPath, definition.keyPath)
    || current.unique !== definition.unique
    || current.multiEntry !== definition.multiEntry
  ) {
    throw storageError('migration_failed');
  }
}

function ensureStore(database, transaction, storeName, definition) {
  let objectStore;
  if (!database.objectStoreNames.contains(storeName)) {
    objectStore = database.createObjectStore(storeName, { keyPath: definition.keyPath });
  } else {
    objectStore = transaction.objectStore(storeName);
    if (!keyPathsEqual(objectStore.keyPath, definition.keyPath)) {
      throw storageError('migration_failed');
    }
  }

  for (const [indexName, indexDefinition] of Object.entries(definition.indexes)) {
    ensureIndex(objectStore, indexName, indexDefinition);
  }
  return objectStore;
}

export function applyMigrations({
  database,
  transaction,
  oldVersion,
  newVersion,
  now = () => new Date().toISOString(),
}) {
  try {
    if (!database || !transaction) throw storageError('migration_failed');
    if (!Number.isSafeInteger(oldVersion) || oldVersion < 0) {
      throw storageError('migration_failed');
    }
    if (!Number.isSafeInteger(newVersion) || newVersion < 1) {
      throw storageError('migration_failed');
    }
    if (oldVersion > MANDIRI_DATABASE_VERSION) {
      throw storageError('schema_too_new');
    }

    // Migrations only schedule IndexedDB requests inside the active upgrade transaction.
    // They never await timers, network, external APIs, or another transaction.
    if (newVersion >= 1) {
      for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V1)) {
        ensureStore(database, transaction, storeName, definition);
      }

      const metadataStore = transaction.objectStore(MANDIRI_STORE_NAMES.METADATA);
      metadataStore.put({
        key: 'schema',
        schemaVersion: MANDIRI_DATABASE_VERSION,
        updatedAtLocal: now(),
      });
    }
  } catch (error) {
    if (error instanceof MandiriStorageError && error.code === 'schema_too_new') throw error;
    if (error instanceof MandiriStorageError && error.code === 'migration_failed') throw error;
    throw storageError('migration_failed', error);
  }
}
