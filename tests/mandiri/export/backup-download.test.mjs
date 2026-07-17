import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBackupFilename,
  downloadBackupJson,
  sanitizeWorkspaceFilenamePart,
} from '../../../assets/js/mandiri/export/backup-download.js';
import { createValidBackup } from './fixtures.mjs';

test('filename menormalisasi workspace dan selalu memaksa extension JSON', () => {
  assert.equal(
    createBackupFilename('  Warung Maju  ', '2026-07-17T01:00:00.000Z'),
    'VitaNusa-Mandiri-Backup-Warung-Maju-2026-07-17.json',
  );
  assert.equal(createBackupFilename('data.json', '2026-07-17T01:00:00.000Z').endsWith('.json'), true);
});

test('slash, backslash, control, separator, dan reserved filename diamankan', () => {
  const sanitized = sanitizeWorkspaceFilenamePart('../Warung\\Maju:\u0000*?"<>|');
  assert.doesNotMatch(sanitized, /[\\/:*?"<>|\u0000-\u001f]/);
  assert.equal(sanitizeWorkspaceFilenamePart('..'), 'Workspace');
  assert.equal(sanitizeWorkspaceFilenamePart('CON'), 'Workspace');
  assert.equal(sanitizeWorkspaceFilenamePart(''), 'Workspace');
});

test('komponen nama dibatasi panjangnya', () => {
  assert.ok([...sanitizeWorkspaceFilenamePart('a'.repeat(200))].length <= 64);
});

test('download membuat Blob, klik anchor, dan selalu revoke object URL', async () => {
  const { backup } = await createValidBackup();
  const calls = [];
  const anchor = {
    hidden: false,
    click() { calls.push('click'); },
    remove() { calls.push('remove'); },
  };
  const documentRef = {
    body: { append(value) { assert.equal(value, anchor); calls.push('append'); } },
    createElement(tag) { assert.equal(tag, 'a'); return anchor; },
  };
  const URLRef = {
    createObjectURL(blob) { assert.equal(blob.type, 'application/json;charset=utf-8'); calls.push('create'); return 'blob:test'; },
    revokeObjectURL(url) { assert.equal(url, 'blob:test'); calls.push('revoke'); },
  };
  const result = downloadBackupJson({
    backup,
    workspaceName: 'Warung Maju',
    userInitiated: true,
    documentRef,
    URLRef,
    BlobCtor: Blob,
  });
  assert.match(result.filename, /^VitaNusa-Mandiri-Backup-/);
  assert.deepEqual(calls, ['create', 'append', 'click', 'remove', 'revoke']);
});

test('download tanpa tindakan pengguna ditolak sebelum membuat Blob', async () => {
  const { backup } = await createValidBackup();
  assert.throws(() => downloadBackupJson({ backup, workspaceName: 'A' }), {
    code: 'download_failed',
  });
});

test('modul download tidak memakai localStorage atau data URL', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../../../assets/js/mandiri/export/backup-download.js', import.meta.url),
    'utf8',
  ));
  assert.doesNotMatch(source, /localStorage|data:/);
});
