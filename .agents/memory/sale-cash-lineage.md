---
name: Sale cash lineage boundary
description: Durable rule for associating POS sales with cash sessions without inferring historical relationships.
---

New cash Sale records must carry the CashSession reference verified inside the same atomic finalization transaction. A caller-provided session ID is only an expected reference, never authoritative. Legacy Sale records without that relationship remain readable but must fail closed for normal reversal.

**Why:** timestamps, offline delivery order, manipulated device clocks, and multiple devices cannot prove which session owned a historical sale.

**How to apply:** preserve Sale v1 compatibility when evolving the POS schema; add a new versioned lineage contract and verify the scoped active session before writing Sale, payment, inventory, audit, or receipt records. Treat CashMovement and deterministic close reconciliation as the next ledger boundary rather than inferring legacy links.