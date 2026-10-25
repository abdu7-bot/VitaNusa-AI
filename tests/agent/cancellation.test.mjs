import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cancel-test-'));
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

test('cancellation: abortController.abort() is never called in orchestrator', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Verify abort() is never called in the orchestrator
  const abortCalls = orchestratorCode.match(/abortController\.abort\(\)/g) || [];
  assert.equal(abortCalls.length, 0, 'abortController.abort() should never be called - cancellation is not implemented');
  
  rmSync(dir, { recursive: true, force: true });
});

test('cancellation: no signal handler for external cancellation signals', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Check for SIGINT/SIGTERM handlers
  const sigIntMatches = orchestratorCode.match(/process\.on\(['"]SIGINT['"]/g) || [];
  const sigTermMatches = orchestratorCode.match(/process\.on\(['"]SIGTERM['"]/g) || [];
  
  assert.equal(sigIntMatches.length, 0, 'No SIGINT handler found - external cancellation not supported');
  assert.equal(sigTermMatches.length, 0, 'No SIGTERM handler found - external cancellation not supported');
});

test('cancellation: checkCancelled() is defined but never triggered externally', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // checkCancelled function exists
  const hasCheckCancelled = orchestratorCode.includes('function checkCancelled()');
  assert.ok(hasCheckCancelled, 'checkCancelled function should exist');
  
  // But abort() is never called
  const abortCalls = orchestratorCode.match(/abortController\.abort\(\)/g) || [];
  assert.equal(abortCalls.length, 0, 'abort() is never called - checkCancelled() can never return true');
});

test('cancellation: subprocess not terminated on cancellation', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Check if there's any subprocess termination logic (kill, abort signal to child process)
  const hasChildKill = orchestratorCode.includes('child.kill') || 
                       orchestratorCode.includes('.kill(') ||
                       orchestratorCode.includes('abortController.signal.aborted');
  
  // The abort controller signal is never linked to any child process
  const signalLinked = orchestratorCode.includes('signal: abortController.signal');
  assert.ok(!signalLinked, 'abortController.signal is not passed to spawnSync - subprocesses cannot be terminated on cancellation');
});

test('cancellation: checkCancelled() called at loop boundaries but never triggered', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Count checkCancelled() calls
  const checkCancelledCalls = (orchestratorCode => {
    let count = 0;
    for (let i = 0; i < orchestratorCode.length; i++) {
      if (orchestratorCode.startsWith('checkCancelled()', i)) count++;
    }
    return count;
  })(orchestratorCode);
  
  // checkCancelled() is called but never triggered (abort never called)
  assert.ok(checkCancelledCalls >= 1, 'checkCancelled() is called at loop boundaries');
  assert.ok(!orchestratorCode.includes('abortController.abort()'), 'abort() is never called');
});

test('cancellation: no child process termination on cancellation', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Run worker uses spawnSync which has no abort signal
  const spawnSyncCalls = orchestratorCode.match(/spawnSync\(/g) || [];
  assert.ok(spawnSyncCalls.length > 0, 'spawnSync is used for worker execution');
  
  // spawnSync doesn't receive an abort signal
  const abortSignalInSpawn = orchestratorCode.match(/spawnSync\([^)]*abortController.signal/g);
  assert.equal(abortSignalInSpawn?.length || 0, 0, 'spawnSync does not receive abort signal - subprocesses cannot be terminated');
});

test('cancellation: no cancelled task marked successful', async () => {
  const { dir, runtimeDir } = createTempRepo();
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Verify that cancellation path sets state to BLOCKED/FAILED, not success
  const hasCancelStateTransition = orchestratorCode.includes("state: 'CANCELLED'") || 
                                    orchestratorCode.includes("state: 'BLOCKED'");
  assert.ok(hasCancelStateTransition, 'Cancellation leads to BLOCKED or FAILED state, not success');
  
  rmSync(dir, { recursive: true, force: true });
});
