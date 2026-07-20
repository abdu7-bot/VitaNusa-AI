import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import {
  openMandiriDatabase,
  requestToPromise,
} from '../../../assets/js/mandiri/storage/database.js';

function openRaw(factory, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

test('IndexedDB unavailable dipetakan aman', async () => {
  await assert.rejects(openMandiriDatabase({ indexedDBFactory: undefined }), {
    code: 'indexeddb_unavailable',
  });
});

test('database dapat dibuka, mempunyai version benar, dan dapat ditutup', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: 'database-open-close',
  });
  assert.equal(connection.schemaVersion, 4);
  assert.equal(connection.database.version, 4);
  connection.close();
  connection.close();
  assert.throws(() => connection.runTransaction(['metadata'], 'readonly', () => {}), {
    code: 'database_open_failed',
  });
});

test('transaksi readonly dan readwrite berhasil', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: 'database-transactions',
  });
  await connection.runTransaction(['metadata'], 'readwrite', async (transaction) => {
    await transaction.request(transaction.objectStore('metadata').add({ key: 'test', value: 1 }));
  });
  const value = await connection.runTransaction(['metadata'], 'readonly', (transaction) => (
    transaction.request(transaction.objectStore('metadata').get('test'))
  ));
  assert.deepEqual(value, { key: 'test', value: 1 });
  connection.close();
});

test('versionchange menutup koneksi lama dan operasi berikutnya ditolak', async () => {
  const factory = new IDBFactory();
  const connection = await openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'database-versionchange',
  });
  const newer = await openRaw(factory, 'database-versionchange', 5, () => {});
  assert.throws(() => connection.runTransaction(['metadata'], 'readonly', () => {}), {
    code: 'schema_too_new',
  });
  newer.close();
});

test('schema lebih baru ditolak tanpa downgrade atau write', async () => {
  const factory = new IDBFactory();
  const newer = await openRaw(factory, 'database-newer-schema', 5, (database) => {
    const store = database.createObjectStore('sentinel', { keyPath: 'key' });
    store.add({ key: 'unchanged', value: 7 });
  });
  newer.close();
  await assert.rejects(openMandiriDatabase({
    indexedDBFactory: factory,
    keyRangeFactory: IDBKeyRange,
    databaseName: 'database-newer-schema',
  }), { code: 'schema_too_new' });
  const reopened = await openRaw(factory, 'database-newer-schema', 5);
  const transaction = reopened.transaction('sentinel', 'readonly');
  assert.deepEqual(await requestToPromise(transaction.objectStore('sentinel').get('unchanged')), {
    key: 'unchanged',
    value: 7,
  });
  reopened.close();
});

test('request dan constraint error dipetakan aman tanpa payload', async () => {
  const connection = await openMandiriDatabase({
    indexedDBFactory: new IDBFactory(),
    keyRangeFactory: IDBKeyRange,
    databaseName: 'database-request-error',
  });
  await connection.runTransaction(['metadata'], 'readwrite', (transaction) => (
    transaction.request(transaction.objectStore('metadata').add({ key: 'duplicate' }))
  ));
  await assert.rejects(connection.runTransaction(['metadata'], 'readwrite', (transaction) => (
    transaction.request(transaction.objectStore('metadata').add({
      key: 'duplicate',
      payload: 'TOKEN-SANGAT-RAHASIA',
    }))
  )), (error) => {
    assert.equal(error.code, 'constraint_violation');
    assert.doesNotMatch(error.message, /TOKEN|RAHASIA|payload/);
    return true;
  });
  connection.close();
});

test('open blocked menghasilkan error terkontrol', async () => {
  const request = {};
  const factory = { open: () => request };
  const promise = openMandiriDatabase({ indexedDBFactory: factory, databaseName: 'blocked' });
  queueMicrotask(() => request.onblocked());
  await assert.rejects(promise, { code: 'database_open_blocked' });
});

test('open gagal dipetakan ke database_open_failed tanpa pesan browser mentah', async () => {
  const request = {};
  const factory = { open: () => request };
  const promise = openMandiriDatabase({ indexedDBFactory: factory, databaseName: 'open-failed' });
  queueMicrotask(() => {
    request.error = { name: 'UnknownError', message: 'TOKEN-RAW-PAYLOAD' };
    request.onerror();
  });
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, 'database_open_failed');
    assert.doesNotMatch(error.message, /TOKEN|RAW|PAYLOAD/);
    return true;
  });
});
