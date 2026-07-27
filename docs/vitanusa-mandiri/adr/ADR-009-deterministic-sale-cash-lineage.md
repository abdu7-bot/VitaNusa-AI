# ADR-009 — Deterministic Sale, CashSession, and CashMovement Lineage

## Status

**Proposed**.

This ADR records the approved planning decisions for the prerequisite chain that
must precede the reconstruction of Sale reversal in Issue #88. It does not
authorize implementation, a schema upgrade, or a backup-format upgrade.

## Context

Schema v7 can finalize a Sale without persisting the originating
`cashSessionId`. Expense already carries that reference, while expected cash is
currently derived from session-scoped records. A normal Sale reversal therefore
cannot safely identify a CashSession for every historical Sale.

The abandoned implementation history in PR #90 attempted to cross several
contracts at once: reversal, storage schema, backup, repository, service, and
closed-session reconciliation. Continuing on that history would preserve
assumptions that have not been made deterministic.

The architecture needs an explicit lineage:

`verified CashSession -> Sale/Expense -> CashMovement -> closingSummary`

The lineage must remain tenant-scoped, append-only, retry-safe, and auditable.
Neither caller input nor record timestamps are authoritative evidence of a
relationship.

## Decision

### 1. Sale schema v1 and v2

`Sale` schema v1 is the existing legacy record. It has no authoritative
`cashSessionId`. A v1 Sale remains readable and immutable, but it is ineligible
for normal Sale reversal when cash lineage is required.

`Sale` schema v2 adds the immutable `cashSessionId` for a cash Sale. The stored
value is the identifier of the CashSession verified by the finalization service
inside the same transaction. The field is not copied blindly from the caller.
Non-cash payment handling must be specified by the Sale v2 contract and tested
without inventing a cash relationship.

The `cashSessionId` supplied by a finalization command is only an expected
reference. Inside the atomic finalization transaction, the service must reload
the CashSession from the trusted repository and verify:

- `accountScope` equals the authenticated account;
- `workspaceId` equals the target workspace;
- the session status is `open`;
- the actor has active membership and the required role/permission;
- the record satisfies the one-active-session contract for that
  account/workspace;
- the reloaded identifier equals the expected reference.

Only after every check passes may the service persist the verified record's
`cashSessionId` on Sale v2. The caller is never the source of truth for the
Sale–CashSession relationship. Missing, stale, closed, cross-tenant, or
non-active references fail closed and leave no partial Sale, Payment, inventory,
movement, audit, or operation-receipt writes.

### 2. CashMovement is append-only

Schema v8 introduces dedicated `CashMovement` and `SaleReversal` stores.
`CashMovement` is an immutable ledger event, not a mutable expected-cash
aggregate. Each committed cash-affecting Sale, Expense, and eligible normal
Sale reversal appends its own movement with deterministic references,
account/workspace/session scope, signed safe-integer amount, event type, actor,
operation ID, event ID, and local timestamp.

A committed movement is never edited or deleted to restate history. Corrections
append a new, explicitly linked event through an authorized workflow. Repository
indexes may accelerate scoped reads but must not become an alternate source of
truth.

No historical synthetic `CashMovement` records are created for legacy Sale or
Expense records during migration.

### 3. Legacy Sale policy

A Sale v1 without `cashSessionId` cannot be processed by normal Sale reversal.
The service fails closed with a stable, explicit legacy-lineage error.

It is forbidden to backfill or infer `cashSessionId` from:

- `createdAtLocal`, another timestamp, or a time window;
- the CashSession that happened to be active when the record is read;
- the only session found in a workspace;
- closing totals, record ordering, UI state, or caller assertion.

Legacy policy preserves the original Sale and historical summaries. Any future
manual remediation requires a separately approved, audited workflow; it is not
part of Issue #88.

### 4. Normal reversal while the originating session is open

Normal Sale reversal in Issue #88 is allowed only for an eligible Sale v2 whose
originating CashSession can be reloaded and verified as the same currently open
active session in the same account/workspace, with active authorized
membership.

One atomic transaction must append the `SaleReversal`, the compensating
`CashMovement` when cash is affected, required inventory movements, audit event,
and operation receipt. The original Sale, Payment, SaleLine, and prior movements
remain immutable. A Sale can have at most one committed normal reversal.

### 5. Reversal after session close

Normal Sale reversal is rejected once the originating CashSession is closed.
Issue #88 must not reopen the session, mutate its closing summary, append a
normal reversal against closed history, or treat a current open session as a
replacement origin.

Refund or correction after close belongs to a separate
`PostCloseCorrection` workflow and issue. That workflow is outside Issue #88 and
is not a direct prerequisite for it.

### 6. Schema v7 to v8 migration

The v7-to-v8 migration is non-destructive and adds the `CashMovement` and
`SaleReversal` stores and required scoped uniqueness/index contracts. It does
not rewrite legacy Sales, manufacture lineage, synthesize historical movements,
recalculate closed sessions, or change backup schema/version by implication.

For each active/open CashSession present at migration, v8 stores two immutable
baseline values:

- `legacyCashSalesMinor`;
- `legacyExpenseOutMinor`.

Each baseline is calculated once from the valid v7 records visible under the
existing deterministic session rules at migration time, using safe-integer
arithmetic. The migration is retry-safe: an already persisted baseline is
verified and retained, never recalculated from later data.

Closed CashSessions are historical records and are not reopened or
re-baselined. Corrupt, ambiguous, cross-scope, or overflow input aborts the
upgrade transaction rather than producing a partial v8 database.

### 7. Active-session baseline and ledger close

After migration, expected cash for a migrated active session is derived from
its immutable v7 baseline plus v8 ledger movements:

`openingCashMinor + legacyCashSalesMinor - legacyExpenseOutMinor + sum(CashMovement.amountMinor)`

The exact sign convention is owned by the CashMovement domain contract and must
be applied consistently for Sale, Expense, and reversal events. New v8 writes
must append movements; they must not alter either legacy baseline.

Closing an active session reloads all authoritative records inside one
transaction, verifies membership and active-session invariants, and computes
the final values from the baseline plus the complete scoped ledger. The close
operation atomically persists the closed session, immutable `closingSummary`,
audit event, and operation receipt.

### 8. Immutable closing summary

Once a CashSession is closed, its `closingSummary` is an immutable historical
snapshot. Later ledger events, refunds, corrections, migrations, retries, or a
new active session cannot mutate or recompute it.

`PostCloseCorrection` must preserve that snapshot and represent later business
events separately with explicit references and reporting semantics.

## Security invariants

- Every read and write is bound to authenticated `accountScope` and
  `workspaceId`; cross-tenant identifiers fail closed.
- Active membership and required permission are revalidated in the transaction,
  not trusted from UI state.
- Caller-provided `cashSessionId` is an expected reference only.
- The one-active-session contract is verified before Sale finalization,
  cash-affecting writes, reversal, and close.
- Unknown fields, invalid identifiers, unsafe money, overflow, corrupt lineage,
  and ambiguous state are rejected.
- Original financial records, ledger events, baselines, and closing summaries
  are immutable.
- Timestamp inference and synthetic historical ledger creation are prohibited.

## Atomicity and idempotency

Each command owns one transaction boundary containing all of its domain writes,
audit record, and operation receipt. Any failure rolls back the whole command.
No path may commit an entity without its required movement or receipt.

Every mutating command requires a scoped `operationId` and canonical material
payload. Retrying the same operation and payload returns the committed result
without duplicate entities or movements. Reusing the operation ID with
different material returns `idempotency_mismatch`. Migration retries produce
the same stores and baseline values and never duplicate or recalculate ledger
history.

## Required verification

Implementation issues must cover, at minimum:

- Sale v1 read compatibility and fail-closed reversal;
- Sale v2 cash finalization with verified originating session;
- missing, stale, closed, inactive, and cross-tenant expected references;
- membership and active-session race checks inside the transaction;
- Sale, Expense, reversal, and CashMovement atomic rollback points;
- movement uniqueness and same/different-payload retry behavior;
- safe-integer boundaries and overflow;
- v7-to-v8 success, retry, abort, and non-destructive preservation;
- immutable migration baselines and absence of synthetic movements;
- close calculation for native-v8 and migrated active sessions;
- immutable closed summary and rejection of normal post-close reversal;
- memory/IndexedDB parity, scoped indexes, audit, and operation receipts;
- compatibility checks required by the existing backup contract, without
  upgrading backup in these prerequisites.

## Consequences

Positive: cash lineage becomes deterministic, tenant-safe, auditable, and
replayable without mutating financial history. Migration can bridge active v7
sessions without fabricating events.

Negative: legacy Sale v1 cannot use normal reversal, post-close corrections
need a separate workflow, and the prerequisite sequence delays Issue #88.

## Delivery sequence

The implementation sequence is strictly:

1. ADR cash lineage;
2. Sale v2 — persist originating CashSession;
3. schema v8 — `CashMovement` and `SaleReversal` stores;
4. append `CashMovement` for Sale and Expense;
5. CashSession v2 — active-session migration and ledger close;
6. reconstruct Issue #88 on a clean branch.

No issue in the sequence may start until the preceding issue is merged and CI
on `main` is green. PR #90 is superseded as an implementation vehicle, remains
Draft, will not be merged, and must receive no new implementation. Valid pieces
may be moved selectively into clean prerequisite branches after their contracts
are approved.

`PostCloseCorrection` is deliberately outside this dependency chain.

## Alternatives rejected

1. Infer a legacy relationship from timestamp/session overlap: rejected because
   local clocks, late writes, retries, and overlapping/corrupt data make it
   non-authoritative.
2. Attach legacy Sales to the current active session: rejected because it
   rewrites economic history.
3. Synthesize historical CashMovement during migration: rejected because the
   migration cannot prove event-level lineage.
4. Recompute closed summaries after reversal: rejected because a closing
   summary is a historical attestation.
5. Continue implementing on PR #90: rejected because its history combines
   unresolved contracts and schema/backup changes.
