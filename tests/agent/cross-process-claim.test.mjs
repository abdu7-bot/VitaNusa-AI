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
      const w = fork('/tmp/kilo/claim-worker.mjs', [runtimeDir, taskId, `worker-${i}`], {
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
      const w = fork('/tmp/kilo/claim-worker.mjs', [runtimeDir, `task-${i}`, `worker-${i}`], {
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
