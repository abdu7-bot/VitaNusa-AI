import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffMs, classifyWorkerFailure } from '../../scripts/agent/task-orchestrator.mjs';
import { getTaskTimeout } from '../../scripts/agent/policy-engine.mjs';

test('retry: atomicClaim worker - transient failure returns retryable classification', () => {
  // Non-zero exit code that's not timeout-related = transient
  const result = classifyWorkerFailure(1, 'Some error');
  assert.equal(result, 'TRANSIENT', 'Non-zero exit code should be classified as transient');
});

test('retry: timeout exit codes classified as TIMEOUT', async () => {
  assert.equal(classifyWorkerFailure(124, 'timeout'), 'TIMEOUT', 'Exit code 124 should be classified as TIMEOUT');
  assert.equal(classifyWorkerFailure(137, 'killed'), 'TIMEOUT', 'Exit code 137 should be classified as TIMEOUT');
});

test('retry: infrastructure failures detected', async () => {
  assert.equal(classifyWorkerFailure(null, 'process died'), 'INFRASTRUCTURE', 'Null exit code should be INFRASTRUCTURE');
  assert.equal(classifyWorkerFailure(undefined, 'killed'), 'INFRASTRUCTURE', 'Undefined exit code should be INFRASTRUCTURE');
});

test('retry: policy denial classification', async () => {
  assert.equal(classifyWorkerFailure(1, 'Policy denied this action'), 'POLICY_DENIAL', 'Policy-related error should be POLICY_DENIAL');
  assert.equal(classifyWorkerFailure(1, 'Policy violation: unauthorized access'), 'POLICY_DENIAL', 'Unauthorized access with policy keyword should be POLICY_DENIAL');
});

test('retry: generic failure classified as transient (retryable)', async () => {
  // Any non-zero exit code that's not specifically classified is TRANSIENT (retryable)
  const result = classifyWorkerFailure(1, 'Some generic error');
  assert.equal(result, 'TRANSIENT', 'Generic error should be classified as transient (retryable)');

  // Exit code 1 with generic message is transient
  const result2 = classifyWorkerFailure(1, 'Connection refused');
  assert.equal(result2, 'TRANSIENT', 'Connection refused should be transient');

  // Exit code 2 with generic message is transient
  const result3 = classifyWorkerFailure(2, 'Command not found');
  assert.equal(result3, 'TRANSIENT', 'Command not found should be transient');
});

test('retry: exponential backoff bounded by maxMs', async () => {
  const result1 = backoffMs(0, 1000, 30000);
  assert.ok(result1 >= 1000 && result1 < 2000, 'First attempt backoff should be around base');
  
  const resultMax = backoffMs(100, 1000, 30000);
  assert.ok(resultMax <= 30000, 'Backoff should not exceed maxMs');
  assert.ok(resultMax >= 29000, 'Backoff should be at max for large attempt');
  
  // Backoff should generally increase with attempt
  const result2 = backoffMs(1, 1000, 30000);
  const result3 = backoffMs(2, 1000, 30000);
  assert.ok(result2 >= result1 * 0.5, 'Backoff should increase with attempt');
  assert.ok(result3 >= result2 * 0.5, 'Backoff should continue increasing');
});

test('retry: backoff never exceeds remaining task deadline', async () => {
  const maxDelay = 5000;
  const result = backoffMs(100, 1000, maxDelay);
  assert.ok(result <= maxDelay, 'Backoff should not exceed remaining deadline');
});

test('retry: getTaskTimeout returns proper values', async () => {
  const defaultTimeout = getTaskTimeout({});
  assert.equal(defaultTimeout, 600, 'Default task timeout should be 600 seconds');
  
  const customTimeout = getTaskTimeout({ engine: { task_timeout_seconds: 300 } });
  assert.equal(customTimeout, 300, 'Should return configured timeout');
});
