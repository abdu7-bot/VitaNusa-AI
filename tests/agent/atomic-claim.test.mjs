import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { atomicClaim, releaseClaim } from '../../scripts/agent/task-orchestrator.mjs';
import { writeFileSync } from 'node:fs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ac-'));
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@test.com');
  git(dir, 'config', 'user.name', 'Test');
  mkdirSync(join(dir, '.git', 'vitanusa-agent'), { recursive: true });
  return dir;
}

test('claim: first claim succeeds', () => {
  const dir = setupRepo();
  const paths = { RUNTIME_DIR: join(dir, '.git', 'vitanusa-agent') };
  const result = atomicClaim(paths, 'T001', 'worker-1');
  assert.equal(result.success, true);
  rmSync(dir, { recursive: true, force: true });
});

test('claim: duplicate claim fails', () => {
  const dir = setupRepo();
  const paths = { RUNTIME_DIR: join(dir, '.git', 'vitanusa-agent') };
  atomicClaim(paths, 'T001', 'worker-1');
  const result2 = atomicClaim(paths, 'T001', 'worker-2');
  assert.equal(result2.success, false);
  assert.match(result2.reason, /already claimed/i);
  rmSync(dir, { recursive: true, force: true });
});

test('claim: release allows re-claim', () => {
  const dir = setupRepo();
  const paths = { RUNTIME_DIR: join(dir, '.git', 'vitanusa-agent') };
  atomicClaim(paths, 'T001', 'worker-1');
  releaseClaim(paths, 'T001');
  const result2 = atomicClaim(paths, 'T001', 'worker-2');
  assert.equal(result2.success, true);
  rmSync(dir, { recursive: true, force: true });
});

test('claim: stale claim is recoverable', async () => {
  const dir = setupRepo();
  const paths = { RUNTIME_DIR: join(dir, '.git', 'vitanusa-agent') };
  // Create a stale lock file manually
  writeFileSync(join(paths.RUNTIME_DIR, 'claim-T001.lock'), JSON.stringify({
    taskId: 'T001', workerId: 'old-worker',
    claimedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  }));
  const result = atomicClaim(paths, 'T001', 'new-worker');
  assert.equal(result.success, true);
  assert.equal(result.stale, true);
  rmSync(dir, { recursive: true, force: true });
});
