import { webcrypto } from 'node:crypto';
import { createPayloadDigest } from '../../../assets/js/mandiri/domain/ids.js';
import { createBackupService } from '../../../assets/js/mandiri/export/backup.js';
import { createBackupChecksumPayload } from '../../../assets/js/mandiri/export/backup-schema.js';
import { createMemoryRepositories } from '../../../assets/js/mandiri/repositories/memory-repositories.js';
import { createWorkspaceService } from '../../../assets/js/mandiri/services/workspace-service.js';

export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
export const ACCOUNT_A = `account:${HASH_A}`;
export const ACCOUNT_B = `account:${HASH_B}`;
export const USER_A = `user:${HASH_A}`;
export const USER_B = `user:${HASH_B}`;
export const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
export const WORKSPACE_B = 'workspace_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const MEMBERSHIP_A = 'membership_22222222-2222-4222-8222-222222222222';
export const AUDIT_A = 'audit_33333333-3333-4333-8333-333333333333';
export const OPERATION_A = 'op_44444444-4444-4444-8444-444444444444';
export const CREATED_AT = '2026-07-17T00:00:00.000Z';
export const BACKUP_CREATED_AT = '2026-07-17T01:00:00.000Z';

export const digest = (payload) => createPayloadDigest(payload, webcrypto);

export function createWorkspaceDependencies({ suffix = 'a', createdAt = CREATED_AT } = {}) {
  const ids = {
    workspace: suffix === 'a'
      ? WORKSPACE_A
      : 'workspace_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    membership: suffix === 'a'
      ? MEMBERSHIP_A
      : 'membership_cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    audit: suffix === 'a'
      ? AUDIT_A
      : 'audit_dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  };
  return {
    idFactory: (prefix) => ids[prefix],
    operationIdFactory: () => suffix === 'a'
      ? OPERATION_A
      : 'op_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    payloadDigest: digest,
    now: () => createdAt,
  };
}

export async function seedMemoryWorkspace({
  accountScope = ACCOUNT_A,
  userScope = USER_A,
  name = 'Warung Maju',
} = {}) {
  const memory = createMemoryRepositories();
  const workspaceService = createWorkspaceService({
    repositoryContext: memory.repositoryContext,
    ...createWorkspaceDependencies(),
  });
  const command = workspaceService.prepareCreateWorkspaceCommand({
    accountScope,
    userScope,
    name,
    timezone: 'Asia/Jakarta',
    currencyCode: 'IDR',
  });
  await workspaceService.createWorkspace(command);
  const backupService = createBackupService({
    repositoryContext: memory.repositoryContext,
    digestFactory: digest,
    now: () => BACKUP_CREATED_AT,
  });
  return { backupService, command, memory, workspaceService };
}

export async function createValidBackup(options) {
  const fixture = await seedMemoryWorkspace(options);
  const backup = await fixture.backupService.createWorkspaceBackup({
    accountScope: fixture.command.accountScope,
    workspaceId: fixture.command.workspaceId,
  });
  return { ...fixture, backup };
}

export async function resignBackup(backup, mutate = () => {}) {
  const copy = structuredClone(backup);
  mutate(copy);
  copy.checksum = await digest(createBackupChecksumPayload(copy));
  return copy;
}

export function fileFromText(text, overrides = {}) {
  return {
    size: new TextEncoder().encode(text).byteLength,
    async text() {
      return text;
    },
    ...overrides,
  };
}
