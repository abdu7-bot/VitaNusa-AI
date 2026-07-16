import { isValidEntityId } from './ids.js';
import {
  assertExactFields,
  MandiriDomainError,
  normalizeIsoTimestamp,
  normalizePositiveVersion,
  normalizeScope,
} from './validation.js';

export const WORKSPACE_ROLES = Object.freeze(['merchant_owner', 'cashier']);
export const MEMBERSHIP_STATUSES = Object.freeze(['active', 'inactive']);

const MEMBERSHIP_FIELDS = Object.freeze([
  'schemaVersion',
  'version',
  'membershipId',
  'accountScope',
  'workspaceId',
  'userScope',
  'role',
  'status',
  'createdAtLocal',
  'updatedAtLocal',
]);
const REQUIRED_MEMBERSHIP_FIELDS = Object.freeze([
  'membershipId',
  'accountScope',
  'workspaceId',
  'userScope',
  'role',
  'status',
  'createdAtLocal',
  'updatedAtLocal',
]);

export function isWorkspaceRole(value) {
  return WORKSPACE_ROLES.includes(value);
}

export function isMembershipStatus(value) {
  return MEMBERSHIP_STATUSES.includes(value);
}

function normalizeMembershipId(value) {
  if (!isValidEntityId(value, 'membership')) {
    throw new MandiriDomainError(
      'invalid_membership_id',
      'membershipId tidak valid',
      'membership.membershipId',
    );
  }
  return value;
}

function normalizeWorkspaceId(value) {
  if (!isValidEntityId(value, 'workspace')) {
    throw new MandiriDomainError(
      'invalid_workspace_id',
      'workspaceId tidak valid',
      'membership.workspaceId',
    );
  }
  return value;
}

export function normalizeMembership(input, expectedScope = {}) {
  assertExactFields(input, MEMBERSHIP_FIELDS, {
    requiredFields: REQUIRED_MEMBERSHIP_FIELDS,
    path: 'membership',
  });

  const accountScope = normalizeScope(input.accountScope, 'membership.accountScope');
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  if (expectedScope.accountScope !== undefined && accountScope !== expectedScope.accountScope) {
    throw new MandiriDomainError('cross_account_scope', 'membership berada pada accountScope lain');
  }
  if (expectedScope.workspaceId !== undefined && workspaceId !== expectedScope.workspaceId) {
    throw new MandiriDomainError('cross_workspace_scope', 'membership berada pada workspace lain');
  }
  if (!isWorkspaceRole(input.role)) {
    throw new MandiriDomainError('unknown_workspace_role', 'role workspace tidak dikenal', 'membership.role');
  }
  if (!isMembershipStatus(input.status)) {
    throw new MandiriDomainError(
      'unknown_membership_status',
      'status membership tidak dikenal',
      'membership.status',
    );
  }

  const createdAtLocal = normalizeIsoTimestamp(input.createdAtLocal, 'membership.createdAtLocal');
  const updatedAtLocal = normalizeIsoTimestamp(input.updatedAtLocal, 'membership.updatedAtLocal');
  if (updatedAtLocal < createdAtLocal) {
    throw new MandiriDomainError(
      'invalid_timestamp_order',
      'updatedAtLocal tidak boleh lebih awal dari createdAtLocal',
      'membership.updatedAtLocal',
    );
  }

  return Object.freeze({
    schemaVersion: normalizePositiveVersion(
      Object.hasOwn(input, 'schemaVersion') ? input.schemaVersion : 1,
      'membership.schemaVersion',
    ),
    version: normalizePositiveVersion(
      Object.hasOwn(input, 'version') ? input.version : 1,
      'membership.version',
    ),
    membershipId: normalizeMembershipId(input.membershipId),
    accountScope,
    workspaceId,
    userScope: normalizeScope(input.userScope, 'membership.userScope'),
    role: input.role,
    status: input.status,
    createdAtLocal,
    updatedAtLocal,
  });
}

export function validateMembership(input, expectedScope) {
  normalizeMembership(input, expectedScope);
  return true;
}

export function createMembershipRecord(input, expectedScope) {
  return normalizeMembership(input, expectedScope);
}

function roleRank(role) {
  return role === 'merchant_owner' ? 2 : 1;
}

function sameMembershipScope(left, right) {
  return left.accountScope === right.accountScope && left.workspaceId === right.workspaceId;
}

export function assertMembershipTransition({
  actor,
  currentMembership,
  nextMembership,
  activeOwnerCount,
}) {
  const normalizedActor = normalizeMembership(actor);
  const current = normalizeMembership(currentMembership);
  const next = normalizeMembership(nextMembership);

  if (!sameMembershipScope(normalizedActor, current) || !sameMembershipScope(current, next)) {
    throw new MandiriDomainError('scope_mismatch', 'perubahan membership lintas scope ditolak');
  }
  if (
    current.membershipId !== next.membershipId
    || current.userScope !== next.userScope
  ) {
    throw new MandiriDomainError('membership_identity_changed', 'identitas membership tidak boleh berubah');
  }
  if (
    normalizedActor.userScope === current.userScope
    && roleRank(next.role) > roleRank(current.role)
  ) {
    throw new MandiriDomainError('self_promotion_denied', 'pengguna tidak boleh menaikkan role sendiri');
  }
  if (normalizedActor.status !== 'active' || normalizedActor.role !== 'merchant_owner') {
    throw new MandiriDomainError('role_denied', 'hanya merchant_owner aktif yang dapat mengubah membership');
  }

  const removesActiveOwner = (
    current.role === 'merchant_owner'
    && current.status === 'active'
    && (next.role !== 'merchant_owner' || next.status !== 'active')
  );
  if (removesActiveOwner) {
    if (!Number.isSafeInteger(activeOwnerCount) || activeOwnerCount < 1) {
      throw new MandiriDomainError(
        'active_owner_count_required',
        'jumlah owner aktif wajib tersedia untuk perubahan owner',
      );
    }
    if (activeOwnerCount <= 1) {
      throw new MandiriDomainError(
        'owner_transfer_required',
        'owner terakhir harus ditransfer sebelum dinonaktifkan atau diturunkan',
      );
    }
  }

  return true;
}
