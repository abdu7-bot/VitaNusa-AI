# VitaNusa-AI — Master Work Plan

> Active execution plan. Roadmap = destination; this document = work order; tasks/active = current implementation.

## 1. North Star

Build Vita as a halal, productive value-creation business. Start with F&B digital products/tools, validate real customers and revenue, then build customer/transaction infrastructure, AI assistance, compliant health commerce, B2B/network layers, and controlled automation.

Reference: `docs/product/ROADMAP-VITA-PRODUK-2036.md`

## 2. Execution Rule

```
PROBLEM → DESIGN → IMPLEMENT → VALIDATE → INDEPENDENT REVIEW → HUMAN APPROVAL → COMMIT → DONE
```

For work requiring approval before implementation:

```
HUMAN APPROVAL → IMPLEMENT → VALIDATE → REVIEW → HANDOFF/ROLLBACK → COMMIT/COMPLETE
```

Non-negotiable:
- No automatic commit without human approval.
- A task is not DONE merely because implementation finished.
- Independent review must be independent.
- T004 rollback/checkpoint remains fail-closed.
- Avoid parallel feature work unless dependencies are clear.
- Scale infrastructure only from measured demand.

## 3. Current State — October 2026

### Governance
- [x] T003 — Multi-Agent Orchestration foundation
- [ ] T004 — Checkpoint & Rollback Safety — Round 5 remediation
- [ ] T004 validation
- [ ] T004 independent Copilot review
- [ ] Human approval
- [ ] Commit and mark T004 DONE

### Business
- [x] 10-year strategic roadmap
- [ ] Vita Product MVP
- [ ] F&B HPP engine
- [ ] Inventory engine
- [ ] First digital product
- [ ] First paying customer

**Current bottleneck: T004. Do not skip it to chase features.**

## 4. Master Work Sequence

### GATE 0 — Governance Safety
- [ ] Finish T004 Round 5 remediation
- [ ] Add regression tests for all Round 5 findings
- [ ] Run tests, compileall, diff checks
- [ ] Manually reproduce safety cases
- [ ] Copilot independent review
- [ ] Remediate/review again if FAIL
- [ ] Human approval
- [ ] Commit
- [ ] Mark T004 DONE

Exit: tests PASS + manual checks PASS + independent review PASS + no unresolved HIGH/MEDIUM findings + human approval.

### GATE 1 — Vita F&B MVP
Customer: small F&B/warung/kedai owners.

#### HPP Engine
- [ ] Ingredient master
- [ ] Units/conversion
- [ ] Purchase price
- [ ] Quantity used
- [ ] Recipe
- [ ] Portion HPP
- [ ] Selling price
- [ ] Gross margin
- [ ] Validation and tests

#### Inventory MVP
- [ ] Item master
- [ ] Units
- [ ] Opening stock
- [ ] Stock in
- [ ] Usage
- [ ] Adjustment
- [ ] Current stock
- [ ] Minimum stock
- [ ] Low-stock warning
- [ ] Audit trail
- [ ] Tests

#### Integration
- [ ] Recipe → HPP
- [ ] Inventory → ingredient availability
- [ ] HPP → price/margin
- [ ] Basic dashboard

Exit: a real user can calculate HPP and understand stock without developer assistance.

### GATE 2 — First Digital Products
- [ ] HPP template
- [ ] Inventory template
- [ ] Recipe costing template
- [ ] SOP starter pack
- [ ] F&B bundle
- [ ] Product page
- [ ] Pricing
- [ ] Terms/usage rights
- [ ] Delivery/access
- [ ] Refund/support flow

Exit: at least one product is purchasable and usable by a real customer.

### GATE 3 — First Paying Customers
- [ ] Limited launch
- [ ] Onboard early users
- [ ] Collect feedback
- [ ] Measure conversion
- [ ] Measure refund
- [ ] Measure repeat usage/purchase
- [ ] Measure support and delivery cost
- [ ] Improve product

Exit: people pay, use the product, receive value, and unit economics are becoming understandable.

### GATE 4 — Customer + Transaction Platform
- [ ] Authentication
- [ ] Customer profile
- [ ] Product catalog
- [ ] Order model
- [ ] Payment state
- [ ] Digital product access
- [ ] Order history
- [ ] Support workflow
- [ ] Admin dashboard
- [ ] Basic analytics
- [ ] Backup/recovery

### GATE 5 — Vita AI Business Assistant
- [ ] HPP analysis
- [ ] Margin analysis
- [ ] Inventory analysis
- [ ] Pricing scenarios
- [ ] Business summaries
- [ ] Content assistance
- [ ] Action recommendations
- [ ] Model/provider abstraction
- [ ] Local-model compatibility
- [ ] AI cost tracking
- [ ] Output validation
- [ ] Human approval for consequential actions

Rule: AI provider/model must remain replaceable.

### GATE 6 — Subscription
- [ ] Free tier
- [ ] Basic tier
- [ ] Pro tier
- [ ] Business tier
- [ ] Usage limits
- [ ] Billing/subscription state
- [ ] Cancellation
- [ ] Retention metrics
- [ ] Unit economics

Rule: recurring payment must correspond to recurring value.

### GATE 7 — Health Commerce
- [ ] Seller verification
- [ ] Product identity verification
- [ ] Regulatory-status workflow
- [ ] Ingredient/composition data where relevant
- [ ] Permitted claims
- [ ] Marketing review
- [ ] Customer disclosures
- [ ] Escalation workflow
- [ ] AI health-claim guardrails
- [ ] Legal/compliance review

Rule: uncertain medical/regulatory questions escalate; AI must not invent claims.

### GATE 8 — F&B Business Platform
- [ ] Inventory
- [ ] Purchasing
- [ ] Recipe management
- [ ] HPP
- [ ] Menu engineering
- [ ] Supplier records
- [ ] Sales analysis
- [ ] Reporting
- [ ] Forecasting
- [ ] SOP management
- [ ] Staff/workflow support

Goal: daily operational usefulness, not just template sales.

### GATE 9 — B2B Supplier Layer
```
FORECAST → PURCHASE RECOMMENDATION → SUPPLIER DISCOVERY → ORDER → INVENTORY UPDATE
```
- [ ] Supplier profiles
- [ ] Catalog
- [ ] Verification
- [ ] Price comparison
- [ ] Purchase recommendations
- [ ] Order flow
- [ ] Transparent fees
- [ ] Supplier analytics

### GATE 10 — Vita Network
Connect F&B owners, suppliers, creators, consultants, educators, and service providers.
- [ ] Trust/identity layer
- [ ] Reputation rules
- [ ] Creator onboarding
- [ ] Supplier onboarding
- [ ] Service listings
- [ ] Transaction auditability
- [ ] Dispute/support workflow

### GATE 11 — Controlled AI Automation
```
ANALYZE → RECOMMEND → HUMAN APPROVAL → IMPLEMENT → VALIDATE → REVIEW → ROLLBACK/HANDOFF → COMPLETE
```
Candidates:
- [ ] Purchasing drafts
- [ ] Reports
- [ ] Inventory anomaly detection
- [ ] Price scenarios
- [ ] Customer communication drafts
- [ ] Operational task preparation

High-risk actions require stronger approval: financial transactions, irreversible changes, health claims, sensitive-data actions, and external commitments.

### GATE 12 — Vita Business Operating Platform
Target 2035–2036:
1. Understand what is happening.
2. Recommend what should happen next.
3. Prepare the action.
4. Obtain approval when required.
5. Execute within bounded authority.
6. Validate the result.
7. Roll back or hand off when needed.

## 5. Agent Roles

### Kilo — Implementer/Validator
Implement, test, validate, remediate, report. Not final approval authority.

### Copilot — Independent Reviewer
Find defects, security issues, governance gaps, and edge cases. Give independent PASS/FAIL.

### Human — Final Authority
Approve scope/risk, approve commit, decide milestone completion and business direction.

## 6. Definition of Done

- [ ] Scope satisfied
- [ ] Tests PASS
- [ ] Validation PASS
- [ ] Security/governance checks PASS
- [ ] Independent review PASS
- [ ] No unresolved critical/high findings
- [ ] Documentation updated
- [ ] Human approval
- [ ] Commit recorded

## 7. Business KPI Ladder

```
USEFUL PRODUCT → ACTIVE USAGE → FIRST PURCHASE → REPEAT USAGE → REPEAT PURCHASE → RETENTION → GROSS MARGIN → RECURRING REVENUE → SCALE
```

Track: revenue, gross margin, conversion, repeat purchase, retention, refund rate, support cost, infrastructure cost, AI cost/customer, CAC, and LTV.

## 8. Infrastructure Order

### MVP
Termux development → low-cost VPS when needed → simple backend → single database → backups.

### Proven usage
Managed database if justified → object storage → monitoring → scheduled backups → deployment automation.

### Scale
Multiple instances → queue → cache → replication where justified → observability → disaster recovery.

### AI scale
Provider/model abstraction → workload routing → dedicated inference only when economics justify it → stronger security.

**Infrastructure follows measured demand.**

## 9. Current Queue

### NOW
- [ ] T004 Round 5 remediation
- [ ] T004 validation
- [ ] T004 independent Copilot review

### NEXT
- [ ] T004 human approval + commit
- [ ] Foundation audit
- [ ] Vita F&B MVP specification

### AFTER THAT
- [ ] HPP Engine
- [ ] Inventory MVP
- [ ] First digital product
- [ ] First customer validation

### LATER
- [ ] Transaction platform
- [ ] AI Assistant
- [ ] Subscription
- [ ] Health Commerce
- [ ] F&B Business Platform
- [ ] B2B Supplier Layer
- [ ] Vita Network
- [ ] Controlled AI Automation
- [ ] Vita Business Operating Platform

## 10. Decision Gates

A = Is governance safe?
B = Does the product solve a real problem?
C = Will people pay?
D = Do they return because it creates value?
E = Can the process repeat reliably?
F = Does AI improve measurable outcomes?
G = Are economics and governance strong enough to scale?

If the answer is NO, do not jump to the next gate.

## 11. Six-Month Review

Review:
- What assumptions became false?
- What did customers actually pay for?
- Which product has strongest retention?
- Which revenue stream has healthiest margin?
- What costs/risk grew fastest?
- Which technology dependency became risky?
- What regulation changed?
- What should stop?
- What should accelerate?

## 12. Operating Rule

> **Do not chase features. Solve a problem → prove value → prove payment → build the system → automate safely → scale.**
