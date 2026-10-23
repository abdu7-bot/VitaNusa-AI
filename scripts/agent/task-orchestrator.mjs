#!/usr/bin/env node
/**
 * VitaNusa AI - Autonomous Task Orchestrator
 * 
 * Safety-first orchestrator for unattended coding tasks.
 * Implements: task schema validation, atomic claiming, worker validation,
 * change-scope enforcement, bounded repair, evidence collection, Draft PR creation.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
  writeFileSync(paths.STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function readState(paths) {
  if (!existsSync(paths.STATE_FILE)) return null;
  return JSON.parse(readFileSync(paths.STATE_FILE, 'utf8'));
}

function saveEvidence(paths, taskId, evidence) {
  mkdirSync(paths.EVIDENCE_DIR, { recursive: true });
  const file = join(paths.EVIDENCE_DIR, `${taskId}-${Date.now()}.json`);
  writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
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
  
  if (result.stdout && result.stdout.length > maxOutput) {
    result.stdout = result.stdout.slice(0, maxOutput) + '\n... [OUTPUT TRUNCATED]';
  }
  if (result.stderr && result.stderr.length > maxOutput) {
    result.stderr = result.stderr.slice(0, maxOutput) + '\n... [OUTPUT TRUNCATED]';
  }
  
  return result;
}

function runWorker(paths, worker, task, baseCommit, env = {}) {
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
    env: workerEnv 
  });
}

function createDraftPR(taskId, branch, baseCommit, headCommit, evidence) {
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    return { 
      success: false, 
      reason: 'GITHUB_TOKEN not set. Cannot create Draft PR automatically.',
      manualInfo: {
        branch,
        base: 'main',
        title: `[Draft] ${taskId}: ${evidence.taskTitle || ''}`,
        body: generatePRBody(taskId, evidence),
      }
    };
  }
  
  try {
    const result = runGit(['gh', 'pr', 'create', '--draft', '--base', 'main', '--head', branch, 
      '--title', `[Draft] ${taskId}: ${evidence.taskTitle || ''}`,
      '--body', generatePRBody(taskId, evidence)
    ], process.cwd());
    return { success: true, url: result.trim() };
  } catch (e) {
    return { success: false, reason: `gh CLI failed: ${e.message}`, manualInfo: { branch, base: 'main' } };
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

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const execute = argv.includes('--execute');
  const taskIdArg = argv.find((x) => x.startsWith('--task='))?.slice(7) ?? null;
  const repairLimit = Number(argv.find((x) => x.startsWith('--repair-limit='))?.slice(15)) ?? DEFAULT_REPAIR_LIMIT;
  
  const paths = getRepoPaths(cwd);
  const repo = assertRepositoryReady(paths);
  const tasks = loadTasks(paths);
  let task = taskIdArg ? tasks.find((t) => t.id === taskIdArg) : selectTask(tasks);
  
  if (!task) throw new Error('Tidak ada task READY yang eligible.');
  if (task.status !== 'READY') throw new Error(`${task.id} tidak READY.`);

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

  if (!execute) {
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
  
  const runningState = { 
    taskId: task.id, 
    branch, 
    status: 'RUNNING', 
    baseCommit: repo.head, 
    startedAt: new Date().toISOString(),
    repairCount: 0,
  };
  saveState(paths, runningState);
  evidence.stateTransitions.push({ state: 'RUNNING', timestamp: new Date().toISOString() });

  console.log(`[${task.id}] Starting worker: ${worker.join(' ')}`);
  const workerResult = runWorker(paths, worker, task, repo.head, { VITANUSA_TASK_ID: task.id, VITANUSA_BASE_COMMIT: repo.head });
  
  evidence.commands.push({ 
    command: worker.join(' '), 
    exitCode: workerResult.status, 
    stdout: workerResult.stdout, 
    stderr: workerResult.stderr,
    phase: 'implementation',
  });

  if (workerResult.status !== 0) {
    evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
    evidence.stopReason = `worker exit ${workerResult.status}`;
    evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
    evidence.changedPaths = getChangedPaths(paths, repo.head).map(c => c.path);
    saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
    saveEvidence(paths, task.id, evidence);
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
      });
      
      evidence.commands.push({ 
        command: worker.join(' '), 
        exitCode: repairResult.status, 
        stdout: repairResult.stdout, 
        stderr: repairResult.stderr,
        phase: `repair-${repairCount}`,
      });
      
      if (repairResult.status !== 0) {
        evidence.stopReason = `worker exit ${repairResult.status} during repair`;
        evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
        evidence.changedPaths = getChangedPaths(paths, repo.head).map(c => c.path);
        evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
        saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
        saveEvidence(paths, task.id, evidence);
        return { ...evidence, state: 'BLOCKED' };
      }
    } else {
      evidence.stateTransitions.push({ state: 'VERIFYING', timestamp: new Date().toISOString() });
      runningState.status = 'VERIFYING';
      saveState(paths, runningState);
    }

    const changes = getChangedPaths(paths, repo.head);
    evidence.changedPaths = changes.map(c => c.path);
    
    if (!checkAllowedPaths(changes, task.allowedPaths)) {
      evidence.stopReason = 'changed-file scope melewati allowedPaths';
      evidence.changedPaths = changes.map(c => c.path);
      evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
      evidence.stateTransitions.push({ state: 'BLOCKED', timestamp: new Date().toISOString() });
      saveState(paths, { ...runningState, status: 'BLOCKED', evidence });
      saveEvidence(paths, task.id, evidence);
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
    evidence.stopReason = `verification failed after ${repairLimit} repair attempts`;
    evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
    evidence.stateTransitions.push({ state: 'FAILED', timestamp: new Date().toISOString() });
    saveState(paths, { ...runningState, status: 'FAILED', evidence });
    saveEvidence(paths, task.id, evidence);
    return { ...evidence, state: 'FAILED' };
  }

  evidence.headCommit = runGit(['rev-parse', 'HEAD'], paths.ROOT);
  evidence.stateTransitions.push({ state: 'PR_CREATED', timestamp: new Date().toISOString() });

  const prResult = createDraftPR(task.id, branch, repo.head, evidence.headCommit, evidence);
  evidence.draftPR = prResult;

  if (prResult.success) {
    console.log(`[${task.id}] Draft PR created: ${prResult.url}`);
  } else {
    console.warn(`[${task.id}] Draft PR creation skipped: ${prResult.reason}`);
  }

  saveState(paths, { ...runningState, status: 'PR_CREATED', evidence, completedAt: new Date().toISOString() });
  saveEvidence(paths, task.id, evidence);

  return { ...evidence, state: 'PR_CREATED' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(main(), null, 2));
  } catch (error) {
    console.error(`STOP: ${error.message}`);
    process.exitCode = 2;
  }
}
