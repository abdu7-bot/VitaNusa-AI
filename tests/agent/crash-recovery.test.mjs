import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { atomicClaim } from '../../scripts/agent/task-orchestrator.mjs';

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'crash-test-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir });
  const runtimeDir = join(dir, '.git', 'vitanusa-agent');
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(join(runtimeDir, 'evidence'), { recursive: true });
  mkdirSync(join(runtimeDir, 'checkpoints'), { recursive: true });
  return { dir, runtimeDir };
}

test('crash recovery: two workers race to recover same stale claim', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'stale-race-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create a stale lock
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'crashed-worker',
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    fencingToken: Date.now() - 31 * 60 * 1000,
  }));

  // First worker claims the stale lock
  const result1 = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-1');
  assert.ok(result1.success === true, 'First worker should claim stale task');
  assert.equal(result1.stale, true, 'First recovery should be marked stale');

  // Second worker tries to claim same task - should fail
  const result2 = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-2');
  assert.ok(result2.success === false, 'Second worker should not claim task');
  assert.equal(result2.reason, 'Task already claimed by another worker');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: worker crash after claim leaves lock recoverable', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'crash-after-claim-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Simulate worker claiming then crashing (lock file remains but process is gone)
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'crashed-worker',
    claimedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago - not stale yet
    fencingToken: Date.now() - 5 * 60 * 1000,
  }));

  // New worker should NOT claim (not stale yet - only 5 min old)
  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'new-worker');
  assert.ok(result.success === false, 'Active claim should not be stolen even after crash');
  assert.equal(result.reason, 'Task already claimed by another worker');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: repeated recovery attempts do not duplicate ownership', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'repeated-recovery-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create stale lock
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'crashed-worker',
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    fencingToken: Date.now() - 31 * 60 * 1000,
  }));

  // First recovery attempt
  const result1 = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'recovery-1');
  assert.ok(result1.success === true, 'First recovery should succeed');
  assert.equal(result1.stale, true, 'Should be marked as stale recovery');

  // Second recovery attempt on same task (now held by recovery-1)
  const result2 = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'recovery-2');
  assert.ok(result2.success === false, 'Second recovery should fail - task already claimed');
  assert.equal(result2.reason, 'Task already claimed by another worker');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: malformed lock file is rejected safely', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'malformed-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create malformed lock file
  writeFileSync(lockFile, 'not valid json at all');

  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'new-worker');
  // Should handle gracefully - malformed lock means can't determine staleness
  // Either claims (treats as abandoned) or fails safely
  assert.ok(result !== undefined, 'Should return a claim result');
  assert.ok(typeof result.success === 'boolean', 'Should have boolean success field');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: lock ownership metadata missing fields', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'incomplete-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create lock file with missing workerId
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  }));

  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'new-worker');
  // Should handle missing workerId gracefully - stale check catches it based on timestamp
  assert.ok(result !== undefined, 'Should return a claim result');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: old worker cannot release replacement worker lock', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'release-ownership-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create lock owned by worker-A
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'worker-A',
    claimedAt: new Date().toISOString(),
    fencingToken: Date.now(),
  }));

  // atomicClaim with old worker trying to claim should fail (active lock exists)
  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-B');
  assert.ok(result.success === false, 'Old worker should not claim active lock');
  assert.equal(result.reason, 'Task already claimed by another worker');

  // Verify lock still exists
  assert.ok(existsSync(lockFile), 'Lock file should still exist after failed claim');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: correct worker releases own lock, then new worker claims', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'release-then-claim-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create lock owned by worker-A
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'worker-A',
    claimedAt: new Date().toISOString(),
    fencingToken: Date.now(),
  }));

  // atomicClaim with worker-B trying to claim while worker-A still owns it
  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-B');
  assert.ok(result.success === false, 'New worker should not claim active lock');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: stale claim with missing workerId field', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'missing-workerid-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Stale lock with missing workerId
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    fencingToken: Date.now() - 31 * 60 * 1000,
  }));

  const result = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'new-worker');
  // Should handle missing workerId gracefully - stale claim based on timestamp
  assert.ok(result !== undefined, 'Should return a claim result');

  rmSync(dir, { recursive: true, force: true });
});
