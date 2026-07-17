import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerformWorkspaceAction } from '../../../assets/js/mandiri/domain/permissions.js';
import { createAccountScopeFromUser } from '../../../assets/js/mandiri/services/account-scope.js';
import { previewBackupText } from '../../../assets/js/mandiri/export/restore-preview.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  createValidBackup,
  WORKSPACE_A,
} from '../export/fixtures.mjs';

test('akun A dapat ekspor workspace A dan akun B ditolak', async () => {
  const { backup, backupService } = await createValidBackup();
  assert.equal(backup.accountScope, ACCOUNT_A);
  await assert.rejects(backupService.createWorkspaceBackup({
    accountScope: ACCOUNT_B,
    workspaceId: WORKSPACE_A,
  }), { code: 'workspace_not_found' });
});

test('file akun A ditolak saat expected scope akun B', async () => {
  const { backup } = await createValidBackup();
  await assert.rejects(previewBackupText({
    text: JSON.stringify(backup),
    expectedAccountScope: ACCOUNT_B,
  }), { code: 'scope_mismatch' });
});

test('email sama tidak menjadi bypass accountScope', async () => {
  const first = await createAccountScopeFromUser({ uid: 'uid-a', email: 'same@example.com' });
  const second = await createAccountScopeFromUser({ uid: 'uid-b', email: 'same@example.com' });
  assert.notEqual(first, second);
});

test('platform admin dan platform owner tidak menjadi merchant owner', () => {
  const context = { accountScope: ACCOUNT_A, workspaceId: WORKSPACE_A };
  for (const role of ['platform_admin', 'platform_owner']) {
    assert.equal(canPerformWorkspaceAction({
      accountScope: ACCOUNT_A,
      workspaceId: WORKSPACE_A,
      userScope: 'user:platform',
      role,
      status: 'active',
    }, 'workspace.update', context), false);
  }
});

test('unknown dan scope kosong ditolak sebelum repository transaction', async () => {
  const { backupService } = await createValidBackup();
  for (const accountScope of ['', 'unknown-account', undefined]) {
    await assert.rejects(backupService.createWorkspaceBackup({
      accountScope,
      workspaceId: WORKSPACE_A,
    }), { code: 'backup_invalid' });
  }
});
