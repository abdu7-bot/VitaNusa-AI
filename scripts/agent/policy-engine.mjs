#!/usr/bin/env node
/**
 * VitaNusa AI - Policy Engine
 * Validates and enforces autonomous engine policy configuration.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const POLICY_PATH = join(PROJECT_ROOT, 'config', 'autonomous-policy.json');

const VALID_MODES = new Set(['AUDIT', 'SUPERVISED', 'AUTONOMOUS_DRAFT_PR', 'RESTRICTED']);

const POLICY_SCHEMA = {
  enabled: { type: 'boolean', required: true },
  mode: { type: 'string', required: true, allowed: ['AUDIT', 'SUPERVISED', 'AUTONOMOUS_DRAFT_PR', 'RESTRICTED'] },
  allowed_repositories: { type: 'array', items: 'string', required: true },
  allowed_base_branches: { type: 'array', items: 'string', required: true },
  allowed_worker_commands: { type: 'array', items: 'string', required: true },
  max_concurrent_tasks: { type: 'number', min: 1, max: 10, required: true },
  max_repair_attempts: { type: 'number', min: 0, max: 5, required: true },
  task_timeout_seconds: { type: 'number', min: 60, max: 3600, required: true },
  max_changed_files: { type: 'number', min: 1, max: 1000, required: true },
  max_diff_lines: { type: 'number', min: 1, max: 100000, required: true },
  require_tests: { type: 'boolean', required: true },
  require_security_checks: { type: 'boolean', required: true },
  require_draft_pr: { type: 'boolean', required: true },
  allow_dependency_changes: { type: 'boolean', required: true },
  allow_lockfile_changes: { type: 'boolean', required: true },
  allow_network_access: { type: 'boolean', required: true },
  allow_destructive_commands: { type: 'boolean', required: true, mustBeFalse: true },
  allow_main_writes: { type: 'boolean', required: true, mustBeFalse: true },
  allow_auto_merge: { type: 'boolean', required: true, mustBeFalse: true },
  allow_deployment: { type: 'boolean', required: true, mustBeFalse: true },
  require_human_approval_for: { type: 'array', items: 'string', required: true },
  max_cost_per_task: { type: 'number', nullable: true, required: true },
  max_daily_cost: { type: 'number', nullable: true, required: true },
  stop_on_policy_violation: { type: 'boolean', required: true },
};

export function loadPolicy(policyPath = POLICY_PATH) {
  if (!existsSync(policyPath)) {
    throw new Error(`Policy file not found: ${policyPath}`);
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(policyPath, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid policy JSON: ${e.message}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Policy must be a JSON object');
  }

  // Check for required top-level engine section
  if (!raw.engine || typeof raw.engine !== 'object') {
    throw new Error('Policy missing required "engine" section');
  }

  const engine = raw.engine;
  const errors = [];

  // Validate each field
  for (const [key, schema] of Object.entries(POLICY_SCHEMA)) {
    const value = engine[key];

    if (schema.required && value === undefined) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (value === null && !schema.nullable) {
      errors.push(`Field ${key} cannot be null`);
      continue;
    }

    if (value !== null && schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${key} must be boolean, got ${typeof value}`);
      continue;
    }

    if (value !== null && schema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field ${key} must be number, got ${typeof value}`);
      continue;
    }

    if (value !== null && schema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field ${key} must be string, got ${typeof value}`);
      continue;
    }

    if (value !== null && schema.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field ${key} must be array, got ${typeof value}`);
      continue;
    }

    if (schema.mustBeFalse && value !== false) {
      errors.push(`Field ${key} must be false (safety default)`);
    }

    if (schema.allowed && !schema.allowed.includes(value)) {
      errors.push(`Field ${key} must be one of ${schema.allowed.join(', ')}, got ${value}`);
    }

    if (schema.min !== undefined && value !== null && value < schema.min) {
      errors.push(`Field ${key} must be >= ${schema.min}, got ${value}`);
    }

    if (schema.max !== undefined && value !== null && value > schema.max) {
      errors.push(`Field ${key} must be <= ${schema.max}, got ${value}`);
    }
  }

  // Check for unknown dangerous options
  const knownKeys = new Set(Object.keys(POLICY_SCHEMA));
  for (const key of Object.keys(engine)) {
    if (!knownKeys.has(key)) {
      errors.push(`Unknown policy option: ${key}`);
    }
  }

  // Mode validation
  if (engine.mode && !VALID_MODES.has(engine.mode)) {
    errors.push(`Invalid mode: ${engine.mode}. Must be one of ${[...VALID_MODES].join(', ')}`);
  }

  // Default to AUDIT mode if not specified
  if (!engine.mode) {
    engine.mode = 'AUDIT';
  }

  // Conservative defaults: if enabled is false, force AUDIT mode
  if (!engine.enabled) {
    engine.mode = 'AUDIT';
  }

  if (errors.length > 0) {
    throw new Error(`Policy validation failed:\n${errors.join('\n')}`);
  }

  return { engine, raw };
}

export function isPolicyEnabled(policy) {
  return policy?.engine?.enabled === true;
}

export function isMode(policy, mode) {
  return policy?.engine?.mode === mode;
}

export function isAllowedRepository(policy, repoSlug) {
  return policy?.engine?.allowed_repositories?.includes(repoSlug) ?? false;
}

export function isAllowedBaseBranch(policy, branch) {
  return policy?.engine?.allowed_base_branches?.includes(branch) ?? false;
}

export function isAllowedWorker(policy, worker) {
  return policy?.engine?.allowed_worker_commands?.includes(worker) ?? false;
}

export function getMaxConcurrentTasks(policy) {
  return policy?.engine?.max_concurrent_tasks ?? 1;
}

export function getMaxRepairAttempts(policy) {
  return policy?.engine?.max_repair_attempts ?? 2;
}

export function getTaskTimeout(policy) {
  return policy?.engine?.task_timeout_seconds ?? 600;
}

export function getMaxChangedFiles(policy) {
  return policy?.engine?.max_changed_files ?? 50;
}

export function getMaxDiffLines(policy) {
  return policy?.engine?.max_diff_lines ?? 5000;
}

export function requiresTests(policy) {
  return policy?.engine?.require_tests ?? true;
}

export function requiresSecurityChecks(policy) {
  return policy?.engine?.require_security_checks ?? true;
}

export function requiresDraftPR(policy) {
  return policy?.engine?.require_draft_pr ?? true;
}

export function requiresHumanApproval(policy, operation) {
  return policy?.engine?.require_human_approval_for?.includes(operation) ?? true;
}

export function canChangeDependencies(policy) {
  return policy?.engine?.allow_dependency_changes ?? false;
}

export function canChangeLockfiles(policy) {
  return policy?.engine?.allow_lockfile_changes ?? false;
}

export function canAccessNetwork(policy) {
  return policy?.engine?.allow_network_access ?? false;
}

export function canWriteMain(policy) {
  return policy?.engine?.allow_main_writes ?? false;
}

export function canAutoMerge(policy) {
  return policy?.engine?.allow_auto_merge ?? false;
}

export function canDeploy(policy) {
  return policy?.engine?.allow_deployment ?? false;
}

export function stopOnViolation(policy) {
  return policy?.engine?.stop_on_policy_violation ?? true;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const policy = loadPolicy();
    console.log(JSON.stringify(policy, null, 2));
    console.log('\nPolicy loaded successfully.');
    console.log(`Mode: ${policy.engine.mode}`);
    console.log(`Enabled: ${policy.engine.enabled}`);
  } catch (error) {
    console.error(`POLICY ERROR: ${error.message}`);
    process.exitCode = 2;
  }
}
