import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMemoryStore, MEMORY_TYPES, VERIFICATION_STATUS, createMemoryRecord, validateMemoryRecord } from '../../scripts/agent/memory-store.mjs';

test('memory-store: persists record to disk', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-store-test-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Test Fact',
      description: 'A test fact for persistence',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
    });
    assert.ok(result.success, 'Should add record');
    const store2 = createMemoryStore(repo);
    const retrieved = store2.get(result.recordId);
    assert.ok(retrieved, 'Record should persist across store instances');
    assert.equal(retrieved.title, 'Test Fact');
    assert.equal(retrieved.recordId, result.recordId);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: handles corrupted JSON gracefully', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-corrupt-'));
  try {
    writeFileSync(join(repo, 'corrupt.json'), '{not valid json at all', 'utf8');
    const store = createMemoryStore(repo);
    const records = store.getAllRecords();
    assert.ok(Array.isArray(records), 'Should return array');
    assert.equal(records.length, 0, 'Should have no records from corrupted file');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: redacts secrets in record fields', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-redact-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'API key is sk-1234567890abcdef1234567890abcdef',
      description: 'Password is hunter2 and token is ghp_1234567890abcdef1234567890abcdef',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
    });
    assert.ok(result.success, 'Should add record');
    const record = store.get(result.recordId);
    assert.ok(!record.title.includes('sk-1234567890abcdef1234567890abcdef'), 'API key should be redacted in title');
    assert.ok(record.title.includes('[REDACTED]'), 'Title should contain redaction marker');
    assert.ok(!record.description.includes('sk-1234567890abcdef1234567890abcdef'), 'API key should be redacted in description');
    assert.ok(!record.description.includes('hunter2'), 'Password should be redacted in description');
    assert.ok(!record.description.includes('ghp_1234567890abcdef1234567890abcdef'), 'GitHub token should be redacted in description');
    assert.ok(record.description.includes('[REDACTED]'), 'Description should contain redaction marker');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: rejects evidence containing secrets', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-secret-evidence-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Test Fact',
      description: 'Normal description',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
      evidence: [
        { content: 'The secret key is sk-1234567890abcdef1234567890abcdef', source: 'test-log' },
      ],
    });
    assert.ok(!result.success, 'Should reject evidence with secrets');
    assert.ok(result.errors.length > 0, 'Should have errors');
    assert.ok(result.errors.some(e => e.includes('secret')), 'Should mention secret in error');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: rejects record with nonexistent supersedes reference', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-supersedes-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Superseding Fact',
      description: 'Supersedes non-existent record',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
      supersedes: 'nonexistent-id-12345',
    });
    assert.ok(!result.success, 'Should reject record with nonexistent supersedes reference');
    assert.ok(result.errors.length > 0, 'Should have errors');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: marks superseded record correctly', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-supersede-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Original Fact',
      description: 'Original content',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
    });
    const result2 = store.add({
      title: 'Superseding Fact',
      description: 'Superseded content',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
      supersedes: result.recordId,
    });
    assert.ok(result2.success, 'Should add superseding record');
    const originalRecord = store.get(result.recordId);
    assert.equal(originalRecord.supersededBy, result2.recordId, 'Original should be marked as superseded');
    assert.equal(originalRecord.verificationStatus, VERIFICATION_STATUS.SUPERSEDED, 'Should be marked superseded');
    assert.ok(!originalRecord.isValid, 'Should be invalid');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: does not silently promote unverified records', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-verify-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Unverified Fact',
      description: 'A fact without verification',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
      verificationStatus: VERIFICATION_STATUS.PENDING,
    });
    const record = store.get(result.recordId);
    assert.equal(record.verificationStatus, VERIFICATION_STATUS.PENDING, 'Should remain pending');
    assert.ok(record.isValid, 'Should still be valid but not verified');
    assert.notEqual(record.verificationStatus, VERIFICATION_STATUS.VERIFIED, 'Should not be verified without explicit verification');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: recovers from corrupted checkpoint file', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-corrupt-'));
  try {
    const store = createMemoryStore(repo);
    store.add({
      title: 'Valid Fact',
      description: 'A valid fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
    });
    const files = readdirSync(repo);
    const jsonFile = join(repo, files.find(f => f.endsWith('.json')));
    writeFileSync(jsonFile, 'not valid json at all', 'utf8');
    const store2 = createMemoryStore(repo);
    const records = store2.getAllRecords();
    assert.ok(Array.isArray(records), 'Should return array');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('memory-store: record state transitions are valid', () => {
  const repo = mkdtempSync(join(tmpdir(), 'memory-transition-'));
  try {
    const store = createMemoryStore(repo);
    const result = store.add({
      title: 'Test Fact',
      description: 'A test fact',
      type: MEMORY_TYPES.VERIFIED_FACT,
      category: 'testing',
      source: 'test',
      verificationStatus: VERIFICATION_STATUS.PENDING,
    });
    const record = store.get(result.recordId);
    assert.equal(record.verificationStatus, VERIFICATION_STATUS.PENDING, 'Should remain pending');
    const verifiedResult = store.markVerified(result.recordId);
    assert.ok(verifiedResult.success, 'Should mark verified');
    const verifiedRecord = store.get(result.recordId);
    assert.equal(verifiedRecord.verificationStatus, VERIFICATION_STATUS.VERIFIED, 'Should be verified');
    assert.ok(verifiedRecord.isValid, 'Should be valid');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
