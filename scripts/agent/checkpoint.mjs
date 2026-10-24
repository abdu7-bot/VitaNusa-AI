#!/usr/bin/env node
/**
 * VitaNusa AI - Checkpoint Manager
 * Validates and persists task checkpoints for crash recovery.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(?:api[_-]?key|token|secret|password|authorization|bearer)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED]')
    .replace(/x-access-token:[^@]+@/g, 'x-access-token:[REDACTED]@');
}
import { join, dirname } from 'node:path';

export const CHECKPOINT_VERSION = 1;

export function createCheckpoint(taskId, state, metadata = {}) {
  return {
    version: CHECKPOINT_VERSION,
    taskId,
    executionAttempt: metadata.attempt || 1,
    state,
    lastCompletedStep: metadata.lastStep || null,
    retryCount: metadata.retryCount || 0,
    repairCount: metadata.repairCount || 0,
    policyVersion: metadata.policyVersion || '1.0',
    evidenceRefs: metadata.evidenceRefs || [],
    timestamp: new Date().toISOString(),
    checksum: null,
  };
}

export function validateCheckpoint(cp) {
  const errors = [];
  if (!cp || typeof cp !== 'object') { errors.push('Checkpoint must be an object'); return errors; }
  if (cp.version !== CHECKPOINT_VERSION) errors.push(`Incompatible checkpoint version: ${cp.version} (expected ${CHECKPOINT_VERSION})`);
  if (!cp.taskId || typeof cp.taskId !== 'string') errors.push('Missing or invalid taskId');
  if (!cp.state || typeof cp.state !== 'string') errors.push('Missing or invalid state');
  if (typeof cp.executionAttempt !== 'number' || cp.executionAttempt < 1) errors.push('Invalid executionAttempt');
  if (typeof cp.retryCount !== 'number' || cp.retryCount < 0) errors.push('Invalid retryCount');
  if (typeof cp.repairCount !== 'number' || cp.repairCount < 0) errors.push('Invalid repairCount');
  if (!cp.timestamp) errors.push('Missing timestamp');
  return errors;
}

export function isRecoverable(state) {
  const recoverable = new Set(['RUNNING', 'VERIFYING', 'REPAIRING', 'CLAIMED']);
  return recoverable.has(state);
}

export function isTerminal(state) {
  return state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED' || state === 'BLOCKED';
}

export function saveCheckpoint(checkpointDir, checkpoint) {
  const errors = validateCheckpoint(checkpoint);
  if (errors.length > 0) throw new Error(`Invalid checkpoint: ${errors.join(', ')}`);
  mkdirSync(checkpointDir, { recursive: true });
  const file = join(checkpointDir, `${checkpoint.taskId}-${checkpoint.executionAttempt}.json`);
  writeFileSync(file, JSON.stringify(checkpoint, (key, value) => typeof value === 'string' ? redactSensitive(value) : value, 2), { mode: 0o600 });
  return file;
}

export function loadCheckpoint(checkpointDir, taskId, attempt) {
  const file = join(checkpointDir, `${taskId}-${attempt}.json`);
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, 'utf8');
    const cp = JSON.parse(raw);
    const errors = validateCheckpoint(cp);
    if (errors.length > 0) throw new Error(`Corrupted checkpoint: ${errors.join(', ')}`);
    return cp;
  } catch (e) {
    throw new Error(`Failed to load checkpoint: ${e.message}`);
  }
}

export async function findLatestCheckpoint(checkpointDir, taskId) {
  if (!existsSync(checkpointDir)) return null;
  const { readdirSync } = await import('node:fs');
  const files = readdirSync(checkpointDir).filter(f => f.startsWith(`${taskId}-`) && f.endsWith('.json'));
  if (files.length === 0) return null;
  const attempts = files.map(f => parseInt(f.replace(`${taskId}-`, '').replace('.json', ''))).filter(n => !isNaN(n));
  if (attempts.length === 0) return null;
  const latest = Math.max(...attempts);
  return loadCheckpoint(checkpointDir, taskId, latest);
}
