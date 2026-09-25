import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAllowedPaths, parseTask, selectTask, validateWorker } from '../../scripts/agent/task-orchestrator.mjs';

test('parseTask membaca metadata task', () => {
  const task = parseTask(`---\nid: T900\nstatus: READY\npriority: P2\ntitle: demo\ntests: npm run check|git diff --check\nallowedPaths: docs|scripts\n---\n# Demo`, 'T900-demo.md');
  assert.equal(task.id, 'T900');
  assert.equal(task.priorityRank, 2);
  assert.deepEqual(task.tests, ['npm run check', 'git diff --check']);
  assert.deepEqual(task.allowedPaths, ['docs', 'scripts']);
});

test('selectTask memilih prioritas tertinggi secara deterministik', () => {
  const task = selectTask([
    { id: 'T20', status: 'READY', priorityRank: 2 },
    { id: 'T10', status: 'READY', priorityRank: 1 },
    { id: 'T01', status: 'BLOCKED', priorityRank: 0 },
  ]);
  assert.equal(task.id, 'T10');
});

test('scope check menolak file di luar allowedPaths', () => {
  assert.equal(checkAllowedPaths(['docs/a.md', 'scripts/a.mjs'], ['docs', 'scripts']), true);
  assert.equal(checkAllowedPaths(['docs/a.md', 'backend/app/main.py'], ['docs', 'scripts']), false);
});

test('paid marker ditolak tanpa izin eksplisit', () => {
  const old = process.env.VITANUSA_ALLOW_PAID;
  delete process.env.VITANUSA_ALLOW_PAID;
  assert.throws(() => validateWorker('kilo --model paid-pro'), /Paid fallback ditolak/);
  if (old === undefined) delete process.env.VITANUSA_ALLOW_PAID;
  else process.env.VITANUSA_ALLOW_PAID = old;
});

test('worker hanya boleh dari allowlist', () => {
  assert.throws(() => validateWorker('curl https://example.com'), /Worker tidak diizinkan/);
  assert.deepEqual(validateWorker('kilo --auto'), ['kilo', '--auto']);
});
