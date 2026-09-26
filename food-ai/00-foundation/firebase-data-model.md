# Food AI — Firebase Data Model

## Firebase role

Firebase is the operational backend for Food AI. It should provide:

- Firebase Authentication for identity
- Cloud Firestore for operational/master data
- Cloud Storage for documents/media
- Firestore Security Rules for authorization
- Cloud Functions / server-side jobs for trusted calculations and workflows where needed
- Firebase App Check where supported by the client architecture

Firebase is not the place for secrets or unrestricted AI credentials in the client.

## Top-level Firestore model

```text
organizations/{organizationId}
  ├── members/{userId}
  ├── roles/{roleId}
  ├── permissions/{permissionId}
  ├── outlets/{outletId}
  │    ├── warehouses/{warehouseId}
  │    ├── inventory/{ingredientId}
  │    ├── stockLots/{lotId}
  │    ├── stockMovements/{movementId}
  │    ├── stockCounts/{countId}
  │    ├── wasteRecords/{wasteId}
  │    ├── purchaseRequests/{requestId}
  │    ├── purchaseOrders/{orderId}
  │    ├── receiving/{receivingId}
  │    └── sales/{saleId}
  ├── ingredients/{ingredientId}
  ├── ingredientPriceHistory/{priceId}
  ├── suppliers/{supplierId}
  ├── recipes/{recipeId}
  ├── recipeVersions/{versionId}
  ├── menus/{menuId}
  ├── menuPriceHistory/{priceId}
  ├── auditLogs/{auditId}
  ├── sopDocuments/{sopId}
  ├── training/{trainingId}
  └── aiInsights/{insightId}
```

## Why organization-first

The system must support a single owner managing multiple outlets without duplicating the application model. Organization is the tenant boundary. Outlet/warehouse is the operational scope.

## Authentication

Firebase Authentication identifies the user. Authorization must be derived from the organization membership and server-enforced permissions/scope, not from arbitrary client-provided role fields.

Recommended member fields:

```json
{
  "userId": "...",
  "email": "...",
  "displayName": "...",
  "status": "active",
  "roleIds": ["manager"],
  "outletIds": ["outlet-medan"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Ingredient model

Ingredients are master data. Operational stock belongs to an outlet/warehouse.

Example:

```json
{
  "name": "Ayam Broiler",
  "sku": "ING-AYAM-001",
  "baseUnit": "kg",
  "categoryId": "protein",
  "active": true,
  "preferredSupplierId": "supplier-xyz",
  "minimumStock": 20,
  "reorderPoint": 25,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Price history

Never overwrite the historical price as the only record. A current price can exist for convenience, but every meaningful price change should create a history record.

```json
{
  "ingredientId": "ING-AYAM-001",
  "supplierId": "supplier-xyz",
  "outletId": "outlet-medan",
  "unit": "kg",
  "price": 38000,
  "effectiveAt": "timestamp",
  "source": "purchase_receipt",
  "actorUserId": "..."
}
```

## Stock ledger principle

Inventory should be explainable from movements. Avoid treating a single mutable stock number as the complete source of truth.

Movement types can include:

- opening_balance
- receiving
- production_consumption
- sale_consumption
- transfer_in
- transfer_out
- waste
- adjustment
- stock_opname
- return

## Audit logs

Audit logs should be append-oriented and protected from ordinary users. Sensitive mutations should record:

- actorUserId
- organizationId
- outletId
- action
- resourceType
- resourceId
- before
- after
- reason
- createdAt

## Security boundary

The current repository already has Firebase Authentication/Firestore rule infrastructure, including owner/admin checks and a final deny-all fallback. Food AI should extend this model rather than bypass it. Existing rules must be preserved for unrelated VitaNusa features while adding isolated organization-scoped Food AI rules.

## Important migration rule

Do not replace the existing `firestore.rules` wholesale. Add Food AI collections/functions carefully and keep existing VitaNusa collections working.

## Client architecture

The frontend may read/write only what Firestore rules permit. Trusted operations such as sensitive approvals, privileged role changes, derived financial aggregation, and cross-outlet organization reporting may be routed through trusted server-side code when direct client writes would be unsafe.

## Initial implementation phases

### Phase 1 — Identity and tenancy

- Firebase Auth
- organizations
- members
- roles
- permissions
- outlet scope
- audit foundation

### Phase 2 — Inventory core

- ingredients
- suppliers
- warehouses
- inventory
- stock movements
- stock opname
- price history

### Phase 3 — F&B costing

- recipes
- recipe versions
- HPP
- menu prices
- menu price history

### Phase 4 — Purchasing

- purchase request
- approval
- purchase order
- receiving

### Phase 5 — Dashboard and AI

- owner dashboard
- manager dashboard
- operational dashboards
- alerts
- AI analysis
- forecasting

Security rules and data indexes should be implemented alongside each phase, not after the UI is finished.