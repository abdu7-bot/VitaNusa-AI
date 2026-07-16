import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMembershipTransition,
  createMembershipRecord,
  normalizeMembership,
} from '../../../assets/js/mandiri/domain/membership.js';

const WORKSPACE_A = 'workspace_11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = 'workspace_22222222-2222-4222-8222-222222222222';
const MEMBERSHIP_A = 'membership_33333333-3333-4333-8333-333333333333';

function membership(overrides = {}) {
  return {
    membershipId: MEMBERSHIP_A,
    accountScope: 'account_scope_a',
    workspaceId: WORKSPACE_A,
    userScope: 'user_scope_a',
    role: 'merchant_owner',
    status: 'active',
    createdAtLocal: '2026-07-16T10:00:00.000Z',
    updatedAtLocal: '2026-07-16T10:00:00.000Z',
    ...overrides,
  };
}

test('merchant owner valid', () => {
  const record = createMembershipRecord(membership());
  assert.equal(record.role, 'merchant_owner');
  assert.equal(Object.isFrozen(record), true);
});

test('cashier valid', () => {
  assert.equal(normalizeMembership(membership({ role: 'cashier' })).role, 'cashier');
});

test('platform owner ditolak sebagai role workspace', () => {
  assert.throws(() => normalizeMembership(membership({ role: 'platform_owner' })), {
    code: 'unknown_workspace_role',
  });
});

test('platform admin ditolak sebagai role workspace', () => {
  assert.throws(() => normalizeMembership(membership({ role: 'platform_admin' })), {
    code: 'unknown_workspace_role',
  });
});

test('role tidak dikenal ditolak', () => {
  assert.throws(() => normalizeMembership(membership({ role: 'manager' })), {
    code: 'unknown_workspace_role',
  });
});

test('membership inactive valid', () => {
  assert.equal(normalizeMembership(membership({ status: 'inactive' })).status, 'inactive');
});

test('status membership tidak dikenal ditolak', () => {
  assert.throws(() => normalizeMembership(membership({ status: 'invited' })), {
    code: 'unknown_membership_status',
  });
});

test('membership lintas workspace ditolak', () => {
  assert.throws(() => normalizeMembership(membership(), { workspaceId: WORKSPACE_B }), {
    code: 'cross_workspace_scope',
  });
});

test('membership lintas accountScope ditolak', () => {
  assert.throws(() => normalizeMembership(membership(), { accountScope: 'account_scope_b' }), {
    code: 'cross_account_scope',
  });
});

test('self-promotion cashier menjadi owner ditolak', () => {
  const current = membership({ role: 'cashier' });
  const next = membership({
    role: 'merchant_owner',
    updatedAtLocal: '2026-07-16T10:00:01.000Z',
  });
  assert.throws(() => assertMembershipTransition({
    actor: current,
    currentMembership: current,
    nextMembership: next,
    activeOwnerCount: 1,
  }), { code: 'self_promotion_denied' });
});

test('owner terakhir tidak dapat diturunkan', () => {
  const current = membership();
  const next = membership({
    role: 'cashier',
    updatedAtLocal: '2026-07-16T10:00:01.000Z',
  });
  assert.throws(() => assertMembershipTransition({
    actor: current,
    currentMembership: current,
    nextMembership: next,
    activeOwnerCount: 1,
  }), { code: 'owner_transfer_required' });
});

test('owner dapat menurunkan owner lain bila owner aktif lebih dari satu', () => {
  const actor = membership({ userScope: 'owner_scope_a' });
  const current = membership({ userScope: 'owner_scope_b' });
  const next = membership({
    userScope: 'owner_scope_b',
    role: 'cashier',
    updatedAtLocal: '2026-07-16T10:00:01.000Z',
  });
  assert.equal(assertMembershipTransition({
    actor,
    currentMembership: current,
    nextMembership: next,
    activeOwnerCount: 2,
  }), true);
});

test('transisi membership lintas workspace dan account ditolak', () => {
  const actor = membership({ userScope: 'owner_scope_a' });
  assert.throws(() => assertMembershipTransition({
    actor,
    currentMembership: membership({ userScope: 'cashier_scope_a' }),
    nextMembership: membership({
      userScope: 'cashier_scope_a',
      workspaceId: WORKSPACE_B,
      updatedAtLocal: '2026-07-16T10:00:01.000Z',
    }),
    activeOwnerCount: 2,
  }), { code: 'scope_mismatch' });
  assert.throws(() => assertMembershipTransition({
    actor,
    currentMembership: membership({ userScope: 'cashier_scope_a' }),
    nextMembership: membership({
      userScope: 'cashier_scope_a',
      accountScope: 'account_scope_b',
      updatedAtLocal: '2026-07-16T10:00:01.000Z',
    }),
    activeOwnerCount: 2,
  }), { code: 'scope_mismatch' });
});

test('field tambahan membership ditolak dan input tidak dimutasi', () => {
  assert.throws(() => normalizeMembership(membership({ token: 'not-a-real-token' })), {
    code: 'unknown_field',
  });
  const input = membership();
  const snapshot = structuredClone(input);
  const record = normalizeMembership(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(record, input);
});
