# Food AI — RBAC Specification

## Design principle

Food AI uses RBAC with explicit permissions and data scope. UI visibility is not an authorization mechanism.

## Roles

| Role | Main responsibility | Default scope |
|---|---|---|
| owner | Business ownership, strategy, approvals | Organization |
| admin | System administration | Organization, controlled |
| manager | Outlet operations | Assigned outlet(s) |
| purchasing | Supplier and purchasing | Assigned outlet(s) / purchasing scope |
| warehouse | Inventory and receiving | Assigned warehouse/outlet |
| kitchen | Production and recipe execution | Assigned outlet |
| cashier | POS/order/payment | Assigned outlet |
| service | Front-of-house operations | Assigned outlet |
| finance | Finance and reporting | Organization or assigned outlet |
| viewer | Read-only reporting | Explicitly assigned scope |

## Permission namespaces

### Identity

- users.view
- users.create
- users.edit
- users.disable
- roles.view
- roles.manage
- permissions.view

### Organization / outlet

- organization.view
- organization.edit
- outlets.view
- outlets.create
- outlets.edit
- outlets.manage_users

### Ingredients / inventory

- ingredients.view
- ingredients.create
- ingredients.edit
- ingredients.archive
- inventory.view
- inventory.receive
- inventory.adjust
- inventory.stock_opname
- inventory.transfer
- inventory.waste
- inventory.price.view
- inventory.price.edit
- inventory.price_history.view

### Suppliers / purchasing

- suppliers.view
- suppliers.create
- suppliers.edit
- purchasing.request.create
- purchasing.request.approve
- purchasing.order.create
- purchasing.order.approve
- purchasing.receive

### Recipe / menu

- recipes.view
- recipes.create
- recipes.edit
- recipes.cost.view
- recipes.cost.edit
- menus.view
- menus.create
- menus.edit
- menus.price.view
- menus.price.edit

### Finance / analytics

- sales.view
- costs.view
- profit.view
- reports.view
- reports.export
- kpi.view

### Knowledge

- sop.view
- sop.manage
- training.view
- training.manage
- food_safety.view
- food_safety.manage
- halal.view
- halal.manage

### AI

- ai.insights.view
- ai.analysis.run
- ai.forecast.view
- ai.actions.recommend

## Scope model

Permissions are evaluated with scope:

```text
organization/{organizationId}
  └── outlets/{outletId}
       └── warehouses/{warehouseId}
```

A user may have organization-wide permission or a restricted outlet/warehouse scope.

## High-risk operations

These should support approval or elevated permission:

- changing menu price
- changing ingredient cost
- large inventory adjustment
- deleting/archiving master data
- changing user roles
- changing permissions
- approving large purchase orders
- financial exports

## Owner protection

The owner must not be accidentally locked out or demoted by an ordinary admin operation. Owner-sensitive operations should be protected by dedicated rules and, where appropriate, explicit confirmation.

## Audit requirement

Every high-risk mutation should create an immutable audit event. The audit event should identify actor, scope, action, target, timestamp, and relevant before/after values.

## AI authorization

AI tools must receive the authenticated user's organization, role, permission set, and scope. An AI response must never reveal data that the same user could not access through the application directly.