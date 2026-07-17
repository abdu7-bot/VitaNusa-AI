import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BACKUP_FILE_BYTES } from '../../../assets/js/mandiri/export/backup-schema.js';
import { previewBackupText, readBackupFile } from '../../../assets/js/mandiri/export/restore-preview.js';
import {
  ACCOUNT_A,
  createValidBackup,
  resignBackup,
} from '../export/fixtures.mjs';

async function expectInvalid(backup, mutate, codes = ['backup_invalid', 'integrity_error']) {
  const invalid = await resignBackup(backup, mutate);
  await assert.rejects(previewBackupText({
    text: JSON.stringify(invalid),
    expectedAccountScope: ACCOUNT_A,
  }), (error) => codes.includes(error.code));
}

test('dangerous __proto__, constructor, dan prototype ditolak', async () => {
  const { backup } = await createValidBackup();
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const text = JSON.stringify(backup).replace(
      '"recordCounts":{',
      `"${key}":{"admin":true},"recordCounts":{`,
    );
    await assert.rejects(previewBackupText({ text, expectedAccountScope: ACCOUNT_A }), {
      code: 'dangerous_key',
    });
  }
});

test('markup dan script pada nama tetap string data dan tidak dieksekusi', async () => {
  globalThis.__mandiriScriptExecuted = false;
  const { backup } = await createValidBackup({ name: '<script>globalThis.__mandiriScriptExecuted=true</script>' });
  const preview = await previewBackupText({
    text: JSON.stringify(backup),
    expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.workspaceName, '<script>globalThis.__mandiriScriptExecuted=true</script>');
  assert.equal(globalThis.__mandiriScriptExecuted, false);
  delete globalThis.__mandiriScriptExecuted;
});

test('invalid role, status, digest, duplicate ID, dan count mismatch ditolak', async () => {
  const { backup } = await createValidBackup();
  await expectInvalid(backup, (value) => { value.data.memberships[0].role = 'platform_admin'; });
  await expectInvalid(backup, (value) => { value.data.workspaces[0].status = 'deleted'; });
  await expectInvalid(backup, (value) => { value.data.operationReceipts[0].payloadDigest = 'invalid'; });
  await expectInvalid(backup, (value) => {
    value.data.auditEvents.push(structuredClone(value.data.auditEvents[0]));
    value.recordCounts.auditEvents = 2;
  }, ['integrity_error']);
  await expectInvalid(backup, (value) => { value.recordCounts.memberships = 99; }, ['integrity_error']);
});

test('checksum palsu dan input terlalu dalam ditolak', async () => {
  const { backup } = await createValidBackup();
  const tampered = structuredClone(backup);
  tampered.checksum = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(previewBackupText({
    text: JSON.stringify(tampered),
    expectedAccountScope: ACCOUNT_A,
  }), { code: 'checksum_mismatch' });

  let nested = '{}';
  for (let index = 0; index < 40; index += 1) nested = `{"next":${nested}}`;
  await assert.rejects(previewBackupText({ text: nested, expectedAccountScope: ACCOUNT_A }), {
    code: 'dangerous_key',
  });
});

test('file di atas batas ditolak tanpa dibaca', async () => {
  let reads = 0;
  await assert.rejects(readBackupFile({
    file: {
      size: MAX_BACKUP_FILE_BYTES + 1,
      async text() { reads += 1; return '{}'; },
    },
    expectedAccountScope: ACCOUNT_A,
  }), { code: 'file_too_large' });
  assert.equal(reads, 0);
});
