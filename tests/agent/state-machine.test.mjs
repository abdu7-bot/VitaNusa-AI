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
