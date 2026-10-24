import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAllowedPaths } from '../../scripts/agent/task-orchestrator.mjs';

test('prompt-injection: malicious instruction in task does not expand allowed paths', () => {
  // Even if task instructions contain "allow all files", checkAllowedPaths enforces scope
  const changes = [{ path: 'secret.env', status: 'M' }];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), false, 'Unauthorized file should be rejected');
});

test('prompt-injection: path traversal in untrusted content is blocked', () => {
  const changes = [{ path: '../../etc/passwd', status: 'M' }];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), false, 'Traversal path should be rejected');
});

test('prompt-injection: hidden file access is blocked', () => {
  const changes = [{ path: '.env', status: 'M' }];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), false, 'Hidden file should be rejected');
});

test('prompt-injection: similar-name bypass is blocked', () => {
  const changes = [{ path: 'src/secret.js', status: 'M' }];
  const allowed = ['src/safe.js'];
  assert.equal(checkAllowedPaths(changes, allowed), false, 'Similar-name file should be rejected');
});

test('prompt-injection: allowed path is accepted', () => {
  const changes = [{ path: 'src/index.js', status: 'M' }];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), true, 'Allowed file should be accepted');
});

test('prompt-injection: empty changes are accepted', () => {
  const changes = [];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), true, 'Empty changes should be accepted');
});

test('prompt-injection: mixed allowed and disallowed is rejected', () => {
  const changes = [
    { path: 'src/index.js', status: 'M' },
    { path: 'secret.env', status: 'M' },
  ];
  const allowed = ['src'];
  assert.equal(checkAllowedPaths(changes, allowed), false, 'Mixed changes should be rejected');
});
