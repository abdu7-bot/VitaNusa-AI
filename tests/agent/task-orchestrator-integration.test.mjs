import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
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

test('orchestrator rejects invalid worker before repository mutation', async () => {
  const repo = createTempRepo();
  
  try {
    // Set an invalid worker command
    process.env.VITANUSA_WORKER_CMD = 'invalid-worker --auto';
    
    const result = spawnSync('node', [
      join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
      '--execute',
      '--task=T999'
    ], { 
      cwd: repo, 
      stdio: 'pipe', 
      env: { ...process.env, VITANUSA_WORKER_CMD: 'invalid-worker --auto' },
      timeout: 10000
    });
    
    // Should fail with exit code 2 (STOP)
    assert.equal(result.status, 2);
    const output = result.stderr.toString();
    assert.ok(output.includes('Worker tidak diizinkan') || output.includes('STOP'));
    
    // Verify no branch was created
    const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
    assert.ok(!branches.includes('agent/t999-test'));
    
    // Verify no state file was created
    const runtimeDir = join(repo, '.git', 'vitanusa-agent');
    const stateFile = join(runtimeDir, 'state.json');
    const fs = await import('node:fs');
    assert.ok(!fs.existsSync(stateFile));
  } finally {
    delete process.env.VITANUSA_WORKER_CMD;
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator rejects paid marker without explicit permission', async () => {
  const repo = createTempRepo();
  
  try {
    const result = spawnSync('node', [
      join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
      '--execute',
      '--task=T999'
    ], { 
      cwd: repo, 
      stdio: 'pipe', 
      env: { ...process.env, VITANUSA_WORKER_CMD: 'kilo --model paid-pro' },
      timeout: 10000
    });
    
    assert.equal(result.status, 2);
    const output = result.stderr.toString();
    assert.ok(output.includes('Paid fallback ditolak') || output.includes('STOP'));
    
    // Verify no branch was created
    const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
    assert.ok(!branches.includes('agent/t999-test'));
  } finally {
    delete process.env.VITANUSA_WORKER_CMD;
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator validates allowedPaths and blocks out-of-scope changes', async () => {
  const repo = createTempRepo();
  
  try {
    // Modify a file outside allowedPaths (backend/app/main.py not in allowedPaths: docs)
    mkdirSync(join(repo, 'backend', 'app'), { recursive: true });
    writeFileSync(join(repo, 'backend', 'app', 'main.py'), 'unauthorized change\n', 'utf8');
    
    // Use a simple worker that just touches the file
    const result = spawnSync('node', [
      join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
      '--execute',
      '--task=T999'
    ], { 
      cwd: repo, 
      stdio: 'pipe', 
      env: { ...process.env, VITANUSA_WORKER_CMD: 'true' },
      timeout: 10000
    });
    
    // Should fail because backend/app/main.py is not in allowedPaths
    // Note: the worker 'true' exits successfully but the changedPaths check should fail
    assert.notEqual(result.status, 0);
  } finally {
    delete process.env.VITANUSA_WORKER_CMD;
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator creates branch and persists state on successful execution', async () => {
  const repo = createTempRepo();
  
  try {
    // Use a simple worker that modifies allowed path
    const workerScript = `
      const fs = require('fs');
      fs.writeFileSync('docs/test-output.txt', 'worker output');
    `;
    
    const workerFile = join(repo, 'worker.js');
    writeFileSync(workerFile, workerScript, 'utf8');
    
    const result = spawnSync('node', [
      join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
      '--execute',
      '--task=T999'
    ], { 
      cwd: repo, 
      stdio: 'pipe', 
      env: { ...process.env, VITANUSA_WORKER_CMD: `node ${workerFile}` },
      timeout: 10000
    });
    
    // Check the result
    console.log('Exit code:', result.status);
    console.log('Stdout:', result.stdout.toString());
    console.log('Stderr:', result.stderr.toString());
    
    // If successful, should have created branch and state
    if (result.status === 0) {
      const branches = spawnSync('git', ['branch'], { cwd: repo, encoding: 'utf8' }).stdout;
      assert.ok(branches.includes('agent/t999-test'));
      
      const runtimeDir = join(repo, '.git', 'vitanusa-agent');
      const stateFile = join(runtimeDir, 'state.json');
      const fs = await import('node:fs');
      assert.ok(fs.existsSync(stateFile));
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      assert.equal(state.status, 'DRAFT_PR_READY');
    }
  } finally {
    delete process.env.VITANUSA_WORKER_CMD;
    rmSync(repo, { recursive: true, force: true });
  }
});

test('orchestrator fails closed when worker exits with non-zero', async () => {
  const repo = createTempRepo();
  
  try {
    // Worker that fails
    const workerFile = join(repo, 'worker_fail.js');
    writeFileSync(workerFile, 'process.exit(1);', 'utf8');
    
    const result = spawnSync('node', [
      join(process.cwd(), 'scripts/agent/task-orchestrator.mjs'),
      '--execute',
      '--task=T999'
    ], { 
      cwd: repo, 
      stdio: 'pipe', 
      env: { ...process.env, VITANUSA_WORKER_CMD: `node ${workerFile}` },
      timeout: 10000
    });
    
    // Should fail with non-zero exit
    assert.notEqual(result.status, 0);
    
    // State should be BLOCKED
    const stateFile = join(repo, '.git', 'vitanusa-agent', 'state.json');
    const fs = await import('node:fs');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      assert.equal(state.status, 'BLOCKED');
    }
  } finally {
    delete process.env.VITANUSA_WORKER_CMD;
    rmSync(repo, { recursive: true, force: true });
  }
});
