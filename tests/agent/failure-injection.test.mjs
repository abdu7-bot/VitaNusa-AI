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
  const dir = mkdtempSync(join(tmpdir(), 'fi-'));
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
title: Test task
status: READY
priority: P1
allowedPaths: src
tests: node --test src/test.mjs
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

test('FI: state machine rejects invalid transition RUNNING->SUCCEEDED', async () => {
  const { isValidTransition } = await import('../../scripts/agent/state-machine.mjs');
  assert.equal(isValidTransition('RUNNING', 'SUCCEEDED'), false);
});

test('FI: policy engine rejects disabled mode', async () => {
  const { loadPolicy, isPolicyEnabled } = await import('../../scripts/agent/policy-engine.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'fi-pol-'));
  const file = join(dir, 'p.json');
  writeFileSync(file, JSON.stringify({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } }));
  const p = loadPolicy(file);
  assert.equal(isPolicyEnabled(p), false);
  rmSync(dir, { recursive: true, force: true });
});

test('FI: repair limit cannot be exceeded via CLI', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=10'], dir), /exceeds policy maximum/i);
  rmSync(dir, { recursive: true, force: true });
});

test('FI: invalid repair limit rejected', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=abc'], dir), /Invalid --repair-limit/i);
  rmSync(dir, { recursive: true, force: true });
});

test('FI: negative repair limit rejected', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  await assert.rejects(() => main(['--task=T001', '--repair-limit=-1'], dir), /Invalid --repair-limit/i);
  rmSync(dir, { recursive: true, force: true });
});

test('FI: plan mode does not mutate repo', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  const result = await main(['--task=T001'], dir);
  assert.equal(result.state, 'PLAN');
  const status = git(dir, 'status', '--porcelain');
  assert.equal(status, '');
  rmSync(dir, { recursive: true, force: true });
});
