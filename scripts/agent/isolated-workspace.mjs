#!/usr/bin/env node
/**
 * VitaNusa AI - Isolated Workspace
 * Creates a disposable copy of the repository for safe worker execution.
 */

import { mkdtempSync, rmSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export function createIsolatedWorkspace(sourceRoot, taskId) {
  const workspace = mkdtempSync(join(tmpdir(), `vitanusa-ws-${taskId}-`));
  // Clone the repo (local clone, shares objects but creates separate working tree)
  execFileSync('git', ['clone', '--local', sourceRoot, workspace], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Copy task files if they exist
  const taskDir = join(sourceRoot, 'tasks');
  if (existsSync(taskDir)) {
    cpSync(taskDir, join(workspace, 'tasks'), { recursive: true, force: true });
  }
  // Copy roadmap and work queue if they exist
  for (const f of ['ROADMAP.md', 'docs/vitanusa-work-queue.md']) {
    const src = join(sourceRoot, f);
    if (existsSync(src)) {
      mkdirSync(join(workspace, 'docs'), { recursive: true });
      cpSync(src, join(workspace, f), { force: true });
    }
  }
  return workspace;
}

export function getWorkspaceDiff(workspace, baseCommit) {
  const output = execFileSync('git', ['diff', '--name-status', baseCommit], {
    cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const lines = output.split('\n').filter(Boolean);
  const changes = [];
  for (const line of lines) {
    const [status, ...pathParts] = line.split('\t');
    changes.push({ status, path: pathParts.join('\t') });
  }
  // Untracked files
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split('\n').filter(Boolean);
  for (const path of untracked) {
    changes.push({ status: '??', path });
  }
  return changes;
}

export function cleanupWorkspace(workspace) {
  if (!workspace || !workspace.includes('vitanusa-ws-')) {
    throw new Error('Refusing to clean up non-workspace path: ' + workspace);
  }
  rmSync(workspace, { recursive: true, force: true });
}

export function validatePath(path) {
  if (!path || typeof path !== 'string') return false;
  // Reject absolute paths
  if (path.startsWith('/')) return false;
  // Reject path traversal
  if (path.includes('..')) return false;
  // Reject .git paths
  if (path.startsWith('.git/') || path === '.git') return false;
  // Reject sensitive files
  const sensitive = ['.env', 'credentials', 'secret', 'token', 'key', 'password'];
  const lower = path.toLowerCase();
  if (sensitive.some(s => lower.includes(s))) return false;
  return true;
}
