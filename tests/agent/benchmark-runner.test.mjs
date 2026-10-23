import test from 'node:test';
import assert from 'node:assert/strict';
import { createBenchmarkConfig, validateBenchmarkConfig, createTrialResult, classifyFailure, isSuccessful, aggregateResults, compareVersions } from '../../scripts/agent/benchmark-runner.mjs';

test('benchmark: config validation rejects invalid', () => {
  const errors = validateBenchmarkConfig({ version: '', sha: '', trials: 0, timeout: -1, repairLimit: -1, tasks: 'bad' });
  assert.ok(errors.length > 0);
});

test('benchmark: config validation accepts valid', () => {
  const config = createBenchmarkConfig({ version: 'v1', sha: 'abc123', trials: 3, timeout: 300000, repairLimit: 2, tasks: [] });
  const errors = validateBenchmarkConfig(config);
  assert.equal(errors.length, 0);
});

test('benchmark: successful result classification', () => {
  const r = createTrialResult({ id: 't1', version: 'v1', sha: 'abc', taskId: 'T1', startTime: new Date().toISOString(), state: 'PR_CREATED', testsPassed: true });
  assert.equal(isSuccessful(r), true);
});

test('benchmark: failed result not successful', () => {
  const r = createTrialResult({ id: 't1', version: 'v1', sha: 'abc', taskId: 'T1', startTime: new Date().toISOString(), state: 'BLOCKED', testsPassed: false });
  assert.equal(isSuccessful(r), false);
});

test('benchmark: classifyFailure detects timeout', () => {
  const r = createTrialResult({ id: 't1', version: 'v1', sha: 'abc', taskId: 'T1', startTime: new Date().toISOString(), timeout: true });
  assert.equal(classifyFailure(r), 'TIMEOUT');
});

test('benchmark: classifyFailure detects policy violation', () => {
  const r = createTrialResult({ id: 't1', version: 'v1', sha: 'abc', taskId: 'T1', startTime: new Date().toISOString(), policyViolations: ['unauthorized'] });
  assert.equal(classifyFailure(r), 'POLICY_VIOLATION');
});

test('benchmark: aggregateResults computes metrics', () => {
  const r1 = createTrialResult({ id: 't1', version: 'v1', sha: 'abc', taskId: 'T1', startTime: new Date().toISOString(), state: 'PR_CREATED', testsPassed: true, duration: 1000 });
  const r2 = createTrialResult({ id: 't2', version: 'v1', sha: 'abc', taskId: 'T2', startTime: new Date().toISOString(), state: 'FAILED', testsPassed: false, duration: 2000 });
  const agg = aggregateResults([r1, r2]);
  assert.equal(agg.totalTrials, 2);
  assert.equal(agg.successful, 1);
  assert.equal(agg.successRate, '50.0%');
});

test('benchmark: compareVersions computes improvement', () => {
  const b = [createTrialResult({ id: 'b1', version: 'base', sha: 'b', taskId: 'T1', startTime: new Date().toISOString(), state: 'PR_CREATED', testsPassed: true })];
  const c = [createTrialResult({ id: 'c1', version: 'cand', sha: 'c', taskId: 'T1', startTime: new Date().toISOString(), state: 'PR_CREATED', testsPassed: true })];
  const comp = compareVersions(b, c);
  assert.ok(comp.improvementRatio);
  assert.ok(comp.verdict);
});
