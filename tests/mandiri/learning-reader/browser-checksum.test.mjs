import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import {
  createBrowserSha256,
  getUtf8ByteLength,
} from '../../../assets/js/mandiri/learning/data/browser-checksum.js';
import { contentBytes, manifestInput } from './fixtures.mjs';

test('SHA-256 browser cocok dengan Node crypto dan format manifest', async () => {
  const expected = `sha256:${createHash('sha256').update(contentBytes).digest('hex')}`;
  assert.equal(await createBrowserSha256(contentBytes, webcrypto), expected);
  assert.equal(expected, manifestInput.contentSha256);
  assert.match(expected, /^sha256:[a-f0-9]{64}$/u);
});

test('perubahan satu byte menghasilkan checksum berbeda', async () => {
  const changed = new Uint8Array(contentBytes);
  changed[0] ^= 1;
  assert.notEqual(
    await createBrowserSha256(changed, webcrypto),
    await createBrowserSha256(contentBytes, webcrypto),
  );
});

test('input checksum tidak dimutasi', async () => {
  const input = new Uint8Array([1, 2, 3]);
  const before = [...input];
  await createBrowserSha256(input, webcrypto);
  assert.deepEqual([...input], before);
});

test('Web Crypto yang tidak tersedia gagal aman', async () => {
  await assert.rejects(createBrowserSha256(new Uint8Array([1]), {}), {
    code: 'checksum_unavailable',
  });
});

test('byte length memakai UTF-8, bukan panjang karakter', () => {
  assert.equal(getUtf8ByteLength('Rp10.000'), 8);
  assert.equal(getUtf8ByteLength('é'), 2);
});
