import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPolicy, isPolicyEnabled, isMode, getMaxRepairAttempts, isAllowedWorker, isAllowedRepository, isAllowedBaseBranch, canWriteMain, canAutoMerge, canDeploy, stopOnViolation, requiresTests } from '../../scripts/agent/policy-engine.mjs';

function tmpPolicy(obj) {
  const dir = mkdtempSync(join(tmpdir(), 'policy-'));
  const file = join(dir, 'policy.json');
  if (obj !== undefined) writeFileSync(file, JSON.stringify(obj));
  else writeFileSync(file, '');
  return { dir, file };
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test('policy: missing file throws', () => {
  const { dir, file } = tmpPolicy();
  rmSync(file);
  assert.throws(() => loadPolicy(file), /not found/i);
  cleanup(dir);
});

test('policy: malformed JSON throws', () => {
  const { dir, file } = tmpPolicy();
  writeFileSync(file, '{bad json');
  assert.throws(() => loadPolicy(file), /Invalid policy JSON/i);
  cleanup(dir);
});

test('policy: non-object throws', () => {
  const { dir, file } = tmpPolicy('string');
  assert.throws(() => loadPolicy(file), /must be a JSON object/i);
  cleanup(dir);
});

test('policy: missing engine section throws', () => {
  const { dir, file } = tmpPolicy({});
  assert.throws(() => loadPolicy(file), /missing required "engine" section/i);
  cleanup(dir);
});

test('policy: missing required field throws', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: true } });
  assert.throws(() => loadPolicy(file), /Missing required field/i);
  cleanup(dir);
});

test('policy: unknown option throws', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true, dangerous_override: true } });
  assert.throws(() => loadPolicy(file), /Unknown policy option/i);
  cleanup(dir);
});

test('policy: invalid type throws', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: 'yes', mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be boolean/i);
  cleanup(dir);
});

test('policy: invalid range throws', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 0, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be >= 1/i);
  cleanup(dir);
});

test('policy: invalid mode throws', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'HACK', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /Invalid mode/i);
  cleanup(dir);
});

test('policy: unsafe defaults blocked (main writes)', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: true, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be false/i);
  cleanup(dir);
});

test('policy: unsafe defaults blocked (auto merge)', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: true, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be false/i);
  cleanup(dir);
});

test('policy: unsafe defaults blocked (deployment)', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: true, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be false/i);
  cleanup(dir);
});

test('policy: enabled=false forces AUDIT mode', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUTONOMOUS_DRAFT_PR', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(p.engine.mode, 'AUDIT');
  assert.equal(isPolicyEnabled(p), false);
  cleanup(dir);
});

test('policy: isPolicyEnabled returns false when disabled', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(isPolicyEnabled(p), false);
  cleanup(dir);
});

test('policy: isMode check', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(isMode(p, 'AUDIT'), true);
  assert.equal(isMode(p, 'SUPERVISED'), false);
  cleanup(dir);
});

test('policy: isAllowedWorker rejects unauthorized', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: ['kilo'], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(isAllowedWorker(p, 'kilo'), true);
  assert.equal(isAllowedWorker(p, 'rm'), false);
  assert.equal(isAllowedWorker(p, 'bash'), false);
  cleanup(dir);
});

test('policy: isAllowedRepository rejects unauthorized', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: ['abdu7-bot/VitaNusa-AI'], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(isAllowedRepository(p, 'abdu7-bot/VitaNusa-AI'), true);
  assert.equal(isAllowedRepository(p, 'evil/attack'), false);
  cleanup(dir);
});

test('policy: isAllowedBaseBranch rejects unauthorized', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: ['main'], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(isAllowedBaseBranch(p, 'main'), true);
  assert.equal(isAllowedBaseBranch(p, 'develop'), false);
  cleanup(dir);
});

test('policy: safety defaults are false', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(canWriteMain(p), false);
  assert.equal(canAutoMerge(p), false);
  assert.equal(canDeploy(p), false);
  assert.equal(stopOnViolation(p), true);
  assert.equal(requiresTests(p), true);
  cleanup(dir);
});

test('policy: getMaxRepairAttempts returns configured value', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 3, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(getMaxRepairAttempts(p), 3);
  cleanup(dir);
});

test('policy: null max_cost_per_task accepted', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  const p = loadPolicy(file);
  assert.equal(p.engine.max_cost_per_task, null);
  cleanup(dir);
});

test('policy: array items must be strings', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [123], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: null, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /must be string/i);
  cleanup(dir);
});

test('policy: non-finite number rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pol-'));
  const file = join(dir, 'p.json');
  writeFileSync(file, '{"engine":{"enabled":false,"mode":"AUDIT","allowed_repositories":[],"allowed_base_branches":[],"allowed_worker_commands":[],"max_concurrent_tasks":1e999,"max_repair_attempts":2,"task_timeout_seconds":600,"max_changed_files":50,"max_diff_lines":5000,"require_tests":true,"require_security_checks":true,"require_draft_pr":true,"allow_dependency_changes":false,"allow_lockfile_changes":false,"allow_network_access":false,"allow_destructive_commands":false,"allow_main_writes":false,"allow_auto_merge":false,"allow_deployment":false,"require_human_approval_for":[],"max_cost_per_task":null,"max_daily_cost":null,"stop_on_policy_violation":true}}');
  assert.throws(() => loadPolicy(file), /finite number/i);
  rmSync(dir, { recursive: true, force: true });
  cleanup(dir);
});

test('policy: negative budget rejected', () => {
  const { dir, file } = tmpPolicy({ engine: { enabled: false, mode: 'AUDIT', allowed_repositories: [], allowed_base_branches: [], allowed_worker_commands: [], max_concurrent_tasks: 1, max_repair_attempts: 2, task_timeout_seconds: 600, max_changed_files: 50, max_diff_lines: 5000, require_tests: true, require_security_checks: true, require_draft_pr: true, allow_dependency_changes: false, allow_lockfile_changes: false, allow_network_access: false, allow_destructive_commands: false, allow_main_writes: false, allow_auto_merge: false, allow_deployment: false, require_human_approval_for: [], max_cost_per_task: -1, max_daily_cost: null, stop_on_policy_violation: true } });
  assert.throws(() => loadPolicy(file), /non-negative or null/i);
  cleanup(dir);
});
