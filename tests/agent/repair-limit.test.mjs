import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'rl-'));
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
Test task.
`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n');
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'vitanusa-work-queue.md'), '# Queue\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'setup');
  return dir;
}

test('repair-limit: omitted uses policy default', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  // Plan mode (no execute) - just check repairLimit in contract
  const result = await main(['--task=T001'], dir);
  assert.equal(result.workerInputContract.repairLimit, 2);
  rmSync(dir, { recursive: true, force: true });
});

test('repair-limit: invalid value rejected', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=abc'], dir), /Invalid --repair-limit/i);
  rmSync(dir, { recursive: true, force: true });
});

test('repair-limit: negative value rejected', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=-1'], dir), /Invalid --repair-limit/i);
  rmSync(dir, { recursive: true, force: true });
});

test('repair-limit: excessive value rejected', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=5'], dir), /exceeds policy maximum/i);
  rmSync(dir, { recursive: true, force: true });
});
