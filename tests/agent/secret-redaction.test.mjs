import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive } from '../../scripts/agent/task-orchestrator.mjs';

test('redaction: API key patterns are redacted', () => {
  const input = 'api_key: sk-1234567890abcdef1234567890abcdef';
  const result = redactSensitive(input);
  assert.ok(!result.includes('sk-1234567890abcdef1234567890abcdef'), 'API key should be redacted');
});

test('redaction: GitHub PAT patterns are redacted', () => {
  const input = 'token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
  const result = redactSensitive(input);
  assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'), 'GitHub PAT should be redacted');
});

test('redaction: bearer tokens are redacted', () => {
  const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
  const result = redactSensitive(input);
  assert.ok(!result.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'), 'Bearer token should be redacted');
});

test('redaction: access-token URLs are redacted', () => {
  const input = 'https://x-access-token:secret123@github.com/repo';
  const result = redactSensitive(input);
  assert.ok(!result.includes('secret123'), 'Access token should be redacted');
  assert.ok(result.includes('[REDACTED]'), 'Should contain redaction marker');
});

test('redaction: non-secret content is preserved', () => {
  const input = 'This is a normal log message without secrets';
  const result = redactSensitive(input);
  assert.equal(result, input, 'Non-secret content should be preserved');
});

test('redaction: handles non-string input', () => {
  assert.equal(redactSensitive(42), 42);
  assert.equal(redactSensitive(null), null);
});

test('redaction: authorization header with colon is redacted', () => {
  const input = 'authorization: Bearer abc123def456';
  const result = redactSensitive(input);
  assert.ok(!result.includes('abc123def456'), 'Authorization value should be redacted');
});

test('redaction: password pattern is redacted', () => {
  const input = 'password=mysecretpassword123';
  const result = redactSensitive(input);
  assert.ok(!result.includes('mysecretpassword123'), 'Password should be redacted');
});
