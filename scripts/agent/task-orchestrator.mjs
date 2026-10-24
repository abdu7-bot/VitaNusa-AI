#!/usr/bin/env node
/**
 * VitaNusa AI - Autonomous Task Orchestrator
 * 
 * Safety-first orchestrator for unattended coding tasks.
 * Implements: task schema validation, atomic claiming, worker validation,
 * change-scope enforcement, bounded repair, evidence collection, Draft PR creation.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
// Using built-in fetch (Node.js 18+)
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createIsolatedWorkspace, getWorkspaceDiff, cleanupWorkspace, validatePath } from './isolated-workspace.mjs';
import { createJournal, OPERATION_STATES } from './operation-journal.mjs';
import { createCheckpoint, saveCheckpoint, isRecoverable } from './checkpoint.mjs';
import { transition as smTransition, TASK_STATES } from './state-machine.mjs';
import { loadPolicy, isPolicyEnabled, isMode, getMaxRepairAttempts, getTaskTimeout, getMaxChangedFiles, getMaxDiffLines, canWriteMain, canAutoMerge, canDeploy, stopOnViolation, requiresTests, requiresSecurityChecks, requiresDraftPR } from './policy-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const ALLOWED_WORKERS = new Set(['kilo', 'opencode', 'aider', 'codex']);
const PAID_MARKERS = /paid|pro|premium|enterprise|gpt-4\.1|claude-3|claude-4/i;

const VALID_STATES = new Set([
  'READY', 'PLAN', 'CLAIMED', 'RUNNING', 'VERIFYING', 'REPAIRING', 
  'BLOCKED', 'FAILED', 'PR_CREATED'
]);

const DEFAULT_REPAIR_LIMIT = 2;
const WORKER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OUTPUT_CHARS = 50000;

function getGitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { 
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] 
    }).trim();
  } catch {
    return cwd;
  }
}

function runGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function getRepoPaths(cwd) {
  const root = getGitRoot(cwd);
  return {
    ROOT: root,
    TASK_DIR: join(root, 'tasks', 'active'),
    ROADMAP: join(root, 'ROADMAP.md'),
    WORK_QUEUE: join(root, 'docs', 'vitanusa-work-queue.md'),
    RUNTIME_DIR: join(root, '.git', 'vitanusa-agent'),
    STATE_FILE: join(root, '.git', 'vitanusa-agent', 'state.json'),
    EVIDENCE_DIR: join(root, '.git', 'vitanusa-agent', 'evidence'),
    JOURNAL_DIR: join(root, '.git', 'vitanusa-agent', 'operations'),
    CHECKPOINT_DIR: join(root, '.git', 'vitanusa-agent', 'checkpoints'),
  };
}

export function parseTask(text, fileName) {
  const front = text.match(/^---\n([\s\S]*?)\n---/);
  if (!front) return null;
  const data = {};
  for (const line of front[1].split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (m) data[m[1]] = m[2];
  }
  data.file = fileName;
  data.priorityRank = Number((data.priority || 'P99').match(/\d+/)?.[0] ?? 99);
  data.tests = data.tests ? data.tests.split('|').map((x) => x.trim()).filter(Boolean) : [];
  data.allowedPaths = data.allowedPaths ? data.allowedPaths.split('|').map((x) => x.trim()).filter(Boolean) : [];
  data.instructions = data.instructions || '';
  data.acceptanceCriteria = data.acceptanceCriteria ? data.acceptanceCriteria.split('|').map((x) => x.trim()).filter(Boolean) : [];
  return data;
}

export function loadTasks(paths) {
  if (!existsSync(paths.TASK_DIR)) return [];
  return readdirSync(paths.TASK_DIR).filter((f) => f.endsWith('.md')).flatMap((file) => {
    const parsed = parseTask(readFileSync(join(paths.TASK_DIR, file), 'utf8'), file);
    return parsed ? [parsed] : [];
  });
}

export function selectTask(tasks) {
  return tasks.filter((t) => t.status === 'READY' && t.id && t.priorityRank < 99)
    .sort((a, b) => a.priorityRank - b.priorityRank || a.id.localeCompare(b.id))[0] ?? null;
}

export function assertRepositoryReady(paths) {
  if (!existsSync(paths.ROADMAP) || !existsSync(paths.WORK_QUEUE)) throw new Error('ROADMAP atau work queue tidak ditemukan');
  const branch = runGit(['branch', '--show-current'], paths.ROOT);
  if (!branch || branch === 'main' || branch === 'master') throw new Error(`Tidak boleh menjalankan worker dari ${branch || 'detached HEAD'}`);
  const status = runGit(['status', '--porcelain'], paths.ROOT);
  if (status) throw new Error('Repository dirty. Bersihkan perubahan dulu sebelum unattended run.');
  return { branch, head: runGit(['rev-parse', 'HEAD'], paths.ROOT) };
}


export function atomicClaim(paths, taskId, workerId) {
  const lockFile = join(paths.RUNTIME_DIR, 'claim-' + taskId + '.lock');
  mkdirSync(paths.RUNTIME_DIR, { recursive: true });
  try {
    writeFileSync(lockFile, JSON.stringify({ taskId, workerId, claimedAt: new Date().toISOString(), fencingToken: Date.now() }), { flag: 'wx', mode: 0o600 });
    // Post-write verification: confirm we still own the lock
    const verify = JSON.parse(readFileSync(lockFile, 'utf8'));
    if (verify.workerId !== workerId) {
      rmSync(lockFile, { force: true });
      return { success: false, reason: 'Task already claimed by another worker' };
    }
    return { success: true, lockFile };
  } catch (e) {
    if (e.code === 'EEXIST') {
      // Check if stale
      try {
        const existing = JSON.parse(readFileSync(lockFile, 'utf8'));
        const claimedAt = new Date(existing.claimedAt).getTime();
        if (Date.now() - claimedAt > 30 * 60 * 1000) {
          // Stale claim - remove and retry with wx flag
          rmSync(lockFile, { force: true });
          try {
            writeFileSync(lockFile, JSON.stringify({ taskId, workerId, claimedAt: new Date().toISOString(), fencingToken: Date.now() }), { flag: 'wx', mode: 0o600 });
            // Post-write verification for stale recovery
            const verify2 = JSON.parse(readFileSync(lockFile, 'utf8'));
            if (verify2.workerId !== workerId) {
              rmSync(lockFile, { force: true });
              return { success: false, reason: 'Task already claimed by another worker' };
            }
            return { success: true, lockFile, stale: true };
          } catch (retryErr) {
            if (retryErr.code === 'EEXIST') {
              return { success: false, reason: 'Task already claimed by another worker' };
            }
            throw retryErr;
          }
        }
      } catch {}
      return { success: false, reason: 'Task already claimed by another worker' };
    }
    return { success: false, reason: redactSensitive(e.message) };
  }
}

export function releaseClaim(paths, taskId, workerId) {
  const lockFile = join(paths.RUNTIME_DIR, 'claim-' + taskId + '.lock');
  try {
    const existing = JSON.parse(readFileSync(lockFile, 'utf8'));
    if (existing.workerId !== workerId) {
      return { success: false, reason: 'Claim ownership mismatch, cannot release' };
    }
    rmSync(lockFile, { force: true });
    return { success: true };
  } catch {
    return { success: false, reason: 'Claim not found or unreadable' };
  }
}

export function validateWorker(command) {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !ALLOWED_WORKERS.has(parts[0])) throw new Error('Worker tidak diizinkan. Gunakan kilo/opencode/aider/codex.');
  if (PAID_MARKERS.test(command) && process.env.VITANUSA_ALLOW_PAID !== '1') throw new Error('Paid fallback ditolak. Set VITANUSA_ALLOW_PAID=1 hanya dengan izin eksplisit.');
  return parts;
}

export function getChangedPaths(paths, baseCommit) {
  const output = runGit(['diff', '--name-status', baseCommit], paths.ROOT);
  const lines = output.split('\n').filter(Boolean);
  const changes = [];
  for (const line of lines) {
    const [status, ...pathParts] = line.split('\t');
    const path = pathParts.join('\t');
    changes.push({ status, path });
  }
  const untracked = runGit(['ls-files', '--others', '--exclude-standard'], paths.ROOT).split('\n').filter(Boolean);
  for (const path of untracked) {
    changes.push({ status: '??', path });
  }
  return changes;
}

export function checkAllowedPaths(changes, allowed) {
  if (!allowed.length) return true;
  // Support both formats: array of strings or array of objects with path property
  const paths = changes.map(c => typeof c === "string" ? c : (c.path || ""));
  return paths.every(path => allowed.some((rule) => path === rule || path.startsWith(`${rule}/`)));
}

function saveState(paths, state) {
  mkdirSync(paths.RUNTIME_DIR, { recursive: true });
  writeFileSync(paths.STATE_FILE, `${JSON.stringify(state, (key, value) => typeof value === 'string' ? redactSensitive(value) : value, 2)}\n`, { mode: 0o600 });
}

function readState(paths) {
  if (!existsSync(paths.STATE_FILE)) return null;
  return JSON.parse(readFileSync(paths.STATE_FILE, 'utf8'));
}

function saveEvidence(paths, taskId, evidence) {
  mkdirSync(paths.EVIDENCE_DIR, { recursive: true });
  const file = join(paths.EVIDENCE_DIR, `${taskId}-${Date.now()}.json`);
  writeFileSync(file, `${JSON.stringify(evidence, (key, value) => typeof value === 'string' ? redactSensitive(value) : value, 2)}\n`, { mode: 0o600 });
  return file;
}

function isStaleLock(state) {
  if (!state || state.status !== 'RUNNING') return false;
  const startedAt = new Date(state.startedAt).getTime();
  const now = Date.now();
  return (now - startedAt) > 30 * 60 * 1000;
}

function createWorkerInputContract(task, baseCommit, paths) {
  return {
    taskId: task.id,
    title: task.title,
    instructions: task.instructions,
    allowedPaths: task.allowedPaths,
    requiredTests: task.tests,
    acceptanceCriteria: task.acceptanceCriteria,
    baseCommit,
    repositoryRoot: paths.ROOT,
    timeoutMs: WORKER_TIMEOUT_MS,
    maxOutputChars: MAX_OUTPUT_CHARS,
    repairLimit: DEFAULT_REPAIR_LIMIT,
  };
}

function runWithTimeout(command, args, options = {}) {
  const timeout = options.timeout || WORKER_TIMEOUT_MS;
  const maxOutput = options.maxOutput || MAX_OUTPUT_CHARS;
  
  const result = spawnSync(command, args, {
    cwd: options.cwd || options.paths?.ROOT || process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...options.env },
    timeout,
    maxBuffer: maxOutput,
  });
  
  // Normalize Buffer output to strings for safe JSON serialization
  if (result.stdout instanceof Buffer) {
    result.stdout = result.stdout.toString('utf8');
  }
  if (result.stderr instanceof Buffer) {
    result.stderr = result.stderr.toString('utf8');
  }
  if (typeof result.stdout === 'string') {
    result.stdout = redactSensitive(result.stdout);
    if (result.stdout.length > maxOutput) {
      result.stdout = result.stdout.slice(0, maxOutput) + '\n... [OUTPUT TRUNCATED]';
    }
  }
  if (typeof result.stderr === 'string') {
    result.stderr = redactSensitive(result.stderr);
    if (result.stderr.length > maxOutput) {
      result.stderr = result.stderr.slice(0, maxOutput) + '\n... [OUTPUT TRUNCATED]';
    }
  }
  
  return result;
}

function runWorker(paths, worker, task, baseCommit, env = {}, cwdOverride = null) {
  const workerEnv = { 
    ...process.env, 
    ...env, 
    VITANUSA_TASK_ID: task.id, 
    VITANUSA_BASE_COMMIT: baseCommit,
    VITANUSA_ALLOWED_PATHS: task.allowedPaths.join('|'),
    VITANUSA_INSTRUCTIONS: task.instructions,
  };
  
  return runWithTimeout(worker[0], worker.slice(1), { 
    paths,
    cwd: cwdOverride || paths.ROOT,
    env: workerEnv 
  });
}

async function createDraftPR(taskId, branch, baseCommit, headCommit, evidence) {
  const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY; // e.g. "abdu7-bot/VitaNusa-AI"
  
  if (!ghToken) {
    return { 
      success: false, 
      reason: 'GITHUB_TOKEN/GH_TOKEN not set. Cannot create Draft PR automatically.',
      manualInfo: {
        branch,
        base: 'main',
        title: `[Draft] ${taskId}: ${evidence.taskTitle || ''}`,
        body: generatePRBody(taskId, evidence),
        commands: [
          `git push origin ${branch}`,
          `gh pr create --draft --base main --head ${branch} --title "[Draft] ${taskId}: ${evidence.taskTitle || ''}" --body "..."`,
        ],
      }
    };
  }
  
  // Pre-check: search for existing PR with same head/base (crash recovery)
  try {
    const existingPr = execFileSync('gh', ['pr', 'list', '--head', branch, '--base', 'main', '--json', 'number,url,isDraft,headRefName,baseRefName'], 
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const prs = JSON.parse(existingPr);
    if (prs && prs.length > 0) {
      const pr = prs[0];
      return {
        success: true,
        url: pr.url,
        number: pr.number,
        recovered: true,
        verified: {
          isDraft: pr.isDraft,
          head: pr.headRefName,
          base: pr.baseRefName,
          matchesExpected: pr.headRefName === branch && pr.baseRefName === 'main',
        }
      };
    }
  } catch (e) {
    // gh CLI search failed, proceed with creation attempt
  }

  // Method 1: Try gh CLI (preferred, handles auth automatically)
  try {
    const result = execFileSync('gh', ['pr', 'create', '--draft', '--base', 'main', '--head', branch, 
      '--title', `[Draft] ${taskId}: ${evidence.taskTitle || ''}`,
      '--body', generatePRBody(taskId, evidence)
    ], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    
    // Verify the PR was created and is draft
    const prUrl = result.trim();
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? prNumberMatch[1] : null;
    
    // Verify draft status
    let isDraft = false;
    let verifiedHead = null;
    let verifiedBase = null;
    try {
      const prInfo = execFileSync('gh', ['pr', 'view', prNumber || prUrl, '--json', 'isDraft,headRefName,baseRefName,number,url'], 
        { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const info = JSON.parse(prInfo);
      isDraft = info.isDraft;
      verifiedHead = info.headRefName;
      verifiedBase = info.baseRefName;
    } catch (e) {
      // gh CLI verification failed, but PR was created
      console.warn(`[${taskId}] PR created but verification failed: ${redactSensitive(e.message)}`);
    }
    
    return { 
      success: true, 
      url: prUrl,
      number: prNumber,
      verified: {
        isDraft,
        head: verifiedHead,
        base: verifiedBase,
        matchesExpected: verifiedHead === branch && verifiedBase === 'main',
      }
    };
  } catch (e) {
    // Method 2: Fallback to GitHub REST API (via curl)
    if (repoSlug) {
      try {
        const [owner, repo] = repoSlug.split('/');
        const curlResult = execFileSync('curl', [
          '-s', '-X', 'POST',
          `https://api.github.com/repos/${owner}/${repo}/pulls`,
          '-H', `Authorization: token ${ghToken}`,
          '-H', 'Accept: application/vnd.github.v3+json',
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({
            title: `[Draft] ${taskId}: ${evidence.taskTitle || ''}`,
            body: generatePRBody(taskId, evidence),
            head: branch,
            base: 'main',
            draft: true,
          }),
        ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        
        const pr = JSON.parse(curlResult);
        if (pr.html_url) {
          return { 
            success: true, 
            url: pr.html_url,
            number: pr.number,
            verified: {
              isDraft: pr.draft,
              head: pr.head.ref,
              base: pr.base.ref,
              matchesExpected: pr.head.ref === branch && pr.base.ref === 'main' && pr.draft === true,
            }
          };
        }
        throw new Error(redactSensitive(pr.message || 'Unknown API error'));
      } catch (apiErr) {
        return { success: false, reason: `GitHub API failed: ${redactSensitive(apiErr.message)}`, manualInfo: { branch, base: 'main' } };
      }
    }
    
    return { success: false, reason: `gh CLI failed: ${redactSensitive(e.message)}`, manualInfo: { branch, base: 'main' } };
  }
}

function generatePRBody(taskId, evidence) {
  return `## Autonomous Task: ${taskId}

### Summary
Task executed by autonomous orchestrator.

### Changes
- Base commit: ${evidence.baseCommit}
- Head commit: ${evidence.headCommit}
- Changed files: ${evidence.changedPaths?.length || 0}

### Test Results
${evidence.tests?.map(t => `- \`${t.command}\`: exit ${t.exitCode} ${t.exitCode === 0 ? '✅' : '❌'}`).join('\n') || 'No tests run'}

### Evidence
See \`evidence/\` directory for full details.

---
*Generated by VitaNusa Autonomous Engine*
`;
}

function applyWorkspaceChanges(workspace, originalRoot) {
  const statusOutput = execFileSync('git', ['status', '--porcelain'], { cwd: workspace, encoding: 'utf8' }).trim();
  if (!statusOutput) return;
  
  const lines = statusOutput.split('\n').filter(Boolean);
  for (const line of lines) {
    const status = line.substring(0, 2).trim();
    const filePath = line.substring(3).trim();
    
    if (status === 'D') {
      const fullPath = join(originalRoot, filePath);
      if (existsSync(fullPath)) unlinkSync(fullPath);
    } else if (status === 'R' || status === 'RM') {
      const parts = filePath.split(' -> ');
      if (parts.length === 2) {
        const oldPath = join(originalRoot, parts[0]);
        const newPath = join(originalRoot, parts[1]);
        if (existsSync(oldPath)) unlinkSync(oldPath);
        const srcPath = join(workspace, parts[1]);
        if (existsSync(srcPath)) {
          mkdirSync(path.dirname(newPath), { recursive: true });
          copyFileSync(srcPath, newPath);
        }
      }
    } else {
      const srcPath = join(workspace, filePath);
      const dstPath = join(originalRoot, filePath);
      if (existsSync(srcPath)) {
        mkdirSync(path.dirname(dstPath), { recursive: true });
        copyFileSync(srcPath, dstPath);
      }
    }
  }
}

export function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(?:api[_-]?key|token|secret|password|authorization|bearer)\s*[:= ]\s*['"]?[^'"\s]+['"]?/gi, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[REDACTED]')
    .replace(/x-access-token:[^@]+@/g, 'x-access-token:[REDACTED]@');
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const execute = argv.includes('--execute');
  const recover = argv.includes('--recover');
  const taskIdArg = argv.find((x) => x.startsWith('--task='))?.slice(7) ?? null;
  
  const policy = loadPolicy();
  if (!isPolicyEnabled(policy)) {
    console.warn('[POLICY] Autonomous execution is disabled. Running in AUDIT mode.');
  }
  const policyRepairLimit = getMaxRepairAttempts(policy);
  const rawRepairLimit = argv.find((x) => x.startsWith('--repair-limit='))?.slice(15);
  let repairLimit;
  if (rawRepairLimit === undefined) {
    repairLimit = policyRepairLimit;
  } else {
    const parsed = Number(rawRepairLimit);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`Invalid --repair-limit value: ${rawRepairLimit}. Must be a non-negative integer.`);
    }
    if (parsed > policyRepairLimit) {
      throw new Error(`--repair-limit ${parsed} exceeds policy maximum of ${policyRepairLimit}.`);
    }
    repairLimit = parsed;
  }
  
  const paths = getRepoPaths(cwd);
  const repo = assertRepositoryReady(paths);

  // Recovery mode: find and evaluate incomplete tasks
  if (recover) {
    const { findLatestCheckpoint, isRecoverable, isTerminal } = await import('./checkpoint.mjs');
    const cp = await findLatestCheckpoint(paths.CHECKPOINT_DIR, taskIdArg || 'T001');
    if (!cp) {
      return { state: 'BLOCKED', stopReason: 'No checkpoint found for recovery', taskId: taskIdArg };
    }
    if (isTerminal(cp.state)) {
      return { state: cp.state, stopReason: 'Task already terminal, no recovery needed', taskId: cp.taskId, checkpoint: cp };
    }
    if (!isRecoverable(cp.state)) {
      return { state: 'BLOCKED', stopReason: 'State ' + cp.state + ' is not recoverable', taskId: cp.taskId, checkpoint: cp };
    }
    const prev = readState(paths);
    if (prev && prev.status === 'RUNNING' && !isStaleLock(prev)) {
      return { state: 'BLOCKED', stopReason: 'Worker may still be active, cannot recover safely', taskId: cp.taskId, checkpoint: cp };
    }
    if (prev && prev.status === 'RUNNING' && isStaleLock(prev)) {
      const { rmSync } = await import('node:fs');
      rmSync(paths.STATE_FILE, { force: true });
    }
    // Recovery validated - fall through to execution with the recovered task ID
    if (!taskIdArg) {
      // Set taskIdArg so the task lookup below uses the checkpoint's task
      process.env._RECOVERED_TASK_ID = cp.taskId;
    }
    // Mark that we're in recovery mode (for evidence tracking)
    console.log('[RECOVERY] Resuming task ' + cp.taskId + ' from checkpoint state ' + cp.state);
  }

  const recoveredTaskId = process.env._RECOVERED_TASK_ID || taskIdArg;
  const tasks = loadTasks(paths);
  let task = recoveredTaskId ? tasks.find((t) => t.id === recoveredTaskId) : (taskIdArg ? tasks.find((t) => t.id === taskIdArg) : selectTask(tasks));
  
  if (!task) throw new Error(redactSensitive('Tidak ada task READY yang eligible.'));
  if (task.status !== 'READY' && !recover) throw new Error(`${task.id} tidak READY.`);

  const previous = readState(paths);
  if (previous?.status === 'RUNNING') {
    if (previous.taskId !== task.id) {
      if (isStaleLock(previous)) {
        console.warn(`STALE LOCK DETECTED: ${previous.taskId}. Clearing...`);
        rmSync(paths.STATE_FILE, { force: true });
      } else {
        throw new Error(`Masih ada task aktif: ${previous.taskId}. Gunakan --force-stale untuk override.`);
      }
    }
  }

  const branch = `agent/${task.id.toLowerCase()}-${task.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'work'}`;
  
  const evidence = {
    taskId: task.id,
    taskTitle: task.title,
    baseCommit: repo.head,
    headCommit: null,
    branch,
    changedPaths: [],
    tests: [],
    repairs: [],
    commands: [],
    stopReason: null,
    stateTransitions: [{ state: 'PLAN', timestamp: new Date().toISOString() }],
    workerInputContract: null,
  };

  if (!execute && !recover) {
    evidence.workerInputContract = createWorkerInputContract(task, repo.head, paths);
    return { ...evidence, state: 'PLAN' };
  }

  const workerCommand = process.env.VITANUSA_WORKER_CMD || 'kilo --auto';
  const worker = validateWorker(workerCommand);
  
  evidence.workerInputContract = createWorkerInputContract(task, repo.head, paths);
  evidence.stateTransitions.push({ state: 'CLAIMED', timestamp: new Date().toISOString() });

  if (runGit(['branch', '--list', branch], paths.ROOT)) {
    throw new Error(`Branch ${branch} sudah ada. Jangan membuat branch duplikat.`);
  }
  runGit(['switch', '-c', branch], paths.ROOT);
  
  // Create isolated workspace for worker execution
  const workspace = createIsolatedWorkspace(paths.ROOT, task.id);
  console.log(`[${task.id}] Isolated workspace: ${workspace}`);
  
  const runningState = { 
    taskId: task.id, 
    branch, 
    status: 'RUNNING', 
    baseCommit: repo.head, 
    startedAt: new Date().toISOString(),
    repairCount: 0,
    leaseToken: crypto.randomUUID(),
    fencingToken: Date.now(),
  };
  saveState(paths, runningState);
  evidence.stateTransitions.push({ state: 'RUNNING', timestamp: new Date().toISOString() });

  console.log(`[${task.id}] Starting worker: ${worker.join(' ')}`);
  const workerResult = runWorker(paths, worker, task, repo.head, { VITANUSA_TASK_ID: task.id, VITANUSA_BASE_COMMIT: repo.head }, workspace);
  
  evidence.commands.push({ 
    command: worker.join(' '), 
    exitCode: workerResult.status, 
    stdout: workerResult.stdout, 
    stderr: workerResult.stderr,
    phase: 'implementation',
  });

  if (workerResult.status !== 0) {
    evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
    evidence.stopReason = redactSensitive(`worker exit ${workerResult.status}`);
    evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
    evidence.changedPaths = getChangedPaths(paths, repo.head).map(c => c.path);
    saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
    saveEvidence(paths, task.id, evidence);
    cleanupWorkspace(workspace);
    return { ...evidence, state: 'BLOCKED' };
  }

  let repairCount = 0;
  let verificationPassed = false;
  
  while (repairCount <= repairLimit && !verificationPassed) {
    if (repairCount > 0) {
      evidence.stateTransitions.push({ state: 'REPAIRING', timestamp: new Date().toISOString(), repairAttempt: repairCount });
      runningState.repairCount = repairCount;
      saveState(paths, runningState);
      console.log(`[${task.id}] Repair attempt ${repairCount}/${repairLimit}`);
      
      // Re-invoke worker for repair
      console.log(`[${task.id}] Re-invoking worker for repair...`);
      const repairResult = runWorker(paths, worker, task, repo.head, { 
        VITANUSA_TASK_ID: task.id, 
        VITANUSA_BASE_COMMIT: repo.head,
        VITANUSA_REPAIR_ATTEMPT: repairCount.toString(),
      }, workspace);
      
      evidence.commands.push({ 
        command: worker.join(' '), 
        exitCode: repairResult.status, 
        stdout: repairResult.stdout, 
        stderr: repairResult.stderr,
        phase: `repair-${repairCount}`,
      });
      
      if (repairResult.status !== 0) {
        evidence.stopReason = redactSensitive(`worker exit ${repairResult.status} during repair`);
        evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
        evidence.changedPaths = getChangedPaths(paths, repo.head).map(c => c.path);
        evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
        saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
        saveEvidence(paths, task.id, evidence);
        cleanupWorkspace(workspace);
        return { ...evidence, state: 'BLOCKED' };
      }
    } else {
      evidence.stateTransitions.push({ state: 'VERIFYING', timestamp: new Date().toISOString() });
      runningState.status = 'VERIFYING';
      saveState(paths, runningState);
    }

    // Get changes from isolated workspace
    const workspaceChanges = getWorkspaceDiff(workspace, repo.head);
    const changes = workspaceChanges.map(c => ({ path: c.path, status: c.status }));
    
    // Apply changes from workspace to original repo
    applyWorkspaceChanges(workspace, paths.ROOT);
    evidence.changedPaths = changes.map(c => c.path);
    
    if (!checkAllowedPaths(changes, task.allowedPaths)) {
      evidence.stopReason = redactSensitive('changed-file scope melewati allowedPaths');
      evidence.changedPaths = changes.map(c => c.path);
      evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
      evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
      saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
      saveEvidence(paths, task.id, evidence);
      cleanupWorkspace(workspace);
      return { ...evidence, state: 'BLOCKED' };
    }

    let allTestsPassed = true;
    for (const command of task.tests) {
      const parts = command.split(/\s+/).filter(Boolean);
      const result = runWithTimeout(parts[0], parts.slice(1), { paths });
      
      evidence.commands.push({ 
        command, 
        exitCode: result.status, 
        stdout: result.stdout, 
        stderr: result.stderr,
        phase: repairCount > 0 ? `repair-${repairCount}` : 'verification',
      });
      evidence.tests.push({ command, exitCode: result.status });
      
      if (result.status !== 0) {
        allTestsPassed = false;
        console.log(`[${task.id}] Test failed: ${command} (exit ${result.status})`);
      }
    }

    const diffCheck = runWithTimeout('git', ['diff', '--check'], { paths });
    evidence.commands.push({ 
      command: 'git diff --check', 
      exitCode: diffCheck.status, 
      stdout: diffCheck.stdout, 
      stderr: diffCheck.stderr,
      phase: repairCount > 0 ? `repair-${repairCount}` : 'verification',
    });
    
    if (diffCheck.status !== 0) {
      allTestsPassed = false;
      console.log(`[${task.id}] git diff --check failed`);
    }

    if (allTestsPassed) {
      verificationPassed = true;
    } else {
      repairCount++;
      if (repairCount <= repairLimit) {
        evidence.repairs.push({ attempt: repairCount, timestamp: new Date().toISOString() });
        console.log(`[${task.id}] Verification failed. Repair attempt ${repairCount}/${repairLimit} will re-invoke worker.`);
      }
    }
  }

  if (!verificationPassed) {
    evidence.stopReason = redactSensitive(`verification failed after ${repairLimit} repair attempts`);
    evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
    evidence.stateTransitions.push({ state: 'FAILED', timestamp: new Date().toISOString() });
    saveState(paths, { ...runningState, status: 'FAILED', evidence });
    saveEvidence(paths, task.id, evidence);
    cleanupWorkspace(workspace);
    return { ...evidence, state: 'FAILED' };
  }

  evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
  evidence.stateTransitions.push({ state: 'PR_CREATED', timestamp: new Date().toISOString() });

  // Operation journal: track Draft PR creation
  const journal = createJournal(paths.JOURNAL_DIR);
  const existingOps = journal.listByTask ? await journal.listByTask(task.id) : [];
  const prOp = existingOps.find(o => o.type === 'draft_pr' && o.status === OPERATION_STATES.CONFIRMED);
  let prResult;
  if (prOp) {
    // Already confirmed - don't repeat
    prResult = { success: true, url: 'already-created', number: null, verified: { isDraft: true } };
    console.log('[' + task.id + '] Draft PR already created (journal confirmed). Skipping.');
  } else {
    const opEntry = journal.record({ taskId: task.id, type: 'draft_pr', target: branch, status: OPERATION_STATES.STARTED });
    prResult = await createDraftPR(task.id, branch, repo.head, evidence.headCommit, evidence);
    if (prResult.success) {
      journal.update(opEntry.id, { status: OPERATION_STATES.CONFIRMED, confirmedAt: new Date().toISOString() });
    } else {
      journal.update(opEntry.id, { status: OPERATION_STATES.FAILED, failedAt: new Date().toISOString(), error: prResult.reason });
    }
    evidence.draftPR = prResult;
  }

  if (prResult.success) {
    console.log(`[${task.id}] Draft PR created: ${prResult.url}`);
  } else {
    console.warn(`[${task.id}] Draft PR creation skipped: ${prResult.reason}`);
  }

  saveState(paths, { ...runningState, status: 'PR_CREATED', evidence, completedAt: new Date().toISOString() });
  saveEvidence(paths, task.id, evidence);

  // Save checkpoint for recovery
  try {
    const cp = createCheckpoint(task.id, 'PR_CREATED', {
      attempt: 1,
      lastStep: 'completed',
      retryCount: repairCount,
      repairCount,
      evidenceRefs: [task.id],
    });
    saveCheckpoint(paths.CHECKPOINT_DIR, cp);
  } catch (e) {
    console.warn(`[${task.id}] Checkpoint save failed: ${redactSensitive(e.message)}`);
  }

  cleanupWorkspace(workspace);
  return { ...evidence, state: 'PR_CREATED' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(error => {
    console.error(`STOP: ${redactSensitive(error.message)}`);
    process.exitCode = 2;
  });
}
