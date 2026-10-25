#!/usr/bin/env node
/**
 * VitaNusa AI - Metrics & Evidence Tracker
 * Tracks task execution metrics for baseline comparison.
 */

export function createMetrics() {
  return {
    tasks: [],
    startTime: new Date().toISOString(),
  };
}

export function recordTask(metrics, task) {
  metrics.tasks.push({
    taskId: task.taskId,
    state: task.state,
    baseCommit: task.baseCommit,
    headCommit: task.headCommit,
    duration: task.duration || null,
    exitCode: task.exitCode || null,
    repairAttempts: (task.repairs || []).length,
    testsPassed: (task.tests || []).every(t => t.exitCode === 0),
    changedFiles: (task.changedPaths || []).length,
    timestamp: new Date().toISOString(),
  });
}

export function summarize(metrics) {
  const total = metrics.tasks.length;
  const completed = metrics.tasks.filter(t => t.state === 'COMPLETED' || t.state === 'PR_CREATED').length;
  const failed = metrics.tasks.filter(t => t.state === 'FAILED' || t.state === 'BLOCKED').length;
  const withTests = metrics.tasks.filter(t => t.testsPassed).length;
  const totalRepairs = metrics.tasks.reduce((s, t) => s + t.repairAttempts, 0);
  return {
    totalTasks: total,
    completed,
    failed,
    completionRate: total > 0 ? (completed / total * 100).toFixed(1) + '%' : 'N/A',
    firstPassSuccess: total > 0 ? (metrics.tasks.filter(t => t.repairAttempts === 0 && (t.state === 'COMPLETED' || t.state === 'PR_CREATED')).length / total * 100).toFixed(1) + '%' : 'N/A',
    testPassRate: total > 0 ? (withTests / total * 100).toFixed(1) + '%' : 'N/A',
    totalRepairs,
    avgRepairs: total > 0 ? (totalRepairs / total).toFixed(2) : '0',
  };
}
