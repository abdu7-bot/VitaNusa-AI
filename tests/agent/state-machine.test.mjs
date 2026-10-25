import test from 'node:test';
import assert from 'node:assert/strict';
import { TASK_STATES, isValidTransition, transition, isTerminal, canRetry, classifyFailure } from '../../scripts/agent/state-machine.mjs';

test('state: valid transitions allowed', () => {
  assert.equal(isValidTransition('QUEUED', 'PLANNING'), true);
  assert.equal(isValidTransition('RUNNING', 'VERIFYING'), true);
  assert.equal(isValidTransition('VERIFYING', 'SUCCEEDED'), true);
});

test('state: invalid transitions rejected', () => {
  assert.equal(isValidTransition('RUNNING', 'SUCCEEDED'), false);
  assert.equal(isValidTransition('SUCCEEDED', 'RUNNING'), false);
  assert.equal(isValidTransition('CANCELLED', 'RUNNING'), false);
});

test('state: transition records history', () => {
  const t = { state: 'QUEUED', stateHistory: [] };
  transition(t, 'PLANNING', 'start');
  assert.equal(t.state, 'PLANNING');
  assert.equal(t.stateHistory.length, 1);
  assert.equal(t.stateHistory[0].from, 'QUEUED');
  assert.equal(t.stateHistory[0].to, 'PLANNING');
});

test('state: invalid transition throws', () => {
  const t = { state: 'QUEUED', stateHistory: [] };
  assert.throws(() => transition(t, 'SUCCEEDED'), /Invalid state transition/i);
});

test('state: terminal states identified', () => {
  assert.equal(isTerminal('SUCCEEDED'), true);
  assert.equal(isTerminal('FAILED'), true);
  assert.equal(isTerminal('CANCELLED'), true);
  assert.equal(isTerminal('RUNNING'), false);
});

test('state: retry allowed for failed/blocked', () => {
  assert.equal(canRetry('FAILED'), true);
  assert.equal(canRetry('BLOCKED'), true);
  assert.equal(canRetry('SUCCEEDED'), false);
});

test('state: classifyFailure detects timeout', () => {
  assert.equal(classifyFailure('timed out', 124), 'TIMEOUT');
  assert.equal(classifyFailure('killed', 137), 'TIMEOUT');
});

test('state: classifyFailure detects policy denial', () => {
  assert.equal(classifyFailure('policy violation', 1), 'POLICY_DENIAL');
});

test('state: classifyFailure detects infrastructure', () => {
  assert.equal(classifyFailure('no such file', null), 'INFRASTRUCTURE');
});

test('state: BLOCKED and FAILED are terminal but retryable', () => {
  assert.equal(isTerminal('BLOCKED'), true, 'BLOCKED should be terminal');
  assert.equal(isTerminal('FAILED'), true, 'FAILED should be terminal');
  assert.equal(canRetry('BLOCKED'), true, 'BLOCKED should be retryable');
  assert.equal(canRetry('FAILED'), true, 'FAILED should be retryable');
});

test('state: CANCELLED is terminal but not retryable', () => {
  assert.equal(isTerminal('CANCELLED'), true, 'CANCELLED should be terminal');
  assert.equal(canRetry('CANCELLED'), false, 'CANCELLED should not be retryable');
});

test('state: RUNNING is not terminal', () => {
  assert.equal(isTerminal('RUNNING'), false, 'RUNNING should not be terminal');
  assert.equal(canRetry('RUNNING'), false, 'RUNNING should not be retryable');
});

test('state: VERIFYING is not terminal', () => {
  assert.equal(isTerminal('VERIFYING'), false, 'VERIFYING should not be terminal');
  assert.equal(canRetry('VERIFYING'), false, 'VERIFYING should not be retryable');
});

test('state: REPAIRING is not terminal', () => {
  assert.equal(isTerminal('REPAIRING'), false, 'REPAIRING should not be terminal');
  assert.equal(canRetry('REPAIRING'), false, 'REPAIRING should not be retryable');
});

test('state: transition preserves history chain', () => {
  const t = { state: 'PLANNING', stateHistory: [] };
  transition(t, 'READY', 'task selected');
  transition(t, 'CLAIMED', 'worker claimed');
  transition(t, 'RUNNING', 'worker started');
  transition(t, 'VERIFYING', 'tests passed');
  transition(t, 'SUCCEEDED', 'PR created');
  
  assert.equal(t.state, 'SUCCEEDED');
  assert.equal(t.stateHistory.length, 5);
  assert.equal(t.stateHistory[0].from, 'PLANNING');
  assert.equal(t.stateHistory[0].to, 'READY');
  assert.equal(t.stateHistory[4].from, 'VERIFYING');
  assert.equal(t.stateHistory[4].to, 'SUCCEEDED');
});

test('state: invalid transition from SUCCEEDED throws', () => {
  const t = { state: 'SUCCEEDED', stateHistory: [] };
  assert.throws(() => transition(t, 'RUNNING', 'restart'), /Invalid state transition/);
});

test('state: transition from BLOCKED to QUEUED is valid', () => {
  assert.equal(isValidTransition('BLOCKED', 'QUEUED'), true, 'BLOCKED should be able to go to QUEUED for retry');
});

test('state: transition from FAILED to QUEUED is valid', () => {
  assert.equal(isValidTransition('FAILED', 'QUEUED'), true, 'FAILED should be able to go to QUEUED for retry');
});

test('state: transition from RUNNING to PR_CREATED directly is invalid', () => {
  assert.equal(isValidTransition('RUNNING', 'PR_CREATED'), false, 'RUNNING cannot go directly to PR_CREATED');
  assert.equal(isValidTransition('RUNNING', 'SUCCEEDED'), false, 'RUNNING cannot go directly to SUCCEEDED');
});

test('state: transition from CLAIMED to PR_CREATED directly is invalid', () => {
  assert.equal(isValidTransition('CLAIMED', 'PR_CREATED'), false, 'CLAIMED cannot go directly to PR_CREATED');
  assert.equal(isValidTransition('CLAIMED', 'SUCCEEDED'), false, 'CLAIMED cannot go directly to SUCCEEDED');
});

test('state: valid path CLAIMED → RUNNING → VERIFYING → SUCCEEDED', () => {
  assert.equal(isValidTransition('CLAIMED', 'RUNNING'), true);
  assert.equal(isValidTransition('RUNNING', 'VERIFYING'), true);
  assert.equal(isValidTransition('VERIFYING', 'SUCCEEDED'), true);
});

test('state: valid path CLAIMED → RUNNING → REPAIRING → VERIFYING → SUCCEEDED', () => {
  assert.equal(isValidTransition('CLAIMED', 'RUNNING'), true);
  assert.equal(isValidTransition('RUNNING', 'REPAIRING'), true);
  assert.equal(isValidTransition('REPAIRING', 'VERIFYING'), true);
  assert.equal(isValidTransition('VERIFYING', 'SUCCEEDED'), true);
});
