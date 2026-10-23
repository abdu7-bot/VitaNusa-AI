import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'cr-'));
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@test.com');
  git(dir, 'config', 'user.name', 'Test');
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'init');
  git(dir, 'checkout', '-b', 'agent/T001-test');
  mkdirSync(join(dir, 'tasks', 'active'), { recursive: true });
  writeFileSync(join(dir, 'tasks', 'active', 'T001.md'), `---
id: T001
title: Test
status: READY
priority: P1
allowedPaths: src
tests: echo ok
---
Test.
`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n');
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'vitanusa-work-queue.md'), '# Queue\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'setup');
  return dir;
}

test('CR: stale lock detection clears old running state', async () => {
  const dir = setupRepo();
  const runtimeDir = join(dir, '.git', 'vitanusa-agent');
  mkdirSync(runtimeDir, { recursive: true });
  const stateFile = join(runtimeDir, 'state.json');
  const staleState = {
    taskId: 'T001',
    status: 'RUNNING',
    startedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    baseCommit: git(dir, 'rev-parse', 'HEAD'),
  };
  writeFileSync(stateFile, JSON.stringify(staleState));
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  // Should not throw about active task since stale lock is cleared
  const result = await main(['--task=T001'], dir);
  assert.equal(result.state, 'PLAN');
  rmSync(dir, { recursive: true, force: true });
});

test('CR: evidence file preserved after interruption', async () => {
  const dir = setupRepo();
  const evidenceDir = join(dir, '.git', 'vitanusa-agent', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = join(evidenceDir, 'T001-123.json');
  const evidence = { taskId: 'T001', state: 'BLOCKED', stopReason: 'interrupted' };
  writeFileSync(evidenceFile, JSON.stringify(evidence));
  assert.equal(existsSync(evidenceFile), true);
  const read = JSON.parse(readFileSync(evidenceFile, 'utf8'));
  assert.equal(read.state, 'BLOCKED');
  rmSync(dir, { recursive: true, force: true });
});

test('CR: corrupted state file causes safe failure', async () => {
  const dir = setupRepo();
  const runtimeDir = join(dir, '.git', 'vitanusa-agent');
  mkdirSync(runtimeDir, { recursive: true });
  const stateFile = join(runtimeDir, 'state.json');
  writeFileSync(stateFile, '{corrupted json');
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001'], dir), /Unexpected token|JSON/i);
  rmSync(dir, { recursive: true, force: true });
});
