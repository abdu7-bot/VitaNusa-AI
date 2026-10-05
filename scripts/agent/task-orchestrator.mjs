#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TASK_DIR = join(ROOT, 'tasks', 'active');
const ROADMAP = join(ROOT, 'ROADMAP.md');
const WORK_QUEUE = join(ROOT, 'docs', 'vitanusa-work-queue.md');
const RUNTIME_DIR = join(ROOT, '.git', 'vitanusa-agent');
const STATE_FILE = join(RUNTIME_DIR, 'state.json');

const ALLOWED_WORKERS = new Set(['kilo', 'opencode', 'aider', 'codex']);
const PAID_MARKERS = /paid|pro|premium|enterprise|gpt-4\.1|claude-3|claude-4/i;

export function runGit(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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
  return data;
}

export function loadTasks() {
  if (!existsSync(TASK_DIR)) return [];
  return readdirSync(TASK_DIR).filter((f) => f.endsWith('.md')).flatMap((file) => {
    const parsed = parseTask(readFileSync(join(TASK_DIR, file), 'utf8'), file);
    return parsed ? [parsed] : [];
  });
}

export function selectTask(tasks) {
  return tasks.filter((t) => t.status === 'READY' && t.id && t.priorityRank < 99)
    .sort((a, b) => a.priorityRank - b.priorityRank || a.id.localeCompare(b.id))[0] ?? null;
}

export function assertRepositoryReady() {
  if (!existsSync(ROADMAP) || !existsSync(WORK_QUEUE)) throw new Error('ROADMAP atau work queue tidak ditemukan');
  const branch = runGit(['branch', '--show-current']);
  if (!branch || branch === 'main' || branch === 'master') throw new Error(`Tidak boleh menjalankan worker dari ${branch || 'detached HEAD'}`);
  const status = runGit(['status', '--porcelain']);
  if (status) throw new Error('Repository dirty. Bersihkan perubahan dulu sebelum unattended run.');
  return { branch, head: runGit(['rev-parse', 'HEAD']) };
}

export function validateWorker(command) {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !ALLOWED_WORKERS.has(parts[0])) throw new Error('Worker tidak diizinkan. Gunakan kilo/opencode/aider/codex.');
  if (PAID_MARKERS.test(command) && process.env.VITANUSA_ALLOW_PAID !== '1') throw new Error('Paid fallback ditolak. Set VITANUSA_ALLOW_PAID=1 hanya dengan izin eksplisit.');
  return parts;
}

export function changedPaths() {
  const output = runGit(['status', '--porcelain']);
  return output.split('\n').filter(Boolean).map((line) => line.slice(3)).filter(Boolean);
}

export function checkAllowedPaths(paths, allowed) {
  if (!allowed.length) return true;
  return paths.every((p) => allowed.some((rule) => p === rule || p.startsWith(`${rule}/`)));
}

function saveState(state) {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

export function main(argv = process.argv.slice(2)) {
  const execute = argv.includes('--execute');
  const taskId = argv.find((x) => x.startsWith('--task='))?.slice(7) ?? null;
  const repo = assertRepositoryReady();
  const tasks = loadTasks();
  let task = taskId ? tasks.find((t) => t.id === taskId) : selectTask(tasks);
  if (!task) throw new Error('Tidak ada task READY yang eligible.');
  if (task.status !== 'READY') throw new Error(`${task.id} tidak READY.`);

  const previous = readState();
  if (previous?.status === 'RUNNING' && previous.taskId !== task.id) throw new Error(`Masih ada task aktif: ${previous.taskId}`);

  const branch = `agent/${task.id.toLowerCase()}-${task.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'work'}`;
  const report = { taskId: task.id, state: execute ? 'CLAIMED' : 'PLAN', baseCommit: repo.head, branch, changedPaths: [], tests: [], stopReason: null };

  if (!execute) return report;

  if (runGit(['branch', '--list', branch])) {
    throw new Error(`Branch ${branch} sudah ada. Jangan membuat branch duplikat.`);
  }
  runGit(['switch', '-c', branch]);
  saveState({ taskId: task.id, branch, status: 'RUNNING', baseCommit: repo.head, startedAt: new Date().toISOString() });

  const workerCommand = process.env.VITANUSA_WORKER_CMD || 'kilo --auto';
  const worker = validateWorker(workerCommand);
  const workerResult = spawnSync(worker[0], worker.slice(1), { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (workerResult.status !== 0) {
    report.state = 'BLOCKED'; report.stopReason = `worker exit ${workerResult.status}`;
    saveState({ ...report, status: 'BLOCKED' });
    return report;
  }

  const paths = changedPaths();
  report.changedPaths = paths;
  if (!checkAllowedPaths(paths, task.allowedPaths)) {
    report.state = 'BLOCKED'; report.stopReason = 'changed-file scope melewati allowedPaths';
    saveState({ ...report, status: 'BLOCKED' });
    return report;
  }

  for (const command of task.tests) {
    const parts = command.split(/\s+/).filter(Boolean);
    const result = spawnSync(parts[0], parts.slice(1), { cwd: ROOT, stdio: 'inherit', env: process.env });
    report.tests.push({ command, exitCode: result.status });
    if (result.status !== 0) {
      report.state = 'BLOCKED'; report.stopReason = `test gagal: ${command}`;
      saveState({ ...report, status: 'BLOCKED' });
      return report;
    }
  }

  const diffCheck = spawnSync('git', ['diff', '--check'], { cwd: ROOT, stdio: 'inherit' });
  if (diffCheck.status !== 0) {
    report.state = 'BLOCKED'; report.stopReason = 'git diff --check gagal';
    saveState({ ...report, status: 'BLOCKED' });
    return report;
  }

  report.state = 'DRAFT_PR_READY';
  report.headCommit = runGit(['rev-parse', 'HEAD']);
  saveState({ ...report, status: 'DRAFT_PR_READY', completedAt: new Date().toISOString() });
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(main(), null, 2));
  } catch (error) {
    console.error(`STOP: ${error.message}`);
    process.exitCode = 2;
  }
}
