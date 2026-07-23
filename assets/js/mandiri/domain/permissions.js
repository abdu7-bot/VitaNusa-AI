import {
  isMembershipStatus,
  isWorkspaceRole,
} from './membership.js';
import { isValidEntityId } from './ids.js';
import {
  isPlainRecord,
  isValidScope,
} from './validation.js';

export const WORKSPACE_ACTIONS = Object.freeze([
  'workspace.read',
  'workspace.update',
  'workspace.archive',
  'member.read',
  'member.create',
  'member.update',
  'member.deactivate',
  'member.change_role',
  'audit.read',
  'category.read',
  'category.update',
  'product.read',
  'product.update',
  'cart.read',
  'cart.update',
  'inventory.read',
  'inventory.update',
  'sale.create',
]);

const OWNER_ACTIONS = new Set(WORKSPACE_ACTIONS);
const MEMBER_MUTATION_ACTIONS = new Set([
  'member.update',
  'member.deactivate',
  'member.change_role',
]);

function isValidContext(context) {
  return (
    isPlainRecord(context)
    && isValidScope(context.accountScope)
    && isValidEntityId(context.workspaceId, 'workspace')
  );
}

function isValidActor(actor, context) {
  return (
    isPlainRecord(actor)
    && isValidScope(actor.accountScope)
    && isValidEntityId(actor.workspaceId, 'workspace')
    && isValidScope(actor.userScope)
    && isWorkspaceRole(actor.role)
    && isMembershipStatus(actor.status)
    && actor.status === 'active'
    && actor.accountScope === context.accountScope
    && actor.workspaceId === context.workspaceId
  );
}

function isTargetInScope(target, context) {
  if (!isPlainRecord(target)) return false;
  if (target.accountScope !== context.accountScope || target.workspaceId !== context.workspaceId) {
    return false;
  }
  if (target.userScope !== undefined && !isValidScope(target.userScope)) return false;
  if (target.role !== undefined && !isWorkspaceRole(target.role)) return false;
  if (target.status !== undefined && !isMembershipStatus(target.status)) return false;
  return true;
}

function removesLastOwner(action, context) {
  const target = context.target;
  if (
    !target
    || target.role !== 'merchant_owner'
    || target.status !== 'active'
  ) {
    return false;
  }

  const nextRole = context.nextRole ?? target.role;
  const nextStatus = action === 'member.deactivate'
    ? 'inactive'
    : (context.nextStatus ?? target.status);
  const removesOwner = nextRole !== 'merchant_owner' || nextStatus !== 'active';
  return removesOwner && (!Number.isSafeInteger(context.activeOwnerCount) || context.activeOwnerCount <= 1);
}

function isSelfRoleEscalation(actor, context) {
  if (!context.target || context.nextRole === undefined) return false;
  if (context.target.userScope !== actor.userScope) return false;
  if (!isWorkspaceRole(context.nextRole)) return true;
  const currentRank = context.target.role === 'merchant_owner' ? 2 : 1;
  const nextRank = context.nextRole === 'merchant_owner' ? 2 : 1;
  return nextRank > currentRank;
}

export function canPerformWorkspaceAction(actor, action, context) {
  if (!WORKSPACE_ACTIONS.includes(action) || !isValidContext(context)) return false;
  if (!isValidActor(actor, context)) return false;

  if (context.target !== undefined && !isTargetInScope(context.target, context)) return false;
  if (context.nextRole !== undefined && !isWorkspaceRole(context.nextRole)) return false;
  if (context.nextStatus !== undefined && !isMembershipStatus(context.nextStatus)) return false;

  if (actor.role === 'cashier') {
    return (
      action === 'workspace.read'
      || action === 'category.read'
      || action === 'product.read'
      || action === 'cart.read'
      || action === 'inventory.read'
      || action === 'sale.create'
      || (
        action === 'member.read'
        && context.target?.userScope === actor.userScope
      )
    );
  }

  if (actor.role !== 'merchant_owner' || !OWNER_ACTIONS.has(action)) return false;
  if (MEMBER_MUTATION_ACTIONS.has(action) && !context.target) return false;
  if (isSelfRoleEscalation(actor, context)) return false;
  if (removesLastOwner(action, context)) return false;
  return true;
}
