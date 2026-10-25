import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMemoryStore, MEMORY_TYPES, VERIFICATION_STATUS, createMemoryRecord, validateMemoryRecord } from '../../scripts/agent/memory-store.mjs';

test('memory-store: creates store with directory', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);
    assert.ok(store, 'Should create store');
    assert.ok(typeof store.add === 'function', 'Should have add method');
    assert.ok(typeof store.get === 'function', 'Should have get method');
    assert.ok(typeof store.getAll === 'function', 'Should have getAll method');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: creates memory record', () => {
  const record = createMemoryRecord({
    title: 'Test Fact',
    description: 'A test fact',
    type: MEMORY_TYPES.VERIFIED_FACT,
    category: 'testing',
    source: 'test',
  });

  assert.ok(record.recordId, 'Should have record ID');
  assert.equal(record.title, 'Test Fact');
  assert.equal(record.type, MEMORY_TYPES.VERIFIED_FACT);
  assert.ok(record.createdAt, 'Should have creation timestamp');
  assert.ok(record.lastValidatedAt, 'Should have validation timestamp');
  assert.equal(record.verificationStatus, VERIFICATION_STATUS.PENDING, 'Should default to pending');
});

test('memory-store: validates memory record', () => {
  const validRecord = createMemoryRecord({
    title: 'Valid Record',
    description: 'A valid record',
    type: MEMORY_TYPES.VERIFIED_FACT,
  });

  const validation = validateMemoryRecord(validRecord);
  assert.ok(validation.valid, 'Should be valid');
  assert.equal(validation.errors.length, 0, 'Should have no errors');

  const invalidRecord = { title: 'Bad' };
  const invalidValidation = validateMemoryRecord(invalidRecord);
  assert.ok(!invalidValidation.valid, 'Should be invalid');
  assert.ok(invalidValidation.errors.length > 0, 'Should have errors');
});

test('memory-store: adds and retrieves records', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    const result = store.add({
      title: 'Test Fact',
      description: 'A test fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
    });

    assert.ok(result.success, 'Should add record');
    assert.ok(result.record.recordId, 'Should have record ID');

    const retrieved = store.get(result.recordId);
    assert.ok(retrieved, 'Should retrieve record');
    assert.equal(retrieved.title, 'Test Fact');
    assert.equal(retrieved.recordId, result.recordId);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: filters records by type', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    store.add({ title: 'Fact 1', description: 'Fact 1', type: MEMORY_TYPES.VERIFIED_FACT, category: 'testing' });
    store.add({ title: 'Fact 2', description: 'Fact 2', type: MEMORY_TYPES.TEST_OBSERVATION, category: 'testing' });
    store.add({ title: 'Fact 3', description: 'Fact 3', type: MEMORY_TYPES.VERIFIED_FACT, category: 'other' });

    const factTests = store.getAll({ type: MEMORY_TYPES.VERIFIED_FACT });
    assert.equal(factTests.length, 2, 'Should find 2 fact records');

    const testTests = store.getAll({ type: MEMORY_TYPES.TEST_OBSERVATION });
    assert.equal(testTests.length, 1, 'Should find 1 test observation');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: rejects invalid records', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    const result = store.add({
      title: '', // Invalid - empty title
      description: 'A test',
      type: MEMORY_TYPES.VERIFIED_FACT,
    });

    assert.ok(!result.success, 'Should reject invalid record');
    assert.ok(result.errors.length > 0, 'Should have errors');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: marks record as stale', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    const result = store.add({
      title: 'Test Fact',
      description: 'A test fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
    });

    const result2 = store.markStale(result.recordId);
    assert.ok(result2.success, 'Should mark stale');

    const record = store.get(result.recordId);
    assert.equal(record.verificationStatus, VERIFICATION_STATUS.STALE, 'Should be stale');
    assert.ok(!record.isValid, 'Should be invalid');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: marks record as verified', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    const result = store.add({
      title: 'Test Fact',
      description: 'A test fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
    });

    const result2 = store.markVerified(result.recordId);
    assert.ok(result2.success, 'Should mark verified');

    const record = store.get(result.recordId);
    assert.equal(record.verificationStatus, VERIFICATION_STATUS.VERIFIED, 'Should be verified');
    assert.ok(record.isValid, 'Should be valid');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: finds stale records', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);

    // Add a record with old timestamp
    store.add({
      title: 'Old Fact',
      description: 'An old fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
    });

    // Manually set old timestamp
    const records = store.getAllRecords();
    const oldRecord = records[records.length - 1];
    oldRecord.lastValidatedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
    console.log('DEBUG: oldRecord.lastValidatedAt =', oldRecord.lastValidatedAt);
    store.add({ ...oldRecord, recordId: oldRecord.recordId }); // Re-add with old timestamp

    const records2 = store.getAllRecords();
    console.log('DEBUG: All records:');
    records2.forEach((r, i) => console.log('  Record', i, ':', r.recordId, 'lastValidatedAt =', r.lastValidatedAt));

    const staleRecords = store.getStaleRecords(30);
    console.log('DEBUG: staleRecords.length =', staleRecords.length);
    assert.ok(staleRecords.length >= 1, 'Should find at least 1 stale record');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
