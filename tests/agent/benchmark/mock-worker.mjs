/**
 * VitaNusa AI - Mock Worker for Benchmark Harness
 * Deterministic test double that simulates worker behavior.
 * NOT a real LLM - uses predefined scripts for repeatable testing.
 */

import { mkdirSync, writeFileSync } from 'node:fs';

function createMockWorker(scenario) {
  const scenarios = {
    success: createSuccessScenario,
    incorrectOutput: createIncorrectOutputScenario,
    malformedResponse: createMalformedResponseScenario,
    timeout: createTimeoutScenario,
    crashAfterClaim: createCrashAfterClaimScenario,
    crashDuringCheckpoint: createCrashDuringCheckpointScenario,
    retryableError: createRetryableErrorScenario,
    nonRetryableError: createNonRetryableErrorScenario,
    duplicateTask: createDuplicateTaskScenario,
    concurrentClaim: createConcurrentClaimScenario,
    promptInjection: createPromptInjectionScenario,
    credentialLeak: createCredentialLeakScenario,
    unauthorizedPath: createUnauthorizedPathScenario,
    partialModification: createPartialModificationScenario,
  };

  if (!scenarios[scenario]) {
    throw new Error(`Unknown mock worker scenario: ${scenario}`);
  }

  return scenarios[scenario]();
}

function createSuccessScenario() {
  return {
    name: 'success',
    description: 'Worker successfully completes a coding task',
    taskId: 'T-BENCH-001',
    workerCommand: ['node', '--check'],
    expectedState: 'PR_CREATED',
    expectedTestsPassed: true,
    expectedChangedFiles: ['src/hello.mjs'],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => {
      // Create a baseline file for the worker to modify
      return { files: [] };
    },
    execute: async (paths) => {
      // Simulate successful implementation
      mkdirSync(`${paths.RUNTIME_DIR}/src`, { recursive: true });
      writeFileSync(`${paths.RUNTIME_DIR}/src/hello.mjs`, 'export function hello() { return "hello"; }\\n');
      writeFileSync(`${paths.RUNTIME_DIR}/src/hello.test.mjs`, 'import { test } from "node:test"; import assert from "node:assert/strict"; test("hello works", () => { assert.equal(hello(), "hello"); });\\n');
      return { success: true, changedFiles: ['src/hello.mjs', 'src/hello.test.mjs'] };
    },
    validate: (result) => {
      return result.success === true &&
             result.state === 'PR_CREATED' &&
             result.testsPassed === true &&
             result.repairAttempts === 0 &&
             result.timeout === false;
    },
  };
}

function createIncorrectOutputScenario() {
  return {
    name: 'incorrectOutput',
    description: 'Worker produces output that fails acceptance tests',
    taskId: 'T-BENCH-002',
    workerCommand: ['node', '--check'],
    expectedState: 'FAILED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'implementation does not meet acceptance criteria' }),
    validate: (result) => result.state === 'FAILED' && result.testsPassed === false,
  };
}

function createMalformedResponseScenario() {
  return {
    name: 'malformedResponse',
    description: 'Worker produces invalid structured output',
    taskId: 'T-BENCH-003',
    workerCommand: ['node', '--check'],
    expectedState: 'FAILED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'invalid JSON output from worker' }),
    validate: (result) => result.state === 'FAILED' && result.testsPassed === false,
  };
}

function createTimeoutScenario() {
  return {
    name: 'timeout',
    description: 'Worker exceeds time limit',
    taskId: 'T-BENCH-004',
    workerCommand: ['node', '--check'],
    expectedState: 'BLOCKED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: true,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'worker timeout', timeout: true }),
    validate: (result) => result.timeout === true && result.state === 'BLOCKED',
  };
}

function createCrashAfterClaimScenario() {
  return {
    name: 'crashAfterClaim',
    description: 'Worker claims task then exits unexpectedly',
    taskId: 'T-BENCH-005',
    workerCommand: ['node', '--check'],
    expectedState: 'BLOCKED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'worker crashed after claim' }),
    validate: (result) => result.state === 'BLOCKED' && result.testsPassed === false,
  };
}

function createCrashDuringCheckpointScenario() {
  return {
    name: 'crashDuringCheckpoint',
    description: 'Worker crashes during checkpoint persistence',
    taskId: 'T-BENCH-006',
    workerCommand: ['node', '--check'],
    expectedState: 'FAILED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'checkpoint write failed' }),
    validate: (result) => result.state === 'FAILED' && result.testsPassed === false,
  };
}

function createRetryableErrorScenario() {
  return {
    name: 'retryableError',
    description: 'Worker recovers from retryable error',
    taskId: 'T-BENCH-007',
    workerCommand: ['node', '--check'],
    expectedState: 'PR_CREATED',
    expectedTestsPassed: true,
    expectedChangedFiles: ['src/retry.mjs'],
    expectedRepairAttempts: 1,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => {
      mkdirSync(`${paths.RUNTIME_DIR}/src`, { recursive: true });
      writeFileSync(`${paths.RUNTIME_DIR}/src/retry.mjs`, 'export function retry() { return "ok"; }\\n');
      return { success: true, changedFiles: ['src/retry.mjs'], repairAttempts: 1 };
    },
    validate: (result) => result.state === 'PR_CREATED' && result.repairAttempts >= 1,
  };
}

function createNonRetryableErrorScenario() {
  return {
    name: 'nonRetryableError',
    description: 'Worker encounters non-retryable error',
    taskId: 'T-BENCH-008',
    workerCommand: ['node', '--check'],
    expectedState: 'FAILED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'non-retryable error' }),
    validate: (result) => result.state === 'FAILED' && result.testsPassed === false,
  };
}

function createDuplicateTaskScenario() {
  return {
    name: 'duplicateTask',
    description: 'Same task submitted twice - second should be rejected',
    taskId: 'T-BENCH-009',
    workerCommand: ['node', '--check'],
    expectedState: 'PR_CREATED',
    expectedTestsPassed: true,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: true, changedFiles: [], duplicateDetected: true }),
    validate: (result) => result.state === 'PR_CREATED',
  };
}

function createConcurrentClaimScenario() {
  return {
    name: 'concurrentClaim',
    description: 'Two workers claim same task - only one succeeds',
    taskId: 'T-BENCH-010',
    workerCommand: ['node', '--check'],
    expectedState: 'PR_CREATED',
    expectedTestsPassed: true,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: true, changedFiles: [], concurrentClaim: true }),
    validate: (result) => result.state === 'PR_CREATED',
  };
}

function createPromptInjectionScenario() {
  return {
    name: 'promptInjection',
    description: 'Malicious instructions embedded in task content',
    taskId: 'T-BENCH-011',
    workerCommand: ['node', '--check'],
    expectedState: 'BLOCKED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'policy violation: unauthorized action detected' }),
    validate: (result) => result.state === 'BLOCKED' || result.policyViolations.length > 0,
  };
}

function createCredentialLeakScenario() {
  return {
    name: 'credentialLeak',
    description: 'Worker attempts to expose credentials',
    taskId: 'T-BENCH-012',
    workerCommand: ['node', '--check'],
    expectedState: 'BLOCKED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'credential exposure detected', policyViolations: ['secret_exposure'] }),
    validate: (result) => result.state === 'BLOCKED' || result.policyViolations.some(v => v.includes('secret')),
  };
}

function createUnauthorizedPathScenario() {
  return {
    name: 'unauthorizedPath',
    description: 'Worker attempts to modify files outside allowed scope',
    taskId: 'T-BENCH-013',
    workerCommand: ['node', '--check'],
    expectedState: 'BLOCKED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'unauthorized path access', policyViolations: ['scope_violation'] }),
    validate: (result) => result.state === 'BLOCKED' || result.policyViolations.some(v => v.includes('scope')),
  };
}

function createPartialModificationScenario() {
  return {
    name: 'partialModification',
    description: 'Worker partially modifies files then fails',
    taskId: 'T-BENCH-014',
    workerCommand: ['node', '--check'],
    expectedState: 'FAILED',
    expectedTestsPassed: false,
    expectedChangedFiles: [],
    expectedRepairAttempts: 0,
    expectedTimeout: false,
    setup: async () => ({ files: [] }),
    execute: async () => ({ success: false, changedFiles: [], reason: 'partial modification before failure' }),
    validate: (result) => result.state === 'FAILED' && result.testsPassed === false,
  };
}

export const BENCHMARK_SCENARIOS = Object.values(createMockWorker('success')).length > 0
  ? [
      { id: 'T-BENCH-001', name: 'success', scenario: 'success' },
      { id: 'T-BENCH-002', name: 'incorrectOutput', scenario: 'incorrectOutput' },
      { id: 'T-BENCH-003', name: 'malformedResponse', scenario: 'malformedResponse' },
      { id: 'T-BENCH-004', name: 'timeout', scenario: 'timeout' },
      { id: 'T-BENCH-005', name: 'crashAfterClaim', scenario: 'crashAfterClaim' },
      { id: 'T-BENCH-006', name: 'crashDuringCheckpoint', scenario: 'crashDuringCheckpoint' },
      { id: 'T-BENCH-007', name: 'retryableError', scenario: 'retryableError' },
      { id: 'T-BENCH-008', name: 'nonRetryableError', scenario: 'nonRetryableError' },
      { id: 'T-BENCH-009', name: 'duplicateTask', scenario: 'duplicateTask' },
      { id: 'T-BENCH-010', name: 'concurrentClaim', scenario: 'concurrentClaim' },
      { id: 'T-BENCH-011', name: 'promptInjection', scenario: 'promptInjection' },
      { id: 'T-BENCH-012', name: 'credentialLeak', scenario: 'credentialLeak' },
      { id: 'T-BENCH-013', name: 'unauthorizedPath', scenario: 'unauthorizedPath' },
      { id: 'T-BENCH-014', name: 'partialModification', scenario: 'partialModification' },
    ]
  : [];

export { createMockWorker };
