#!/usr/bin/env node
/**
 * VitaNusa AI - Benchmark Runner
 * Reproducible benchmark infrastructure for autonomous coding performance.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMetrics, recordTask, summarize } from './metrics.mjs';

export function createBenchmarkConfig(options = {}) {
  return {
    version: options.version || 'candidate',
    sha: options.sha || 'unknown',
    trials: options.trials || 1,
    timeout: options.timeout || 300000,
    repairLimit: options.repairLimit || 2,
    model: options.model || 'kilo/kilo-auto/free',
    workerCmd: options.workerCmd || 'kilo',
    tasks: options.tasks || [],
  };
}

export function validateBenchmarkConfig(config) {
  const errors = [];
  if (!config.version) errors.push('version required');
  if (!config.sha) errors.push('sha required');
  if (typeof config.trials !== 'number' || config.trials < 1) errors.push('trials must be positive number');
  if (typeof config.timeout !== 'number' || config.timeout <= 0) errors.push('timeout must be positive number');
  if (typeof config.repairLimit !== 'number' || config.repairLimit < 0) errors.push('repairLimit must be non-negative number');
  if (!Array.isArray(config.tasks)) errors.push('tasks must be array');
  return errors;
}

export function createTrialResult(trial) {
  return {
    trialId: trial.id,
    version: trial.version,
    sha: trial.sha,
    taskId: trial.taskId,
    startTime: trial.startTime,
    endTime: trial.endTime || null,
    duration: trial.endTime ? new Date(trial.endTime) - new Date(trial.startTime) : null,
    exitCode: trial.exitCode ?? null,
    state: trial.state || 'PENDING',
    testsPassed: trial.testsPassed || false,
    changedFiles: trial.changedFiles || [],
    repairAttempts: trial.repairAttempts || 0,
    policyViolations: trial.policyViolations || [],
    timeout: trial.timeout || false,
    error: trial.error || null,
  };
}

export function classifyFailure(result) {
  if (result.timeout) return 'TIMEOUT';
  if (result.policyViolations.length > 0) return 'POLICY_VIOLATION';
  if (result.exitCode !== 0 && result.exitCode !== null) return 'WORKER_FAILURE';
  if (!result.testsPassed) return 'TEST_FAILURE';
  if (result.state === 'BLOCKED') return 'BLOCKED';
  return 'UNKNOWN';
}

export function isSuccessful(result) {
  return result.state === 'PR_CREATED' || result.state === 'COMPLETED';
}

export function aggregateResults(results) {
  const total = results.length;
  const successful = results.filter(isSuccessful).length;
  const failed = total - successful;
  const timeouts = results.filter(r => r.timeout).length;
  const policyViolations = results.filter(r => r.policyViolations.length > 0).length;
  const durations = results.filter(r => r.duration !== null).map(r => r.duration);
  const medianDuration = durations.length > 0 ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] : null;
  const p95Duration = durations.length > 0 ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] : null;
  const totalRepairs = results.reduce((s, r) => s + r.repairAttempts, 0);
  return {
    totalTrials: total,
    successful,
    failed,
    successRate: total > 0 ? (successful / total * 100).toFixed(1) + '%' : 'N/A',
    timeouts,
    policyViolations,
    medianDurationMs: medianDuration,
    p95DurationMs: p95Duration,
    avgRepairs: total > 0 ? (totalRepairs / total).toFixed(2) : '0',
    totalRepairs,
  };
}

export function compareVersions(baseline, candidate) {
  const bAgg = aggregateResults(baseline);
  const cAgg = aggregateResults(candidate);
  const bRate = parseFloat(bAgg.successRate) || 0;
  const cRate = parseFloat(cAgg.successRate) || 0;
  const improvement = bRate > 0 ? (cRate / bRate).toFixed(2) + 'x' : 'N/A';
  return {
    baseline: bAgg,
    candidate: cAgg,
    improvementRatio: improvement,
    verdict: cRate >= bRate * 7 ? 'PASS — 7X IMPROVEMENT DEMONSTRATED' :
             cRate > bRate ? 'PASS — IMPROVEMENT MEASURED, BELOW 7X' :
             cRate === bRate ? 'INCONCLUSIVE — INSUFFICIENT BENCHMARK EVIDENCE' :
             'FAIL — REGRESSION OR SAFETY VIOLATION',
  };
}

export function generateReport(comparison, config) {
  return {
    timestamp: new Date().toISOString(),
    baselineSha: config.baselineSha,
    candidateSha: config.candidateSha,
    protocol: 'Disposable fixture, real worker execution, independent test verification',
    comparison,
    limitations: [
      'Sample size may be insufficient for statistical significance',
      'Real worker depends on LLM provider availability',
      'Cost data not available from provider',
    ],
  };
}
