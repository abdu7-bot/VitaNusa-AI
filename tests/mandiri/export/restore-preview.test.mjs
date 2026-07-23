import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BACKUP_FILE_BYTES,
} from '../../../assets/js/mandiri/export/backup-schema.js';
import {
  previewBackupText,
  readBackupFile,
} from '../../../assets/js/mandiri/export/restore-preview.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  createValidBackup,
  fileFromText,
  resignBackup,
} from './fixtures.mjs';

function removeV6Collections(value) {
  for (const field of ['sales', 'saleLines', 'payments', 'receipts']) {
    delete value.recordCounts[field];
    delete value.data[field];
  }
}

test('file valid menghasilkan ringkasan tanpa identifier internal atau raw JSON', async () => {
  const { backup } = await createValidBackup();
  const preview = await previewBackupText({
    text: JSON.stringify(backup),
    expectedAccountScope: ACCOUNT_A,
  });
  assert.deepEqual(preview, {
    workspaceName: 'Warung Maju',
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
    workspaceStatus: 'active',
    membershipCount: 1,
    auditEventCount: 1,
    operationReceiptCount: 1,
    learningAttemptCount: 0,
    learningProgressCount: 0,
    categoryCount: 0,
    productCount: 0,
    stockMovementCount: 0,
    inventoryBalanceCount: 0,
    cartDraftCount: 0,
    cartLineCount: 0,
    createdAt: '2026-07-17T01:00:00.000Z',
    formatVersion: 6,
    databaseSchemaVersion: 6,
    checksumStatus: 'valid',
    scopeStatus: 'matched',
  });
  assert.doesNotMatch(JSON.stringify(preview), /accountScope|userScope|membershipId|eventId|operationId|payloadDigest/);
});

test('JSON rusak dan file kosong ditolak', async () => {
  await assert.rejects(previewBackupText({ text: '{', expectedAccountScope: ACCOUNT_A }), {
    code: 'json_invalid',
  });
  await assert.rejects(previewBackupText({ text: '', expectedAccountScope: ACCOUNT_A }), {
    code: 'backup_invalid',
  });
});

test('backup format version 1 tetap dapat dipreview tanpa operasi restore', async () => {
  const { backup } = await createValidBackup();
  const legacy = await resignBackup(backup, (value) => {
    value.formatVersion = 1;
    value.databaseSchemaVersion = 1;
    delete value.recordCounts.learningAttempts;
    delete value.recordCounts.learningProgress;
    delete value.data.learningAttempts;
    delete value.data.learningProgress;
    delete value.recordCounts.categories;
    delete value.recordCounts.products;
    delete value.data.categories;
    delete value.data.products;
    delete value.recordCounts.stockMovements;
    delete value.recordCounts.inventoryBalances;
    delete value.data.stockMovements;
    delete value.data.inventoryBalances;
    delete value.recordCounts.cartDrafts;
    delete value.recordCounts.cartLines;
    delete value.data.cartDrafts;
    delete value.data.cartLines;
    removeV6Collections(value);
  });
  const preview = await previewBackupText({
    text: JSON.stringify(legacy), expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.formatVersion, 1);
  assert.equal(preview.learningAttemptCount, 0);
  assert.equal(preview.learningProgressCount, 0);
});

test('file lebih dari 5 MiB ditolak sebelum file.text dipanggil', async () => {
  let read = false;
  await assert.rejects(readBackupFile({
    file: {
      size: MAX_BACKUP_FILE_BYTES + 1,
      async text() { read = true; return '{}'; },
    },
    expectedAccountScope: ACCOUNT_A,
  }), { code: 'file_too_large' });
  assert.equal(read, false);
});

test('backup format version 2 tetap dapat dipreview tanpa operasi restore', async () => {
  const { backup } = await createValidBackup();
  const legacy = await resignBackup(backup, (value) => {
    value.formatVersion = 2;
    value.databaseSchemaVersion = 2;
    delete value.recordCounts.categories;
    delete value.recordCounts.products;
    delete value.data.categories;
    delete value.data.products;
    delete value.recordCounts.stockMovements;
    delete value.recordCounts.inventoryBalances;
    delete value.data.stockMovements;
    delete value.data.inventoryBalances;
    delete value.recordCounts.cartDrafts;
    delete value.recordCounts.cartLines;
    delete value.data.cartDrafts;
    delete value.data.cartLines;
    removeV6Collections(value);
  });
  const preview = await previewBackupText({
    text: JSON.stringify(legacy), expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.formatVersion, 2);
  assert.equal(preview.learningAttemptCount, 0);
  assert.equal(preview.categoryCount, 0);
  assert.equal(preview.productCount, 0);
});

test('backup format version 3 tetap dapat dipreview tanpa operasi restore', async () => {
  const { backup } = await createValidBackup();
  const legacy = await resignBackup(backup, (value) => {
    value.formatVersion = 3;
    value.databaseSchemaVersion = 3;
    delete value.recordCounts.stockMovements;
    delete value.recordCounts.inventoryBalances;
    delete value.data.stockMovements;
    delete value.data.inventoryBalances;
    delete value.recordCounts.cartDrafts;
    delete value.recordCounts.cartLines;
    delete value.data.cartDrafts;
    delete value.data.cartLines;
    removeV6Collections(value);
  });
  const preview = await previewBackupText({
    text: JSON.stringify(legacy), expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.formatVersion, 3);
  assert.equal(preview.categoryCount, 0);
  assert.equal(preview.stockMovementCount, 0);
  assert.equal(preview.inventoryBalanceCount, 0);
});

test('backup format version 4 tetap dapat dipreview tanpa operasi restore', async () => {
  const { backup } = await createValidBackup();
  const legacy = await resignBackup(backup, (value) => {
    value.formatVersion = 4;
    value.databaseSchemaVersion = 4;
    delete value.recordCounts.cartDrafts;
    delete value.recordCounts.cartLines;
    delete value.data.cartDrafts;
    delete value.data.cartLines;
    removeV6Collections(value);
  });
  const preview = await previewBackupText({
    text: JSON.stringify(legacy), expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.formatVersion, 4);
  assert.equal(preview.stockMovementCount, 0);
  assert.equal(preview.cartDraftCount, 0);
  assert.equal(preview.cartLineCount, 0);
});

test('backup format version 5 tetap dapat dipreview tanpa operasi restore', async () => {
  const { backup } = await createValidBackup();
  const legacy = await resignBackup(backup, (value) => {
    value.formatVersion = 5;
    value.databaseSchemaVersion = 5;
    removeV6Collections(value);
  });
  const preview = await previewBackupText({
    text: JSON.stringify(legacy), expectedAccountScope: ACCOUNT_A,
  });
  assert.equal(preview.formatVersion, 5);
  assert.equal(preview.cartDraftCount, 0);
});

test('format, formatVersion, dan databaseSchemaVersion tidak didukung ditolak', async () => {
  const { backup } = await createValidBackup();
  const cases = [
    [(value) => { value.format = 'other'; }, 'format_unknown'],
    [(value) => { value.formatVersion = 7; }, 'format_version_unsupported'],
    [(value) => { value.databaseSchemaVersion = 7; }, 'schema_version_unsupported'],
  ];
  for (const [mutate, code] of cases) {
    const invalid = await resignBackup(backup, mutate);
    await assert.rejects(previewBackupText({
      text: JSON.stringify(invalid),
      expectedAccountScope: ACCOUNT_A,
    }), { code });
  }
});

test('scope akun berbeda ditolak tanpa bypass', async () => {
  const { backup } = await createValidBackup();
  await assert.rejects(previewBackupText({
    text: JSON.stringify(backup),
    expectedAccountScope: ACCOUNT_B,
  }), { code: 'scope_mismatch' });
});

test('perubahan data tanpa checksum baru ditolak sebagai checksum mismatch', async () => {
  const { backup } = await createValidBackup();
  const tampered = structuredClone(backup);
  tampered.data.workspaces[0].name = 'Nama berubah';
  await assert.rejects(previewBackupText({
    text: JSON.stringify(tampered),
    expectedAccountScope: ACCOUNT_A,
  }), { code: 'checksum_mismatch' });
});

test('unknown field, dangerous key, duplicate ID, dan count palsu ditolak', async () => {
  const { backup } = await createValidBackup();
  const unknown = await resignBackup(backup, (value) => { value.extra = true; });
  await assert.rejects(previewBackupText({ text: JSON.stringify(unknown), expectedAccountScope: ACCOUNT_A }), {
    code: 'backup_invalid',
  });
  const dangerousText = JSON.stringify(backup).replace(
    '"recordCounts":{',
    '"__proto__":{"admin":true},"recordCounts":{',
  );
  await assert.rejects(previewBackupText({ text: dangerousText, expectedAccountScope: ACCOUNT_A }), {
    code: 'dangerous_key',
  });
  const duplicate = await resignBackup(backup, (value) => {
    value.data.memberships.push(structuredClone(value.data.memberships[0]));
    value.recordCounts.memberships = 2;
  });
  await assert.rejects(previewBackupText({ text: JSON.stringify(duplicate), expectedAccountScope: ACCOUNT_A }), {
    code: 'integrity_error',
  });
  const wrongCount = await resignBackup(backup, (value) => { value.recordCounts.auditEvents = 2; });
  await assert.rejects(previewBackupText({ text: JSON.stringify(wrongCount), expectedAccountScope: ACCOUNT_A }), {
    code: 'integrity_error',
  });
});

test('invalid membership, audit, receipt, dan workspace mismatch ditolak', async () => {
  const { backup } = await createValidBackup();
  const cases = [
    (value) => { value.data.memberships[0].role = 'platform_admin'; },
    (value) => { value.data.auditEvents[0].result = 'unknown'; },
    (value) => { value.data.operationReceipts[0].payloadDigest = 'sha256:bad'; },
    (value) => { value.data.workspaces[0].workspaceId = 'workspace_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; },
  ];
  for (const mutate of cases) {
    const invalid = await resignBackup(backup, mutate);
    await assert.rejects(previewBackupText({
      text: JSON.stringify(invalid),
      expectedAccountScope: ACCOUNT_A,
    }), (error) => ['backup_invalid', 'integrity_error'].includes(error.code));
  }
});

test('preview tidak menulis storage atau melakukan network request', async () => {
  const { backup } = await createValidBackup();
  let writes = 0;
  let network = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { network += 1; throw new Error('unexpected'); };
  try {
    const file = fileFromText(JSON.stringify(backup));
    await readBackupFile({ file, expectedAccountScope: ACCOUNT_A });
    assert.equal(writes, 0);
    assert.equal(network, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('input backup tidak dimutasi selama preview', async () => {
  const { backup } = await createValidBackup();
  const text = JSON.stringify(backup);
  const snapshot = structuredClone(backup);
  await previewBackupText({ text, expectedAccountScope: ACCOUNT_A });
  assert.deepEqual(backup, snapshot);
});
