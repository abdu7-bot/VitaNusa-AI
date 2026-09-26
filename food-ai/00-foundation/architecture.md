# Food AI — Architecture Foundation

## 1. Product boundary

Food AI is an F&B management operating system, not only a knowledge base. The product combines operational data, calculations, workflows, documentation, and AI analysis.

## 2. Core layers

```text
FOOD AI
│
├── Identity & Access
│   ├── Authentication
│   ├── Organization / Brand
│   ├── Outlet / Branch
│   ├── Roles
│   ├── Permissions
│   └── Audit Log
│
├── Master Data
│   ├── Ingredients
│   ├── Units
│   ├── Suppliers
│   ├── Recipes
│   ├── Menus
│   ├── Employees
│   └── Locations
│
├── Operations
│   ├── Inventory
│   ├── Purchasing
│   ├── Receiving
│   ├── Stock Opname
│   ├── Waste
│   ├── Production
│   └── Sales / POS integration
│
├── Finance & Performance
│   ├── HPP / COGS
│   ├── Pricing
│   ├── Gross Profit
│   ├── Food Cost
│   ├── Labor Cost
│   ├── Prime Cost
│   └── KPI
│
├── Knowledge
│   ├── SOP
│   ├── Training
│   ├── Food Safety
│   └── Halal Compliance
│
└── Intelligence
    ├── Dashboard
    ├── Alerts
    ├── Analytics
    ├── Forecasting
    └── AI Analyst
```

## 3. Access model

Access is evaluated using three dimensions:

```text
USER → ROLE → PERMISSION → SCOPE
                         ├── Organization
                         ├── Outlet
                         └── Resource
```

A role alone is never sufficient to authorize sensitive operations.

Example: a Warehouse employee may edit stock for Outlet A but must not edit menu prices or read company profit reports.

## 4. Primary roles

- owner — business owner; organization-wide visibility and high-risk approvals
- admin — system administration; cannot silently bypass owner controls
- manager — operational management within assigned outlet/scope
- purchasing — suppliers, purchase requests, purchase orders
- warehouse — receiving, inventory, stock opname, waste
- kitchen — production, recipe usage, waste reporting
- cashier — sales/order/payment workflows
- service — service-related operational workflows
- finance — financial reporting and controlled finance operations
- viewer — read-only access

Roles are templates. Effective permissions can be customized by organization while preserving protected owner/system capabilities.

## 5. Owner dashboard

The owner dashboard is organization-aware and can switch between all outlets and individual outlets.

Initial dashboard domains:

- Sales
- Gross profit
- Food cost
- Inventory value
- Low-stock alerts
- Price-change alerts
- Waste
- Purchasing
- Menu performance
- Labor / prime cost
- Operational alerts
- AI insights

## 6. Critical security rules

- Server/database security rules are authoritative; frontend hiding is not security.
- AI must use the same authorization context as the requesting user.
- Sensitive changes require audit records.
- Price, cost, permissions, role, and financial data require explicit permissions.
- Branch scope must be enforced in database rules, not only in UI filters.
- Deletion of financial/stock history should normally be replaced by reversal/adjustment records.

## 7. Auditability

Important mutations must capture:

- actor user ID
- organization ID
- outlet ID when applicable
- action
- resource type
- resource ID
- before values where appropriate
- after values where appropriate
- reason / reference
- timestamp

## 8. Implementation order

1. Identity + organization + outlet model
2. Roles + permissions + scope
3. Audit log
4. Ingredient/unit/supplier master data
5. Inventory + price history
6. Recipe + costing engine
7. Purchasing + receiving
8. Owner/admin dashboard
9. Menu + sales analytics
10. AI analyst and forecasting

This order intentionally establishes the data and authorization foundation before advanced AI features.