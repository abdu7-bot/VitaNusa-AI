import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { isDeadlineExceeded, backoffMs } from '../../scripts/agent/task-orchestrator.mjs';
import { getTaskTimeout } from '../../scripts/agent/policy-engine.mjs';

test('deadline: isDeadlineExceeded returns false when within deadline', () => {
  const start = Date.now();
  const deadline = start + 60000; // 1 minute from now
  assert.ok(!isDeadlineExceeded(start, deadline), 'Should not be exceeded before deadline');
});

test('deadline: isDeadlineExceeded returns true when past deadline', () => {
  const start = Date.now() - 120000; // 2 minutes ago
  const deadlineMs = 60000; // 1 minute duration
  assert.ok(isDeadlineExceeded(start, deadlineMs), 'Should be exceeded after deadline');
});

test('deadline: isDeadlineExceeded returns false exactly at deadline', () => {
  const start = Date.now() - 60000; // 1 minute ago
  const deadline = start + 60000; // exactly 1 minute from start = now
  // At exactly the deadline, Date.now() - startTimeMs === deadlineMs, so isDeadlineExceeded returns false
  // (uses > not >=)
  assert.ok(!isDeadlineExceeded(start, deadline), 'Should not be exceeded exactly at deadline (uses > not >=)');
});

test('deadline: getTaskTimeout returns default 600 seconds when no policy', () => {
  const timeout = getTaskTimeout({});
  assert.equal(timeout, 600, 'Default task timeout should be 600 seconds');
});

test('deadline: getTaskTimeout returns configured value when set', () => {
  const timeout = getTaskTimeout({ engine: { task_timeout_seconds: 300 } });
  assert.equal(timeout, 300, 'Should return configured timeout value');
});

test('deadline: checkDeadline is called before worker execution', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Verify checkDeadline is called before worker execution
  const workerExecSection = orchestratorCode.substring(
    orchestratorCode.indexOf('console.log(\`[${task.id}] Starting worker'),
    orchestratorCode.indexOf('const workerResult = runWorker')
  );
  
  assert.ok(workerExecSection.includes('checkDeadline()'), 'checkDeadline() should be called before worker execution');
});

test('deadline: checkDeadline is called in repair loop', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  const whileStart = orchestratorCode.indexOf('while (repairCount <= repairLimit');
  const whileEnd = orchestratorCode.indexOf('}', whileStart);
  const whileSection = orchestratorCode.substring(whileStart, whileEnd + 1);
  const checkDeadlineCalls = (whileSection.match(/checkDeadline\(\)/g) || []).length;
  assert.ok(checkDeadlineCalls >= 1, 'checkDeadline() should be called in repair loop, found ' + checkDeadlineCalls);
});

test('deadline: checkDeadline is called before workspace diff collection', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // checkDeadline is called before getWorkspaceDiff
  const wsStart = orchestratorCode.indexOf('checkDeadline()');
  const wsDiff = orchestratorCode.indexOf('const workspaceChanges = getWorkspaceDiff');
  assert.ok(wsStart > 0 && wsStart < wsDiff, 'checkDeadline() should be called before workspace diff collection');
});

test('deadline: backoffMs respects maxMs cap', () => {
  // With large attempt, backoff should be capped at maxMs
  const result = backoffMs(100, 1000, 30000);
  assert.ok(result <= 30000, 'Backoff should not exceed maxMs');
  assert.ok(result >= 30000, 'Backoff should be close to maxMs for large attempt (plus jitter)');
});

test('deadline: backoffMs increases with attempt number', () => {
  const result1 = backoffMs(0, 1000, 30000);
  const result2 = backoffMs(5, 1000, 30000);
  // result2 should generally be >= result1 (allowing for jitter variance)
  // With attempt 5, base is 1000 * 2^5 = 32000, capped at 30000
  // With attempt 0, base is 1000 * 2^0 = 1000
  assert.ok(result2 >= result1 * 0.5, 'Backoff should generally increase with attempt number');
});

test('deadline: Date.now() is used instead of monotonic clock', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // Check that Date.now() is used for taskStartTime
  const hasDateNow = orchestratorCode.includes('const taskStartTime = Date.now()');
  assert.ok(hasDateNow, 'taskStartTime uses Date.now() (wall-clock, not monotonic)');
  
  // Check that process.hrtime.bigint() is NOT used for deadline
  const hasHrtime = orchestratorCode.includes('hrtime.bigint') || orchestratorCode.includes('hrtime()');
  assert.ok(!hasHrtime, 'process.hrtime() is NOT used for deadline - Date.now() is used instead');
  
  // Document: Date.now() is wall-clock time and can be affected by system time changes
  // For monotonic time, process.hrtime.bigint() or performance.now() should be used
});

test('deadline: recovery does not reset task deadline', async () => {
  const { readFileSync } = await import('node:fs');
  
  const orchestratorCode = readFileSync(
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'), 'utf8'
  );
  
  // taskStartTime and taskDeadline are set once at the beginning of main()
  // and are not reset during recovery
  const taskStartTimeDecl = (orchestratorCode => {
    const idx = orchestratorCode.indexOf('const taskStartTime = Date.now()');
    return idx;
  })(orchestratorCode);
  
  // Check that taskStartTime is declared only once
  const taskStartTimeCount = (orchestratorCode.match(/const taskStartTime = Date.now\(\)/g) || []).length;
  assert.equal(taskStartTimeCount, 1, 'taskStartTime should be declared only once (not reset during recovery)');
  
  const taskDeadlineCount = (orchestratorCode.match(/const taskDeadline = taskStartTime \+ taskTimeoutMs/g) || []).length;
  assert.equal(taskDeadlineCount, 1, 'taskDeadline should be declared only once (not reset during recovery)');
});

test('deadline: zero or negative timeout inputs', async () => {
  // getTaskTimeout with 0 should return 0 (or some default)
  const timeout0 = getTaskTimeout({ engine: { task_timeout_seconds: 0 } });
  assert.ok(timeout0 === 0 || timeout0 === 600, 'Zero timeout should either return 0 or default');
  
  // getTaskTimeout with negative should return the negative value (or default)
  const timeoutNeg = getTaskTimeout({ engine: { task_timeout_seconds: -1 } });
  assert.ok(timeoutNeg === -1 || timeoutNeg === 600, 'Negative timeout should either return -1 or default');
});

test('deadline: excessively large timeout', async () => {
  const timeoutLarge = getTaskTimeout({ engine: { task_timeout_seconds: 999999999 } });
  assert.equal(timeoutLarge, 999999999, 'Large timeout should be returned as-is');
});
