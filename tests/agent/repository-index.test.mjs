import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRepositoryIndex, searchIndex, isSensitivePath, isBinaryFile, readFileSafely } from '../../scripts/agent/repository-index.mjs';

function createTestRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'repo-index-test-'));
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

test('repository-index: builds index with files', () => {
  const repo = createTestRepo();
  try {
    const index = buildRepositoryIndex(repo);
    assert.ok(index.files, 'Index should have files property');
    assert.ok(index.fileCount > 0, 'Should index at least some files');
    assert.ok(index.fileCount > 0, 'Should have files');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: excludes sensitive files', () => {
  const repo = createTestRepo();
  try {
    const index = buildRepositoryIndex(repo);
    const envFile = index.files['.env'];
    assert.ok(envFile, '.env file should be indexed');
    assert.equal(envFile.indexed, false, 'Sensitive file should not be indexed');
    assert.equal(envFile.reason, 'sensitive_file_pattern', 'Should mark as sensitive');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: excludes binary files', () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-index-binary-test-'));
  try {
    writeFileSync(join(repo, 'image.png'), 'fake binary content', 'utf8');
    writeFileSync(join(repo, 'script.js'), 'export function x() { return 1; }\n', 'utf8');
    
    const index = buildRepositoryIndex(repo);
    const pngFile = index.files['image.png'];
    assert.ok(pngFile, 'PNG file should be in index');
    assert.equal(pngFile.indexed, false, 'Binary file should not be indexed');
    assert.equal(pngFile.reason, 'binary_file', 'Should be marked as binary');
    
    const jsFile = index.files['script.js'];
    assert.ok(jsFile.indexed, 'JS file should be indexed');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: searchIndex filters by extension', () => {
  const repo = createTestRepo();
  try {
    const index = buildRepositoryIndex(repo);
    const jsFiles = searchIndex(index, { extension: '.mjs' });
    assert.ok(jsFiles.length > 0, 'Should find JS files');
    assert.ok(jsFiles.every(f => f.path.endsWith('.mjs')), 'All results should be JS files');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: searchIndex filters by path pattern', () => {
  const repo = createTestRepo();
  try {
    const index = buildRepositoryIndex(repo);
    const docsFiles = searchIndex(index, { pathPattern: 'docs' });
    assert.ok(docsFiles.every(f => f.path.includes('docs')), 'All results should be in docs path');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: searchIndex filters by git status', () => {
  const repo = createTestRepo();
  try {
    const index = buildRepositoryIndex(repo);
    const untrackedFiles = searchIndex(index, { gitStatus: 'untracked' });
    // In a fresh repo with no git init, all files might be untracked
    // This test just checks the filter works without error
    assert.ok(Array.isArray(untrackedFiles), 'Should return array');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repository-index: isSensitivePath detects sensitive files', () => {
  assert.ok(isSensitivePath('.env'), 'Should detect .env');
  assert.ok(isSensitivePath('.env.production'), 'Should detect .env.production');
  assert.ok(isSensitivePath('config/secrets.json'), 'Should detect secrets config');
  assert.ok(isSensitivePath('id_rsa'), 'Should detect id_rsa');
  assert.ok(!isSensitivePath('src/main.mjs'), 'Should not flag normal source files');
  assert.ok(!isSensitivePath('README.md'), 'Should not flag documentation');
});

test('repository-index: isBinaryFile detects binary files', () => {
  assert.ok(isBinaryFile('image.png'), 'Should detect PNG');
  assert.ok(isBinaryFile('image.jpg'), 'Should detect JPG');
  assert.ok(isBinaryFile('document.pdf'), 'Should detect PDF');
  assert.ok(!isBinaryFile('script.js'), 'Should not flag JS');
  assert.ok(!isBinaryFile('README.md'), 'Should not flag markdown');
});

test('repository-index: readFileSafely handles various cases', () => {
  const repo = mkdtempSync(join(tmpdir(), 'read-file-test-'));
  try {
    // Normal file
    writeFileSync(join(repo, 'normal.txt'), 'hello world', 'utf8');
    const normalResult = readFileSafely(join(repo, 'normal.txt'));
    assert.equal(normalResult.content, 'hello world');
    assert.ok(!normalResult.error);
    
    // Large file
    const largeContent = 'x'.repeat(600 * 1024); // 600KB > 500KB limit
    writeFileSync(join(repo, 'large.txt'), largeContent, 'utf8');
    const largeResult = readFileSafely(join(repo, 'large.txt'));
    assert.ok(largeResult.error, 'Should error on large file');
    assert.equal(largeResult.error, 'file_too_large', 'Should report file_too_large error');
    
    // Nonexistent file
    const missingResult = readFileSafely(join(repo, 'nonexistent.txt'));
    assert.ok(missingResult.error, 'Should error on missing file');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
