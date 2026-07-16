import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  canonicalizePayload,
  createEntityId,
  createOperationGuard,
  createOperationId,
  createPayloadDigest,
  isValidEntityId,
} from '../../../assets/js/mandiri/domain/ids.js';

test('entity ID dibuat dengan prefix valid', () => {
  const id = createEntityId('workspace', webcrypto);
  assert.equal(isValidEntityId(id, 'workspace'), true);
});

test('operation ID dibuat', () => {
  const id = createOperationId(webcrypto);
  assert.equal(isValidEntityId(id, 'op'), true);
});

test('ID unik pada sample yang wajar', () => {
  const ids = new Set(Array.from({ length: 256 }, () => createEntityId('entity', webcrypto)));
  assert.equal(ids.size, 256);
});

test('prefix divalidasi', () => {
  assert.throws(() => createEntityId('', webcrypto), { code: 'invalid_id_prefix' });
  assert.throws(() => createEntityId('Workspace', webcrypto), { code: 'invalid_id_prefix' });
  assert.throws(() => createEntityId('contains_underscore', webcrypto), {
    code: 'invalid_id_prefix',
  });
});

test('invalid ID ditolak', () => {
  assert.equal(isValidEntityId('workspace-invalid'), false);
  assert.equal(isValidEntityId('workspace_11111111-1111-1111-1111-111111111111'), false);
  assert.equal(isValidEntityId(createEntityId('workspace', webcrypto), 'membership'), false);
});

test('canonicalization stabil terhadap urutan key', () => {
  assert.equal(
    canonicalizePayload({ b: 2, a: { d: 4, c: 3 } }),
    canonicalizePayload({ a: { c: 3, d: 4 }, b: 2 }),
  );
});

test('urutan key tidak mengubah digest', async () => {
  const first = await createPayloadDigest({ amount: 15000, item: 'beras' }, webcrypto);
  const second = await createPayloadDigest({ item: 'beras', amount: 15000 }, webcrypto);
  assert.equal(first, second);
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
});

test('urutan array mengubah digest', async () => {
  const first = await createPayloadDigest({ ids: ['a', 'b'] }, webcrypto);
  const second = await createPayloadDigest({ ids: ['b', 'a'] }, webcrypto);
  assert.notEqual(first, second);
});

test('function dan tipe unsupported ditolak', () => {
  assert.throws(() => canonicalizePayload({ calculate() {} }), {
    code: 'unsupported_payload_type',
  });
  assert.throws(() => canonicalizePayload({ value: 1n }), {
    code: 'unsupported_payload_type',
  });
});

test('prototype berbahaya dan key prototype ditolak', () => {
  const inherited = Object.create({ role: 'merchant_owner' });
  inherited.safe = true;
  assert.throws(() => canonicalizePayload(inherited), { code: 'invalid_record' });
  assert.throws(() => canonicalizePayload(JSON.parse('{"__proto__":{"admin":true}}')), {
    code: 'unsafe_payload_field',
  });
  assert.throws(() => canonicalizePayload({ constructor: 'override' }), {
    code: 'unsafe_payload_field',
  });
});

test('payload dengan credential field ditolak', () => {
  assert.throws(() => canonicalizePayload({ accessToken: 'not-a-real-token' }), {
    code: 'unsafe_payload_field',
  });
});

test('duplicate operation dengan payload sama dikenali', async () => {
  const guard = createOperationGuard({
    digest: (payload) => createPayloadDigest(payload, webcrypto),
  });
  const operationId = createOperationId(webcrypto);
  const first = await guard.check(operationId, { action: 'workspace.create', version: 1 });
  const duplicate = await guard.check(operationId, { version: 1, action: 'workspace.create' });
  assert.equal(first.status, 'accepted');
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.duplicate, true);
  assert.equal(guard.size, 1);
});

test('operation ID sama dengan payload berbeda ditolak', async () => {
  const guard = createOperationGuard({
    digest: (payload) => createPayloadDigest(payload, webcrypto),
  });
  const operationId = createOperationId(webcrypto);
  await guard.register(operationId, { name: 'Workspace A' });
  await assert.rejects(
    guard.register(operationId, { name: 'Workspace B' }),
    { code: 'idempotency_mismatch' },
  );
});

test('fallback ID hanya memakai crypto.getRandomValues', () => {
  let calls = 0;
  let next = 0;
  const fallbackCrypto = {
    getRandomValues(bytes) {
      calls += 1;
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = next % 256;
        next += 1;
      }
      return bytes;
    },
  };
  const first = createEntityId('entity', fallbackCrypto);
  const second = createEntityId('entity', fallbackCrypto);
  assert.equal(isValidEntityId(first, 'entity'), true);
  assert.equal(isValidEntityId(second, 'entity'), true);
  assert.notEqual(first, second);
  assert.equal(calls, 2);
});

test('source ID tidak memakai Math.random atau Date.now', async () => {
  const source = await readFile(
    new URL('../../../assets/js/mandiri/domain/ids.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /Math\.random|Date\.now/);
  assert.match(source, /randomUUID/);
  assert.match(source, /getRandomValues/);
});
