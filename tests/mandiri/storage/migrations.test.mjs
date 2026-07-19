import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openMandiriDatabase } from '../../../assets/js/mandiri/storage/database.js';
import { applyMigrations } from '../../../assets/js/mandiri/storage/migrations.js';
import {
  MANDIRI_ALLOWED_STORE_NAMES,
  MANDIRI_SCHEMA_V1,
  MANDIRI_SCHEMA_V2,
} from '../../../assets/js/mandiri/storage/schema.js';

function openRaw(factory, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = (event) => upgrade?.(request.result, request.transaction, event);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

test('migration version 2 membuat tujuh store, seluruh index, dan metadata schema', async () => {
  const factory = new IDBFactory();
  const connection = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'migration-v1',
  });
  assert.deepEqual(
    [...connection.database.objectStoreNames],
    [...MANDIRI_ALLOWED_STORE_NAMES].sort(),
  );

  await connection.runTransaction(['metadata'], 'readonly', async (transaction) => {
    const metadata = await transaction.request(transaction.objectStore('metadata').get('schema'));
    assert.equal(metadata.schemaVersion, 2);
    assert.match(metadata.updatedAtLocal, /^\d{4}-\d{2}-\d{2}T/);
  });

  await connection.runTransaction(MANDIRI_ALLOWED_STORE_NAMES, 'readonly', (transaction) => {
    for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V2)) {
      const store = transaction.objectStore(storeName);
      assert.deepEqual(store.keyPath, definition.keyPath);
      assert.deepEqual([...store.indexNames], Object.keys(definition.indexes).sort());
    }
  });
  connection.close();
});

test('repeated open tidak membuat duplicate store atau index', async () => {
  const factory = new IDBFactory();
  const first = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'migration-repeat',
  });
  first.close();
  const second = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'migration-repeat',
  });
  assert.deepEqual([...second.database.objectStoreNames], [...MANDIRI_ALLOWED_STORE_NAMES].sort());
  second.close();
});

test('upgrade version 1 ke 2 mempertahankan record lama dan menambah learning store', async () => {
  const factory = new IDBFactory();
  const legacy = await openRaw(factory, 'migration-v1-v2', 1, (database, transaction, event) => {
    applyMigrations({ database, transaction, oldVersion: event.oldVersion, newVersion: 1 });
  });
  const write = legacy.transaction('metadata', 'readwrite');
  write.objectStore('metadata').put({ key: 'legacy', value: 7 });
  await new Promise((resolve, reject) => {
    write.oncomplete = resolve;
    write.onabort = () => reject(write.error);
  });
  legacy.close();

  const upgraded = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'migration-v1-v2',
  });
  const legacyRecord = await upgraded.runTransaction(['metadata'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('metadata').get('legacy'))
  ));
  assert.deepEqual(legacyRecord, { key: 'legacy', value: 7 });
  assert.ok(upgraded.database.objectStoreNames.contains('learningAttempts'));
  assert.ok(upgraded.database.objectStoreNames.contains('learningProgress'));
  upgraded.close();
});

test('migration version 1 tetap hanya membuat schema v1', async () => {
  const factory = new IDBFactory();
  const database = await openRaw(factory, 'migration-recovery', 1, (db, transaction, event) => {
    db.createObjectStore('metadata', { keyPath: 'key' });
    const workspaceStore = db.createObjectStore('workspaces', {
      keyPath: ['accountScope', 'workspaceId'],
    });
    workspaceStore.createIndex('byAccountStatus', ['accountScope', 'status']);
    applyMigrations({
      database: db,
      transaction,
      oldVersion: event.oldVersion,
      newVersion: event.newVersion,
      now: () => '2026-07-16T00:00:00.000Z',
    });
  });
  assert.deepEqual([...database.objectStoreNames], Object.keys(MANDIRI_SCHEMA_V1).sort());
  const transaction = database.transaction('metadata', 'readonly');
  const request = transaction.objectStore('metadata').get('schema');
  const metadata = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(metadata.updatedAtLocal, '2026-07-16T00:00:00.000Z');
  assert.equal(metadata.schemaVersion, 1);
  database.close();
});

test('migration tidak destruktif dan tidak melakukan network', () => {
  const source = fs.readFileSync(
    new URL('../../../assets/js/mandiri/storage/migrations.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /deleteObjectStore|deleteIndex|\.clear\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|firebase|firestore/i);
});
