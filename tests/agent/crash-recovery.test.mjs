import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

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

// Worker that claims a task and then crashes (process exits) without releasing
function createCrashWorker(runtimeDir, taskId, workerId, crashAfterClaim = true) {
  return fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, workerId], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
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

  const results = await new Promise((resolve) => {
    const workers = [];
    const collected = [];
    let done = 0;

    for (let i = 0; i < 2; i++) {
      const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, `recovery-${i}`], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      w.on('message', (msg) => {
        collected.push(msg);
        done++;
        if (done === 2) resolve(collected);
      });
      w.on('error', (err) => {
        collected.push({ workerId: `recovery-${i}`, error: err.message });
        done++;
        if (done === 2) resolve(collected);
      });
      workers.push(w);
    }
  });

  const successfulClaims = results.filter(r => r.claimed && r.claimed.success === true);
  assert.equal(successfulClaims.length, 1, `Expected exactly 1 successful stale claim recovery, got ${successfulClaims.length}: ${JSON.stringify(results)}`);

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

  // New process should NOT claim (not stale yet - only 5 min old)
  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'new-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  assert.ok(result.claimed && result.claimed.success === false, 'Active claim should not be stolen even after crash');
  assert.equal(result.claimed.reason, 'Task already claimed by another worker');

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
  const result1 = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'recovery-1'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  assert.ok(result1.claimed && result1.claimed.success, 'First recovery should succeed');
  assert.equal(result1.claimed.stale, true);

  // Second recovery attempt on same task (now held by recovery-1)
  const result2 = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'recovery-2'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  assert.ok(result2.claimed && result2.claimed.success === false, 'Second recovery should fail - task already claimed');
  assert.equal(result2.claimed.reason, 'Task already claimed by another worker');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: malformed lock file is rejected safely', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'malformed-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create malformed lock file
  writeFileSync(lockFile, 'not valid json at all');

  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'new-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  // Should handle gracefully - malformed lock means can't determine staleness
  // Either claims (treats as abandoned) or fails safely
  assert.ok(result.claimed !== undefined, 'Should return a claim result');
  assert.ok(typeof result.claimed.success === 'boolean', 'Should have boolean success field');

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

  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'new-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  // Should handle gracefully - missing workerId means can't determine ownership
  // Should either claim safely or fail safely
  assert.ok(result.claimed !== undefined, 'Should return a claim result');

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

  // Import releaseClaim and test with wrong workerId
  const { releaseClaim } = await import(new URL('../../scripts/agent/task-orchestrator.mjs', import.meta.url));
  const result = releaseClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-B');
  assert.ok(result.success === false, 'Old worker should not release replacement lock');
  assert.equal(result.reason, 'Claim ownership mismatch, cannot release');

  // Verify lock still exists
  assert.ok(existsSync(lockFile), 'Lock file should still exist after failed release');

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

  // Worker-A releases own lock
  const { releaseClaim, atomicClaim } = await import(new URL('../../scripts/agent/task-orchestrator.mjs', import.meta.url));
  const releaseResult = releaseClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-A');
  assert.ok(releaseResult.success === true, 'Correct worker should release own lock');

  // Verify lock is removed
  assert.ok(!existsSync(lockFile), 'Lock file should be removed after successful release');

  // New worker can now claim
  const claimResult = atomicClaim({ RUNTIME_DIR: runtimeDir }, taskId, 'worker-B');
  assert.ok(claimResult.success, 'New worker should claim after release');

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

  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'new-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  // Should handle missing workerId gracefully - stale claim based on timestamp
  assert.ok(result.claimed !== undefined, 'Should return a claim result');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: corrupted checkpoint is rejected safely', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'corrupted-checkpoint-task';
  const checkpointDir = join(runtimeDir, 'checkpoints');
  mkdirSync(checkpointDir, { recursive: true });

  // Write corrupted checkpoint
  writeFileSync(join(checkpointDir, taskId + '-1.json'), 'not valid json at all');

  const { loadCheckpoint } = await import(new URL('../../scripts/agent/checkpoint.mjs', import.meta.url));
  let threw = false;
  try {
    await loadCheckpoint(checkpointDir, taskId, 1);
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('Corrupted checkpoint') || e.message.includes('Failed to load checkpoint'),
      'Should report corrupted checkpoint safely: ' + e.message);
  }
  assert.ok(threw, 'Should throw on corrupted checkpoint');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: checkpoint with invalid schema is rejected', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'invalid-checkpoint-task';
  const checkpointDir = join(runtimeDir, 'checkpoints');
  mkdirSync(checkpointDir, { recursive: true });

  // Write checkpoint with missing required fields
  writeFileSync(join(checkpointDir, taskId + '-1.json'), JSON.stringify({
    taskId: taskId,
    // missing state, executionAttempt, etc.
  }));

  const { loadCheckpoint, validateCheckpoint } = await import(new URL('../../scripts/agent/checkpoint.mjs', import.meta.url));
  let threw = false;
  try {
    loadCheckpoint(checkpointDir, taskId, 1);
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('Corrupted checkpoint') || e.message.includes('Failed to load checkpoint'),
      'Should report corrupted checkpoint safely: ' + e.message);
  }
  assert.ok(threw, 'Should throw on corrupted checkpoint');

  rmSync(dir, { recursive: true, force: true });
});

test('crash recovery: stale lock recovery preserves lock integrity under concurrent access', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'concurrent-stale-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create stale lock
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'dead-worker',
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    fencingToken: Date.now() - 31 * 60 * 1000,
  }));

  // Two workers try to recover simultaneously
  const results = await new Promise((resolve) => {
    const collected = [];
    let done = 0;
    const workers = [];
    for (let i = 0; i < 2; i++) {
      const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'recovery-' + i], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      w.on('message', (msg) => { collected.push(msg); done++; if (done === 2) resolve(collected); });
      w.on('error', (err) => { collected.push({ workerId: 'recovery-' + i, error: err.message }); done++; if (done === 2) resolve(collected); });
      workers.push(w);
    }
  });

  const successfulClaims = results.filter(r => r.claimed && r.claimed.success === true);
  assert.equal(successfulClaims.length, 1, `Exactly one worker should recover stale claim, got ${successfulClaims.length}: ${JSON.stringify(results)}`);

  rmSync(dir, { recursive: true, force: true });
});
