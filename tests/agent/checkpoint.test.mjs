import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCheckpoint, validateCheckpoint, isRecoverable, isTerminal, saveCheckpoint, loadCheckpoint, findLatestCheckpoint } from '../../scripts/agent/checkpoint.mjs';

test('checkpoint: valid checkpoint passes validation', () => {
  const cp = createCheckpoint('T1', 'RUNNING', { attempt: 1, lastStep: 'execute' });
  assert.deepEqual(validateCheckpoint(cp), []);
});

test('checkpoint: missing taskId fails validation', () => {
  const cp = createCheckpoint('T1', 'RUNNING');
  cp.taskId = null;
  assert.ok(validateCheckpoint(cp).length > 0);
});

test('checkpoint: incompatible version fails validation', () => {
  const cp = createCheckpoint('T1', 'RUNNING');
  cp.version = 999;
  assert.ok(validateCheckpoint(cp).length > 0);
});

test('checkpoint: isRecoverable returns true for running states', () => {
  assert.equal(isRecoverable('RUNNING'), true);
  assert.equal(isRecoverable('VERIFYING'), true);
  assert.equal(isRecoverable('SUCCEEDED'), false);
});

test('checkpoint: isTerminal returns true for terminal states', () => {
  assert.equal(isTerminal('SUCCEEDED'), true);
  assert.equal(isTerminal('FAILED'), true);
  assert.equal(isTerminal('RUNNING'), false);
});

test('checkpoint: save and load roundtrip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cp-'));
  const cp = createCheckpoint('T1', 'RUNNING', { attempt: 1 });
  saveCheckpoint(dir, cp);
  const loaded = loadCheckpoint(dir, 'T1', 1);
  assert.equal(loaded.state, 'RUNNING');
  assert.equal(loaded.taskId, 'T1');
  rmSync(dir, { recursive: true, force: true });
});

test('checkpoint: corrupted checkpoint throws on load', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cp-'));
  const file = join(dir, 'T1-1.json');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, '{corrupted');
  assert.throws(() => loadCheckpoint(dir, 'T1', 1), /Failed to load checkpoint/i);
  rmSync(dir, { recursive: true, force: true });
});

test('checkpoint: findLatestCheckpoint returns highest attempt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cp-'));
  saveCheckpoint(dir, createCheckpoint('T1', 'RUNNING', { attempt: 1 }));
  saveCheckpoint(dir, createCheckpoint('T1', 'VERIFYING', { attempt: 2 }));
  const latest = await findLatestCheckpoint(dir, 'T1');
  assert.equal(latest.executionAttempt, 2);
  assert.equal(latest.state, 'VERIFYING');
  rmSync(dir, { recursive: true, force: true });
});

test('checkpoint: findLatestCheckpoint returns null for missing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cp-'));
  const result = await findLatestCheckpoint(dir, 'NONEXISTENT');
  assert.equal(result, null);
  rmSync(dir, { recursive: true, force: true });
});
