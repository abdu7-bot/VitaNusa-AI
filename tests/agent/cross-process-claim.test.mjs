import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cp-test-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir });
  const runtimeDir = join(dir, '.git', 'vitanusa-agent');
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(join(runtimeDir, 'evidence'), { recursive: true });
  return { dir, runtimeDir };
}

test('cross-process: only one process claims same task', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'contested-task';

  const results = await new Promise((resolve) => {
    const workers = [];
    const collected = [];
    let done = 0;

    for (let i = 0; i < 2; i++) {
      const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, `worker-${i}`], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      w.on('message', (msg) => {
        collected.push(msg);
        done++;
        if (done === 2) resolve(collected);
      });
      w.on('error', (err) => {
        collected.push({ workerId: `worker-${i}`, error: err.message });
        done++;
        if (done === 2) resolve(collected);
      });
      workers.push(w);
    }
  });

  const claimed = results.filter(r => r.claimed && r.claimed.success === true);
  assert.equal(claimed.length, 1, `Expected exactly 1 claim, got ${claimed.length}: ${JSON.stringify(results)}`);

  rmSync(dir, { recursive: true, force: true });
});

test('cross-process: independent tasks can be claimed concurrently', async () => {
  const { dir, runtimeDir } = createTempRepo();

  const results = await new Promise((resolve) => {
    const collected = [];
    let done = 0;

    for (let i = 0; i < 2; i++) {
      const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, `task-${i}`, `worker-${i}`], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      w.on('message', (msg) => {
        collected.push(msg);
        done++;
        if (done === 2) resolve(collected);
      });
      w.on('error', (err) => {
        collected.push({ workerId: `worker-${i}`, error: err.message });
        done++;
        if (done === 2) resolve(collected);
      });
    }
  });

  const claimed = results.filter(r => r.claimed && r.claimed.success === true);
  assert.equal(claimed.length, 2, `Expected 2 claims, got ${claimed.length}: ${JSON.stringify(results)}`);

  rmSync(dir, { recursive: true, force: true });
});

test('cross-process: stale claim is recovered by new process', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'stale-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create a stale lock (claimed 31 minutes ago)
  const { writeFileSync } = await import('node:fs');
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'old-worker',
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    fencingToken: Date.now() - 31 * 60 * 1000,
  }));

  // New process should recover the stale claim
  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'new-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  assert.ok(result.claimed && result.claimed.success, 'Stale claim should be recovered');
  assert.equal(result.claimed.stale, true, 'Should be marked as stale recovery');

  rmSync(dir, { recursive: true, force: true });
});

test('cross-process: active claim is not stolen', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const taskId = 'active-task';
  const lockFile = join(runtimeDir, 'claim-' + taskId + '.lock');

  // Create a fresh (non-stale) lock
  const { writeFileSync } = await import('node:fs');
  writeFileSync(lockFile, JSON.stringify({
    taskId,
    workerId: 'active-worker',
    claimedAt: new Date().toISOString(),
    fencingToken: Date.now(),
  }));

  // New process should NOT claim (active lock)
  const result = await new Promise((resolve) => {
    const w = fork(new URL('./helpers/claim-worker.mjs', import.meta.url), [runtimeDir, taskId, 'thief-worker'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    w.on('message', (msg) => resolve(msg));
    w.on('error', (err) => resolve({ error: err.message }));
  });

  assert.ok(result.claimed && result.claimed.success === false, 'Active claim should not be stolen');
  assert.equal(result.claimed.reason, 'Task already claimed by another worker');

  rmSync(dir, { recursive: true, force: true });
});
