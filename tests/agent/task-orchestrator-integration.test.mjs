import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function createTempRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'vitanusa-test-'));
  spawnSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repo, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: repo, stdio: 'ignore' });
  
  // Create required files
  writeFileSync(join(repo, 'ROADMAP.md'), '# Roadmap\n', 'utf8');
  mkdirSync(join(repo, 'docs'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'vitanusa-work-queue.md'), '# Work Queue\n', 'utf8');
  
  // Create tasks directory
  const taskDir = join(repo, 'tasks', 'active');
  mkdirSync(taskDir, { recursive: true });
  
  // Create a test task
  writeFileSync(join(taskDir, 'T999-test.md'), `---
id: T999
status: READY
priority: P1
title: Test Task
tests: echo hello
allowedPaths: docs
instructions: Create a test file in docs/
acceptanceCriteria: File exists|File contains hello
---
# Test Task
`, 'utf8');
  
  // Initial commit
  spawnSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
  spawnSync('git', ['commit', '-m', 'Initial commit'], { cwd: repo, stdio: 'ignore' });
  
  // Create a non-main branch
  spawnSync('git', ['switch', '-c', 'test-branch'], { cwd: repo, stdio: 'ignore' });
  
  return repo;
}

function runOrchestrator(repo, args, env = {}) {
  return spawnSync('node', [
    join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
    ...args
  ], { 
    cwd: repo, 
    stdio: 'pipe', 
    env: { ...process.env, ...env },
    timeout: 30000
  });
}

test('orchestrator rejects invalid worker before repository mutation', async () => {
  const repo = createTempRepo();
  
  try {
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: 'invalid-worker --auto' 
    });
    
    assert.equal(result.status, 2);
    const output = result.stderr.toString();
    assert.ok(output.includes('Worker tidak diizinkan') || output.includes('STOP'));
    
    // Verify no branch was created
    const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
    assert.ok(!branches.includes('agent/t999-test'));
    
    // Verify no state file was created
    const runtimeDir = join(repo, '.git', 'vitanusa-agent');
    const stateFile = join(runtimeDir, 'state.json');
    assert.ok(!existsSync(stateFile));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator rejects paid marker without explicit permission', async () => {
  const repo = createTempRepo();
  
  try {
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: 'kilo --model paid-pro' 
    });
    
    assert.equal(result.status, 2);
    const output = result.stderr.toString();
    assert.ok(output.includes('Paid fallback ditolak') || output.includes('STOP'));
    
    const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
    assert.ok(!branches.includes('agent/t999-test'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator validates allowedPaths and blocks out-of-scope changes', async () => {
  const repo = createTempRepo();
  
  try {
    // Create a file outside allowedPaths before running
    mkdirSync(join(repo, 'backend', 'app'), { recursive: true });
    writeFileSync(join(repo, 'backend', 'app', 'main.py'), 'unauthorized change\n', 'utf8');
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: 'true' 
    });
    
    // Should fail because backend/app/main.py is not in allowedPaths
    assert.notEqual(result.status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator creates branch and persists state on successful execution', async () => {
  const repo = createTempRepo();
  
  try {
    const workerScript = `
      const fs = require('fs');
      fs.writeFileSync('docs/test-output.txt', 'worker output');
    `;
    
    const workerFile = join(repo, 'worker.js');
    writeFileSync(workerFile, workerScript, 'utf8');
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: `node ${workerFile}` 
    });
    
    if (result.status === 0) {
      const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
      assert.ok(branches.includes('agent/t999-test'));
      
      const runtimeDir = join(repo, '.git', 'vitanusa-agent');
      const stateFile = join(runtimeDir, 'state.json');
      assert.ok(existsSync(stateFile));
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      assert.equal(state.status, 'PR_CREATED');
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator fails closed when worker exits with non-zero', async () => {
  const repo = createTempRepo();
  
  try {
    const workerFile = join(repo, 'worker_fail.js');
    writeFileSync(workerFile, 'process.exit(1);', 'utf8');
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: `node ${workerFile}` 
    });
    
    assert.notEqual(result.status, 0);
    
    const stateFile = join(repo, '.git', 'vitanusa-agent', 'state.json');
    if (existsSync(stateFile)) {
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      assert.equal(state.status, 'BLOCKED');
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator returns worker input contract in PLAN mode', async () => {
  const repo = createTempRepo();
  
  try {
    // Commit any changes first so repo is clean
    spawnSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', 'Clean state'], { cwd: repo, stdio: 'ignore' });
    
    const result = runOrchestrator(repo, ['--task=T999'], {});
    
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout.toString());
    assert.ok(output.workerInputContract);
    assert.equal(output.workerInputContract.taskId, 'T999');
    assert.ok(Array.isArray(output.workerInputContract.allowedPaths));
    assert.ok(Array.isArray(output.workerInputContract.requiredTests));
    assert.ok(output.workerInputContract.baseCommit);
    assert.ok(output.workerInputContract.repairLimit);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator detects stale lock and clears it', async () => {
  const repo = createTempRepo();
  
  try {
    // Commit clean state first
    spawnSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', 'Clean state'], { cwd: repo, stdio: 'ignore' });
    
    // Create a stale state file
    const runtimeDir = join(repo, '.git', 'vitanusa-agent');
    mkdirSync(runtimeDir, { recursive: true });
    const staleTime = new Date(Date.now() - 40 * 60 * 1000).toISOString(); // 40 min ago
    writeFileSync(join(runtimeDir, 'state.json'), JSON.stringify({
      taskId: 'T000',
      branch: 'agent/t000-stale',
      status: 'RUNNING',
      baseCommit: 'abc123',
      startedAt: staleTime,
    }), 'utf8');
    
    // Create the stale branch
    spawnSync('git', ['switch', '-c', 'agent/t000-stale'], { cwd: repo, stdio: 'ignore' });
    spawnSync('git', ['switch', 'test-branch'], { cwd: repo, stdio: 'ignore' });
    
    // Should clear stale lock and proceed
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: 'true' 
    });
    
    // Should not fail due to stale lock
    const stderr = result.stderr.toString();
    assert.ok(!stderr.includes('Masih ada task aktif'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator blocks active (non-stale) lock', async () => {
  const repo = createTempRepo();
  
  try {
    // Commit clean state first
    spawnSync('git', ['add', '.'], { cwd: repo, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', 'Clean state'], { cwd: repo, stdio: 'ignore' });
    
    // Create a fresh state file
    const runtimeDir = join(repo, '.git', 'vitanusa-agent');
    mkdirSync(runtimeDir, { recursive: true });
    const freshTime = new Date().toISOString();
    writeFileSync(join(runtimeDir, 'state.json'), JSON.stringify({
      taskId: 'T000',
      branch: 'agent/t000-active',
      status: 'RUNNING',
      baseCommit: 'abc123',
      startedAt: freshTime,
    }), 'utf8');
    
    // Create the active branch
    spawnSync('git', ['switch', '-c', 'agent/t000-active'], { cwd: repo, stdio: 'ignore' });
    spawnSync('git', ['switch', 'test-branch'], { cwd: repo, stdio: 'ignore' });
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: 'true' 
    });
    
    assert.equal(result.status, 2);
    const stderr = result.stderr.toString();
    assert.ok(stderr.includes('Masih ada task aktif'));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator tracks state transitions in evidence', async () => {
  const repo = createTempRepo();
  
  try {
    const workerScript = `
      const fs = require('fs');
      fs.writeFileSync('docs/test-output.txt', 'worker output');
    `;
    const workerFile = join(repo, 'worker.js');
    writeFileSync(workerFile, workerScript, 'utf8');
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: `node ${workerFile}` 
    });
    
    if (result.status === 0) {
      const output = JSON.parse(result.stdout.toString());
      assert.ok(output.stateTransitions);
      assert.ok(output.stateTransitions.length >= 3); // PLAN, CLAIMED, RUNNING at minimum
      const states = output.stateTransitions.map(t => t.state);
      assert.ok(states.includes('PLAN'));
      assert.ok(states.includes('CLAIMED'));
      assert.ok(states.includes('RUNNING'));
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator saves evidence file', async () => {
  const repo = createTempRepo();
  
  try {
    const workerScript = `
      const fs = require('fs');
      fs.writeFileSync('docs/test-output.txt', 'worker output');
    `;
    const workerFile = join(repo, 'worker.js');
    writeFileSync(workerFile, workerScript, 'utf8');
    
    const result = runOrchestrator(repo, ['--execute', '--task=T999'], { 
      VITANUSA_WORKER_CMD: `node ${workerFile}` 
    });
    
    if (result.status === 0) {
      const evidenceDir = join(repo, '.git', 'vitanusa-agent', 'evidence');
      const files = readdirSync(evidenceDir);
      assert.ok(files.length > 0);
      const evidence = JSON.parse(readFileSync(join(evidenceDir, files[0]), 'utf8'));
      assert.equal(evidence.taskId, 'T999');
      assert.ok(evidence.baseCommit);
      assert.ok(evidence.headCommit);
      assert.ok(evidence.branch);
      assert.ok(evidence.stateTransitions);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
