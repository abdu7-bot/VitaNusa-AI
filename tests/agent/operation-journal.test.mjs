import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournal, OPERATION_STATES } from '../../scripts/agent/operation-journal.mjs';
import { writeFileSync } from 'node:fs';

test('journal: record and retrieve operation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jl-'));
  const j = createJournal(dir);
  const entry = j.record({ taskId: 'T1', type: 'git_push', target: 'origin/main', status: OPERATION_STATES.STARTED });
  assert.ok(entry.id);
  const retrieved = j.get(entry.id);
  assert.equal(retrieved.taskId, 'T1');
  assert.equal(retrieved.status, OPERATION_STATES.STARTED);
  rmSync(dir, { recursive: true, force: true });
});

test('journal: update operation status', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jl-'));
  const j = createJournal(dir);
  const entry = j.record({ taskId: 'T1', type: 'git_push', target: 'origin/main', status: OPERATION_STATES.STARTED });
  const updated = j.update(entry.id, { status: OPERATION_STATES.CONFIRMED, confirmedAt: new Date().toISOString() });
  assert.equal(updated.status, OPERATION_STATES.CONFIRMED);
  assert.equal(j.isConfirmed(entry.id), true);
  rmSync(dir, { recursive: true, force: true });
});

test('journal: listByTask returns matching entries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jl-'));
  const j = createJournal(dir);
  j.record({ taskId: 'T1', type: 'git_push', target: 'origin/main' });
  j.record({ taskId: 'T2', type: 'git_push', target: 'origin/main' });
  const t1Ops = await j.listByTask('T1');
  assert.equal(t1Ops.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('journal: get returns null for missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jl-'));
  const j = createJournal(dir);
  assert.equal(j.get('nonexistent'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('journal: corrupted entry handled gracefully', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jl-'));
  const j = createJournal(dir);
  writeFileSync(join(dir, 'bad.json'), '{corrupted');
  // Should not throw
  const result = j.get('bad');
  // get reads by id, not filename, so this should be null
  assert.equal(result, null);
  rmSync(dir, { recursive: true, force: true });
});
