import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerformWorkspaceAction } from '../../../assets/js/mandiri/domain/permissions.js';

const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';

function actor(overrides = {}) {
  return {
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE_A,
    userScope: 'user_scope_a',
    role: 'merchant_owner',
    status: 'active',
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE_A,
    ...overrides,
  };
}

function target(overrides = {}) {
  return {
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE_A,
    userScope: 'target_scope_a',
    role: 'cashier',
    status: 'active',
    ...overrides,
  };
}

test('owner membaca workspace', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'workspace.read', context()), true);
});

test('owner memperbarui workspace', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'workspace.update', context()), true);
});

test('cashier membaca workspace dasar', () => {
  assert.equal(canPerformWorkspaceAction(actor({ role: 'cashier' }), 'workspace.read', context()), true);
});

test('cashier tidak memperbarui workspace', () => {
  assert.equal(canPerformWorkspaceAction(actor({ role: 'cashier' }), 'workspace.update', context()), false);
});

test('cashier tidak mengelola anggota', () => {
  const cashier = actor({ role: 'cashier' });
  assert.equal(canPerformWorkspaceAction(cashier, 'member.create', context()), false);
  assert.equal(canPerformWorkspaceAction(cashier, 'member.update', context({ target: target() })), false);
  assert.equal(canPerformWorkspaceAction(cashier, 'member.change_role', context({
    target: target({ userScope: cashier.userScope }),
    nextRole: 'merchant_owner',
  })), false);
});

test('cashier hanya membaca membership sendiri', () => {
  const cashier = actor({ role: 'cashier' });
  assert.equal(canPerformWorkspaceAction(cashier, 'member.read', context({
    target: target({ userScope: cashier.userScope }),
  })), true);
  assert.equal(canPerformWorkspaceAction(cashier, 'member.read', context({ target: target() })), false);
});

test('platform admin tidak menjadi owner workspace', () => {
  assert.equal(canPerformWorkspaceAction(actor({ role: 'platform_admin' }), 'workspace.update', context()), false);
  assert.equal(canPerformWorkspaceAction(actor({ role: 'platform_owner' }), 'workspace.update', context()), false);
});

test('inactive actor ditolak', () => {
  assert.equal(canPerformWorkspaceAction(actor({ status: 'inactive' }), 'workspace.read', context()), false);
});

test('unknown action ditolak', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'workspace.delete', context()), false);
});

test('unknown role ditolak', () => {
  assert.equal(canPerformWorkspaceAction(actor({ role: 'manager' }), 'workspace.read', context()), false);
});

test('cross-account ditolak', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'workspace.read', context({
    accountScope: 'account_scope_b',
  })), false);
  assert.equal(canPerformWorkspaceAction(actor(), 'member.read', context({
    target: target({ accountScope: 'account_scope_b' }),
  })), false);
});

test('cross-workspace ditolak', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'workspace.read', context({
    workspaceId: WORKSPACE_B,
  })), false);
  assert.equal(canPerformWorkspaceAction(actor(), 'member.read', context({
    target: target({ workspaceId: WORKSPACE_B }),
  })), false);
});

test('self-role escalation ditolak', () => {
  const cashier = actor({ role: 'cashier' });
  assert.equal(canPerformWorkspaceAction(cashier, 'member.change_role', context({
    target: target({ userScope: cashier.userScope, role: 'cashier' }),
    nextRole: 'merchant_owner',
  })), false);
});

test('owner terakhir tidak dapat dinonaktifkan atau diturunkan', () => {
  const ownerTarget = target({ role: 'merchant_owner', status: 'active' });
  assert.equal(canPerformWorkspaceAction(actor(), 'member.deactivate', context({
    target: ownerTarget,
    activeOwnerCount: 1,
  })), false);
  assert.equal(canPerformWorkspaceAction(actor(), 'member.change_role', context({
    target: ownerTarget,
    nextRole: 'cashier',
    activeOwnerCount: 1,
  })), false);
});

test('owner mengelola anggota non-owner dan membaca audit', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'member.create', context()), true);
  assert.equal(canPerformWorkspaceAction(actor(), 'member.update', context({ target: target() })), true);
  assert.equal(canPerformWorkspaceAction(actor(), 'audit.read', context()), true);
});

test('produk dan kategori mengikuti policy existing owner-write member-read', () => {
  const owner = actor();
  const cashier = actor({ role: 'cashier' });
  for (const action of ['category.read', 'product.read']) {
    assert.equal(canPerformWorkspaceAction(owner, action, context()), true);
    assert.equal(canPerformWorkspaceAction(cashier, action, context()), true);
  }
  for (const action of ['category.update', 'product.update']) {
    assert.equal(canPerformWorkspaceAction(owner, action, context()), true);
    assert.equal(canPerformWorkspaceAction(cashier, action, context()), false);
  }
});
