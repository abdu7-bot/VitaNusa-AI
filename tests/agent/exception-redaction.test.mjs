import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive } from '../../scripts/agent/task-orchestrator.mjs';

test('exception redaction: API key in error message is redacted', () => {
  const errorMessage = 'Error: Failed to connect with api_key: sk-1234567890abcdef1234567890abcdef';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('sk-1234567890abcdef1234567890abcdef'), 'API key in error message should be redacted');
});

test('exception redaction: GitHub PAT in error message is redacted', () => {
  const errorMessage = 'Error: Authentication failed with token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'), 'GitHub PAT in error message should be redacted');
});

test('exception redaction: bearer token in error message is redacted', () => {
  const errorMessage = 'Error: bearer: secrettoken123 failed';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('secrettoken123'), 'Bearer token in error message should be redacted');
});

test('exception redaction: password in error message is redacted', () => {
  const errorMessage = 'Error: Login failed with password=mysecretpassword123';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('mysecretpassword123'), 'Password in error message should be redacted');
});

test('exception redaction: nested exception with secret is redacted', () => {
  const errorMessage = 'Error: Caused by: api_key: sk-abcdef1234567890abcdef1234567890abcdef';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('sk-abcdef1234567890abcdef1234567890abcdef'), 'API key in nested exception should be redacted');
});

test('exception redaction: multiple secrets in one message', () => {
  const errorMessage = 'Error: api_key: sk-111111111111111111111111111111 and token: ghp_222222222222222222222222222222 failed';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('sk-111111111111111111111111111111'), 'First API key should be redacted');
  assert.ok(!result.includes('ghp_222222222222222222222222222222'), 'Second token should be redacted');
});

test('exception redaction: access token URL in error message', () => {
  const errorMessage = 'Error: Connect to https://x-access-token:secret123@github.com/repo failed';
  const result = redactSensitive(errorMessage);
  assert.ok(!result.includes('secret123'), 'Access token in URL should be redacted');
  assert.ok(result.includes('[REDACTED]'), 'Should contain redaction marker');
});

test('exception redaction: non-secret error message is preserved', () => {
  const errorMessage = 'Error: File not found: src/config.json';
  const result = redactSensitive(errorMessage);
  assert.equal(result, errorMessage, 'Non-secret error message should be preserved');
});

test('exception redaction: empty string is safe', () => {
  const result = redactSensitive('');
  assert.equal(result, '', 'Empty string should be preserved');
});

test('exception redaction: non-string input is safe', () => {
  assert.equal(redactSensitive(null), null);
  assert.equal(redactSensitive(undefined), undefined);
  assert.equal(redactSensitive(42), 42);
});

test('exception redaction: malformed input does not crash', () => {
  // Test with various edge cases that could crash redaction
  const inputs = [null, undefined, '', '   ', 'secret', 'SECRET', 'Secret', 'Api_Key: test'];
  for (const input of inputs) {
    const result = redactSensitive(input);
    assert.ok(typeof result === 'string' || result === null || result === undefined, `Result should be string/null/undefined for input: ${input}`);
  }
});
