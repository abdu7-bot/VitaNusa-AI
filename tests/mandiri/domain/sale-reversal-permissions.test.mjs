import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPerformWorkspaceAction,
  WORKSPACE_ACTIONS,
} from '../../../assets/js/mandiri/domain/permissions.js';

const WORKSPACE = 'workspace_11111111-1111-4111-8111-111111111111';

function actor(overrides = {}) {
  return {
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE,
    userScope: 'user_scope_owner',
    role: 'merchant_owner',
    status: 'active',
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE,
    ...overrides,
  };
}

test('sale.void adalah action terdaftar dan hanya owner aktif yang diizinkan', () => {
  assert.equal(WORKSPACE_ACTIONS.includes('sale.void'), true);
  assert.equal(canPerformWorkspaceAction(actor(), 'sale.void', context()), true);
  assert.equal(canPerformWorkspaceAction(actor({ role: 'cashier' }), 'sale.void', context()), false);
  assert.equal(canPerformWorkspaceAction(actor({ status: 'inactive' }), 'sale.void', context()), false);
});

test('sale.void menolak actor lintas account atau workspace', () => {
  assert.equal(canPerformWorkspaceAction(actor(), 'sale.void', context({
    accountScope: 'account_scope_b',
  })), false);
  assert.equal(canPerformWorkspaceAction(actor(), 'sale.void', context({
    workspaceId: 'workspace_22222222-2222-4222-8222-222222222222',
  })), false);
});
