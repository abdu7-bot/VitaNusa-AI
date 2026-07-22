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
  MANDIRI_SCHEMA_V3,
  MANDIRI_SCHEMA_V4,
  MANDIRI_SCHEMA_V5,
} from '../../../assets/js/mandiri/storage/schema.js';

function openRaw(factory, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = (event) => upgrade?.(request.result, request.transaction, event);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

test('database baru version 5 membuat tiga belas store, seluruh index, dan metadata schema', async () => {
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
    assert.equal(metadata.schemaVersion, 5);
    assert.match(metadata.updatedAtLocal, /^\d{4}-\d{2}-\d{2}T/);
  });

  await connection.runTransaction(MANDIRI_ALLOWED_STORE_NAMES, 'readonly', (transaction) => {
    for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V4)) {
      const store = transaction.objectStore(storeName);
      assert.deepEqual(store.keyPath, definition.keyPath);
      assert.deepEqual([...store.indexNames], Object.keys(definition.indexes).sort());
    }
    for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V5)) {
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

test('upgrade version 2 ke 3 mempertahankan seluruh store dan record Fase 1–2', async () => {
  const factory = new IDBFactory();
  const databaseName = 'migration-v2-v3';
  const legacy = await openRaw(factory, databaseName, 2, (database, transaction, event) => {
    applyMigrations({ database, transaction, oldVersion: event.oldVersion, newVersion: 2 });
  });
  const legacyStores = Object.keys(MANDIRI_SCHEMA_V2);
  const write = legacy.transaction(legacyStores, 'readwrite');
  for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V2)) {
    const keyPath = Array.isArray(definition.keyPath) ? definition.keyPath : [definition.keyPath];
    const record = Object.fromEntries(keyPath.map((field, index) => [field, `${storeName}-${index}`]));
    write.objectStore(storeName).put(record);
  }
  await new Promise((resolve, reject) => {
    write.oncomplete = resolve;
    write.onabort = () => reject(write.error);
  });
  legacy.close();

  const upgraded = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName,
  });
  assert.equal(upgraded.database.version, 5);
  assert.deepEqual([...upgraded.database.objectStoreNames], [...MANDIRI_ALLOWED_STORE_NAMES].sort());
  await upgraded.runTransaction(legacyStores, 'readonly', async (transaction) => {
    for (const [storeName, definition] of Object.entries(MANDIRI_SCHEMA_V2)) {
      const key = (Array.isArray(definition.keyPath) ? definition.keyPath : [definition.keyPath])
        .map((_field, index) => `${storeName}-${index}`);
      const value = await transaction.request(
        transaction.objectStore(storeName).get(Array.isArray(definition.keyPath) ? key : key[0]),
      );
      assert.ok(value, `${storeName} record harus tetap tersedia`);
    }
  });
  upgraded.close();
});

test('upgrade version 3 ke 5 mempertahankan seluruh store dan record Fase 1–3', async () => {
  const factory = new IDBFactory();
  const databaseName = 'migration-v3-v4';
  const legacy = await openRaw(factory, databaseName, 3, (database, transaction, event) => {
    applyMigrations({ database, transaction, oldVersion: event.oldVersion, newVersion: 3 });
  });
  const write = legacy.transaction('products', 'readwrite');
  write.objectStore('products').put({
    accountScope: 'account:legacy', workspaceId: 'workspace_legacy', productId: 'product_legacy',
  });
  await new Promise((resolve, reject) => {
    write.oncomplete = resolve;
    write.onabort = () => reject(write.error);
  });
  legacy.close();
  const upgraded = await openMandiriDatabase({
    indexedDBFactory: factory, keyRangeFactory: IDBKeyRange, databaseName,
  });
  assert.equal(upgraded.database.version, 5);
  const legacyProduct = await upgraded.runTransaction(['products'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('products').get([
      'account:legacy', 'workspace_legacy', 'product_legacy',
    ]))
  ));
  assert.ok(legacyProduct);
  assert.ok(upgraded.database.objectStoreNames.contains('stockMovements'));
  assert.ok(upgraded.database.objectStoreNames.contains('inventoryBalances'));
  assert.ok(upgraded.database.objectStoreNames.contains('cartDrafts'));
  assert.ok(upgraded.database.objectStoreNames.contains('cartLines'));
  upgraded.close();
});

test('upgrade version 4 ke 5 menambahkan cart draft dan cart lines', async () => {
  const factory = new IDBFactory();
  const databaseName = 'migration-v4-v5';
  const legacy = await openRaw(factory, databaseName, 4, (database, transaction, event) => {
    applyMigrations({ database, transaction, oldVersion: event.oldVersion, newVersion: 4 });
  });
  const write = legacy.transaction('products', 'readwrite');
  write.objectStore('products').put({
    accountScope: 'account:legacy-v4',
    workspaceId: 'workspace_legacy_v4',
    productId: 'product_legacy_v4',
  });
  await new Promise((resolve, reject) => {
    write.oncomplete = resolve;
    write.onabort = () => reject(write.error);
  });
  legacy.close();
  const upgraded = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName,
  });
  assert.equal(upgraded.database.version, 5);
  assert.ok(upgraded.database.objectStoreNames.contains('cartDrafts'));
  assert.ok(upgraded.database.objectStoreNames.contains('cartLines'));
  const legacyProduct = await upgraded.runTransaction(['products'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('products').get([
      'account:legacy-v4', 'workspace_legacy_v4', 'product_legacy_v4',
    ]))
  ));
  assert.ok(legacyProduct);
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
