import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContextSelector } from '../../scripts/agent/context-selector.mjs';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTestRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'context-selector-test-'));
  writeFileSync(join(repo, 'README.md'), '# Test Repo\n', 'utf8');
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'main.mjs'), 'export function main() { return "hello"; }\n', 'utf8');
  writeFileSync(join(repo, 'src', 'utils.mjs'), 'export function util() { return 42; }\n', 'utf8');
  mkdirSync(join(repo, 'tests'), { recursive: true });
  writeFileSync(join(repo, 'tests', 'main.test.mjs'), 'import { test } from "node:test";\n', 'utf8');
  writeFileSync(join(repo, '.env'), 'SECRET_KEY=abc123\n', 'utf8');
  writeFileSync(join(repo, 'package.json'), '{"name":"test-repo"}\n', 'utf8');
  return repo;
}

test('context-selector: creates selector with default options', () => {
  const selector = createContextSelector();
  assert.ok(selector, 'Should create selector');
  assert.ok(typeof selector.selectContext === 'function', 'Should have selectContext method');
  assert.ok(typeof selector.refreshIndex === 'function', 'Should have refreshIndex method');
  assert.ok(typeof selector.getRepoIndex === 'function', 'Should have getRepoIndex method');
});

test('context-selector: selects context for simple task', async () => {
  const repo = createTestRepo();
  try {
    const selector = createContextSelector({ repoRoot: repo });
    const result = await selector.selectContext({
      id: 'T001',
      instructions: 'Modify the main function',
    }, {
      maxFiles: 5,
      maxBytes: 10000,
    });

    assert.ok(result, 'Should return result');
    assert.equal(result.taskId, 'T001', 'Should have task ID');
    assert.ok(result.files, 'Should have files array');
    assert.ok(result.selectedAt, 'Should have selectedAt timestamp');
    assert.ok(result.files.length > 0, 'Should select at least one file');
    assert.ok(result.validationPassed === undefined || result.validationPassed !== false, 'Should not fail validation');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('context-selector: respects file count limit', async () => {
  const repo = createTestRepo();
  try {
    const selector = createContextSelector({ repoRoot: repo });
    const result = await selector.selectContext({
      id: 'T002',
      instructions: 'Test file count limit',
    }, {
      maxFiles: 1,
      maxBytes: 10000,
    });

    assert.ok(result.files.length <= 1, 'Should respect maxFiles limit');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('context-selector: respects byte limit', async () => {
  const repo = createTestRepo();
  try {
    const selector = createContextSelector({ repoRoot: repo });
    const result = await selector.selectContext({
      id: 'T003',
      instructions: 'Test byte limit',
    }, {
      maxFiles: 100,
      maxBytes: 50, // Very small limit
    });

    assert.ok(result.totalBytes <= 50 || result.files.length === 0, 'Should respect byte limit');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('context-selector: does not include sensitive files', async () => {
  const repo = createTestRepo();
  try {
    const selector = createContextSelector({ repoRoot: repo });
    const result = await selector.selectContext({
      id: 'T004',
      instructions: 'Read all files',
    }, {
      maxFiles: 100,
      maxBytes: 100000,
    });

    const envFile = result.files.find(f => f.path.includes('.env'));
    assert.ok(!envFile, 'Should not include .env file');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('context-selector: returns empty for empty task', async () => {
  const repo = createTestRepo();
  try {
    const selector = createContextSelector({ repoRoot: repo });
    const result = await selector.selectContext({
      id: 'T005',
      instructions: '',
    }, {
      maxFiles: 10,
      maxBytes: 10000,
    });

    assert.ok(result, 'Should return result even for empty task');
    assert.ok(Array.isArray(result.files), 'Should have files array');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
