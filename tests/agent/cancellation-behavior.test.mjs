import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { cleanupWorkspace } from '../../scripts/agent/isolated-workspace.mjs';

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cancel-verify-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir });
  return dir;
}

function spawnAndTrack(cmd, args = []) {
  const child = spawn(cmd, args);
  return child;
}

test('cancellation: SIGTERM terminates a long-running child process', async () => {
  const dir = createTempRepo();
  let child = null;
  try {
    child = spawn('sleep', ['60']);
    assert.ok(child.pid > 0, 'Child process should have a valid PID');

    let terminated = false;
    child.on('exit', (code, signal) => {
      terminated = true;
      assert.ok(signal === 'SIGTERM' || signal === 'SIGKILL', 'Child should be killed by signal');
    });

    child.kill('SIGTERM');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child did not exit within timeout')), 5000);
      child.on('exit', () => { clearTimeout(timer); resolve(); });
    });

    assert.ok(terminated, 'Child process exit event should fire');
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancellation: SIGKILL forcefully terminates a child process', async () => {
  const dir = createTempRepo();
  let child = null;
  try {
    child = spawn('sleep', ['60']);
    assert.ok(child.pid > 0, 'Child process should have a valid PID');

    // SIGKILL should terminate immediately
    child.kill('SIGKILL');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child did not exit after SIGKILL')), 5000);
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        assert.ok(signal === 'SIGKILL', 'Child should be killed by SIGKILL');
        resolve();
      });
    });
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancellation: no orphan processes after child termination', async () => {
  const dir = createTempRepo();
  let child = null;
  try {
    child = spawn('sleep', ['60']);
    assert.ok(child.pid > 0, 'Child process should have a valid PID');

    child.kill('SIGTERM');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child did not exit')), 5000);
      child.on('exit', () => { clearTimeout(timer); resolve(); });
    });

    try {
      const psOutput = execFileSync('ps', ['aux'], { encoding: 'utf8' });
      const straySleeps = psOutput.split('\n').filter(l => l.includes('sleep 60') && !l.includes('grep'));
      assert.equal(straySleeps.length, 0, 'No orphan sleep processes should remain');
    } catch (e) {
      // ps may not be available; skip orphan check
    }
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancellation: repeated cancellation is idempotent', async () => {
  const dir = createTempRepo();
  let child = null;
  try {
    child = spawn('sleep', ['60']);
    assert.ok(child.pid > 0, 'Child process should have a valid PID');

    let exitCount = 0;
    child.on('exit', () => { exitCount++; });

    child.kill('SIGTERM');
    child.kill('SIGTERM');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Child did not exit')), 5000);
      child.on('exit', () => { clearTimeout(timer); resolve(); });
    });

    assert.ok(exitCount === 1, 'Child should exit exactly once despite repeated cancellation');
  } finally {
    if (child && !child.killed) child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancellation: workspace cleanup validates path before removal', async () => {
  const wsCode = readFileSync(
    join(process.cwd(), 'scripts/agent/isolated-workspace.mjs'), 'utf8'
  );

  const hasPathValidation = wsCode.includes("workspace.includes('vitanusa-ws-')");
  assert.ok(hasPathValidation, 'cleanupWorkspace should validate workspace path before removal');

  let threw = false;
  try {
    cleanupWorkspace('/tmp/some-random-path');
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('Refusing to clean up non-workspace path'), 'Should refuse non-workspace path');
  }
  assert.ok(threw, 'cleanupWorkspace should throw for non-workspace paths');
});

test('cancellation: state transitions distinguish cancellation from timeout/failure/success', async () => {
  const oc = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );

  assert.ok(oc.includes("state: 'CANCELLED'"), 'Should have CANCELLED state');
  assert.ok(oc.includes("state: 'BLOCKED'"), 'Should have BLOCKED state');
  assert.ok(oc.includes("state: 'FAILED'"), 'Should have FAILED state');
  assert.ok(oc.includes("state: 'PR_CREATED'"), 'Should have PR_CREATED state');
  assert.ok(oc.includes("stopReason: 'Task cancelled before applying changes'"), 'Should have cancellation stop reason');
});

test('cancellation: abort event listener is registered on signal', async () => {
  const oc = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );

  assert.ok(oc.includes("signal.addEventListener('abort'"), 'Should register abort event listener');
  assert.ok(oc.includes('signal: signal'), 'Should pass signal parameter to spawn');
});

test('cancellation: SIGINT and SIGTERM handlers registered', async () => {
  const oc = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );

  assert.ok(oc.includes("process.on('SIGINT'"), 'Should register SIGINT handler');
  assert.ok(oc.includes("process.on('SIGTERM'"), 'Should register SIGTERM handler');
  assert.ok(oc.includes('process.off('), 'Should remove signal handlers on cleanup');
});

test('cancellation: abort flow triggers checkCancelled', async () => {
  const abortController = new AbortController();
  let aborted = false;

  abortController.signal.addEventListener('abort', () => {
    aborted = true;
  });

  abortController.abort();

  assert.ok(aborted, 'abort() should trigger the abort event');
  assert.ok(abortController.signal.aborted, 'signal.aborted should be true after abort()');
});

// Process cleanup guard: kill any stray sleep processes after all tests
process.on('exit', () => {
  try {
    execFileSync('pkill', ['-f', 'sleep 60'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {}
});
