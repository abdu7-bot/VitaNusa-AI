#!/usr/bin/env node
/**
 * VitaNusa AI - Task State Machine
 * Validates and tracks task state transitions.
 */

export const TASK_STATES = {
  QUEUED: 'QUEUED',
  PLANNING: 'PLANNING',
  READY: 'READY',
  CLAIMED: 'CLAIMED',
  RUNNING: 'RUNNING',
  VERIFYING: 'VERIFYING',
  REPAIRING: 'REPAIRING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  BLOCKED: 'BLOCKED',
};

const VALID_TRANSITIONS = {
  QUEUED: new Set(['PLANNING', 'CANCELLED', 'BLOCKED']),
  PLANNING: new Set(['READY', 'FAILED', 'CANCELLED', 'BLOCKED']),
  READY: new Set(['CLAIMED', 'CANCELLED', 'BLOCKED']),
  CLAIMED: new Set(['RUNNING', 'CANCELLED', 'BLOCKED']),
  RUNNING: new Set(['VERIFYING', 'FAILED', 'CANCELLED', 'BLOCKED', 'REPAIRING']),
  VERIFYING: new Set(['SUCCEEDED', 'REPAIRING', 'FAILED', 'CANCELLED', 'BLOCKED']),
  REPAIRING: new Set(['VERIFYING', 'FAILED', 'CANCELLED', 'BLOCKED']),
  SUCCEEDED: new Set([]),  // terminal
  FAILED: new Set(['QUEUED']),  // can retry
  CANCELLED: new Set([]),  // terminal
  BLOCKED: new Set(['QUEUED']),  // can retry after fix
};

export function isValidTransition(from, to) {
  if (!TASK_STATES[from] || !TASK_STATES[to]) return false;
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

export function transition(task, to, reason = '') {
  if (!isValidTransition(task.state, to)) {
    throw new Error(`Invalid state transition: ${task.state} -> ${to}${reason ? ' (' + reason + ')' : ''}`);
  }
  const prev = task.state;
  task.state = to;
  task.stateHistory = task.stateHistory || [];
  task.stateHistory.push({ from: prev, to, reason, timestamp: new Date().toISOString() });
  return task;
}

export function isTerminal(state) {
  return state === 'SUCCEEDED' || state === 'CANCELLED' || state === 'FAILED' || state === 'BLOCKED';
}

export function canRetry(state) {
  return state === 'FAILED' || state === 'BLOCKED';
}

export function classifyFailure(error, exitCode) {
  if (exitCode === null || exitCode === undefined) return 'INFRASTRUCTURE';
  if (exitCode === 124 || exitCode === 137) return 'TIMEOUT';
  if (exitCode === 1 && /policy/i.test(String(error))) return 'POLICY_DENIAL';
  if (exitCode !== 0) return 'TRANSIENT';
  return 'PERMANENT';
}
