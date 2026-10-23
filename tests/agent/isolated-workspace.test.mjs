import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createIsolatedWorkspace, getWorkspaceDiff, cleanupWorkspace, validatePath } from '../../scripts/agent/isolated-workspace.mjs';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'iso-'));
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@test.com');
  git(dir, 'config', 'user.name', 'Test');
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'app.mjs'), 'export const app = true;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'init');
  return dir;
}

test('workspace: creates isolated copy', async () => {
  const src = setupRepo();
  const ws = createIsolatedWorkspace(src, 'T001');
  assert.ok(ws.includes('vitanusa-ws-'));
  assert.ok(fs.existsSync(join(ws, 'src', 'app.mjs')));
  cleanupWorkspace(ws);
  rmSync(src, { recursive: true, force: true });
});

test('workspace: cleanup removes only workspace', async () => {
  const src = setupRepo();
  const ws = createIsolatedWorkspace(src, 'T001');
  cleanupWorkspace(ws);
  assert.ok(!fs.existsSync(ws));
  assert.ok(fs.existsSync(src));
  rmSync(src, { recursive: true, force: true });
});

test('workspace: cleanup rejects non-workspace path', () => {
  assert.throws(() => cleanupWorkspace('/tmp/not-a-workspace'), /Refusing to clean/i);
});

test('validatePath: rejects absolute paths', () => {
  assert.equal(validatePath('/etc/passwd'), false);
});

test('validatePath: rejects path traversal', () => {
  assert.equal(validatePath('../secret.txt'), false);
  assert.equal(validatePath('src/../../etc/passwd'), false);
});

test('validatePath: rejects .git paths', () => {
  assert.equal(validatePath('.git/config'), false);
  assert.equal(validatePath('.git'), false);
});

test('validatePath: rejects sensitive files', () => {
  assert.equal(validatePath('config/secret.json'), false);
  assert.equal(validatePath('keys/token.txt'), false);
  assert.equal(validatePath('.env'), false);
});

test('validatePath: accepts valid paths', () => {
  assert.equal(validatePath('src/app.mjs'), true);
  assert.equal(validatePath('src/utils/helper.js'), true);
});

test('workspace: getWorkspaceDiff detects changes', () => {
  const src = setupRepo();
  const ws = createIsolatedWorkspace(src, 'T001');
  const baseCommit = git(ws, 'rev-parse', 'HEAD');
  writeFileSync(join(ws, 'src', 'new.mjs'), 'export const x = 1;\n');
  const changes = getWorkspaceDiff(ws, baseCommit);
  assert.ok(changes.some(c => c.path === 'src/new.mjs'));
  cleanupWorkspace(ws);
  rmSync(src, { recursive: true, force: true });
});
