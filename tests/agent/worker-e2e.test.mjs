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
  const dir = mkdtempSync(join(tmpdir(), 'we2e-'));
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@test.com');
  git(dir, 'config', 'user.name', 'Test');
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'init');
  git(dir, 'checkout', '-b', 'agent/T001-hello');
  mkdirSync(join(dir, 'tasks', 'active'), { recursive: true });
  writeFileSync(join(dir, 'tasks', 'active', 'T001.md'), `---
id: T001
title: Add hello function
status: READY
priority: P1
allowedPaths: src
tests: node --test src/hello.test.mjs
---
Add a hello function that returns "Hello, World!" and a test for it.
`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n');
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'vitanusa-work-queue.md'), '# Queue\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'setup');
  return dir;
}

test('worker-e2e: policy blocks disabled execution', async () => {
  const dir = setupRepo();
  // Create disabled policy
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(join(dir, 'config', 'autonomous-policy.json'), JSON.stringify({
    engine: { enabled: false, mode: 'AUDIT', allowed_repositories: ['test/repo'],
      allowed_base_branches: ['main'], allowed_worker_commands: ['kilo'],
      max_concurrent_tasks: 1, max_repair_attempts: 0, task_timeout_seconds: 120,
      max_changed_files: 50, max_diff_lines: 5000, require_tests: true,
      require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false,
      allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false,
      allow_main_writes: false, allow_auto_merge: false, allow_deployment: false,
      require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null,
      stop_on_policy_violation: true }
  }));
  const { loadPolicy, isPolicyEnabled } = await import('../../scripts/agent/policy-engine.mjs');
  const p = loadPolicy(join(dir, 'config', 'autonomous-policy.json'));
  assert.equal(isPolicyEnabled(p), false);
  rmSync(dir, { recursive: true, force: true });
});

test('worker-e2e: plan mode produces contract without mutation', async () => {
  const dir = setupRepo();
  const { main } = await import('../../scripts/agent/task-orchestrator.mjs');
  const result = await main(['--task=T001'], dir);
  assert.equal(result.state, 'PLAN');
  assert.ok(result.workerInputContract);
  // Verify no files changed
  const status = git(dir, 'status', '--porcelain');
  assert.equal(status, '');
  rmSync(dir, { recursive: true, force: true });
});
