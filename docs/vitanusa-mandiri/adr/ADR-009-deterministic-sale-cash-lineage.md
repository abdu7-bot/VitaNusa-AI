# ADR-009 — Deterministic Sale, CashSession, and CashMovement Lineage

## Status

**Proposed**.

This ADR records the approved planning decisions for the prerequisite chain that
must precede the reconstruction of Sale reversal in Issue #88. This document does
not itself implement runtime behavior, activate schema v8, or change the backup
format. Those changes are authorized only through the sequential prerequisite
issues defined below.

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

### 6. Issue #94 is the sole v8 activation boundary

Issue #94 is the only delivery allowed to activate database schema v8. The v8
activation is one coherent compatibility boundary and must include all of the
following before any CashMovement producer is enabled:

- database schema v8;
- append-only `CashMovement` and `SaleReversal` stores and scoped indexes;
- CashSession schema v2;
- migration of every valid active/open CashSession v7 to CashSession v2;
- immutable `legacyCashSalesMinor` and `legacyExpenseOutMinor` baselines;
- a durable migration/compatibility marker;
- complete backup format/schema v8 support;
- legacy-backup compatibility according to the existing compatibility policy;
- append-only repository foundations for later producer and reversal services.

Issue #94 must not activate a Sale/Expense CashMovement producer or a
SaleReversal service. It creates and validates the storage, migration, backup,
and repository boundary only.

No later issue may perform another v7-to-v8 versionchange or defer any required
active-session baseline into a post-upgrade migration.

### 7. Atomic v7-to-v8 migration and active-session baselines

The v7-to-v8 migration is non-destructive. It does not rewrite legacy Sales,
manufacture Sale–CashSession lineage, synthesize historical movements,
recalculate closed sessions, or mutate an already committed closing summary.

For every valid active/open CashSession visible during the upgrade, the
versionchange transaction persists CashSession v2 and calculates exactly once:

- `legacyCashSalesMinor`;
- `legacyExpenseOutMinor`.

The baselines are calculated from valid v7 records under the existing
deterministic session rules using safe-integer arithmetic. They become immutable
when the v8 activation commits. No synthetic historical `CashMovement` is
created.

The schema changes, CashSession v2 records, baselines, migration marker, and
compatibility state are one atomic activation. An already committed marker and
baseline are verified and retained on retry; they are never recalculated from
later data.

Closed CashSessions remain unchanged historical records. They are not reopened,
upgraded for new behavior, or re-baselined.

Before activation can commit, the implementation must validate the complete v8
backup contract and legacy-compatibility rules against the schema being
activated. Missing backup coverage, invalid backup schema, corrupt or ambiguous
session data, cross-scope references, unsafe money, overflow, baseline failure,
or marker inconsistency aborts the complete upgrade. There must be no partially
activated v8 database and no state in which schema v8 can produce records that
the active backup contract cannot preserve.

### 8. Backup v8 is part of activation

Issue #94 activates backup format/schema v8 together with database v8. The v8
contract must cover every new or changed authoritative value required by the
compatibility boundary, including:

- Sale v1/v2 fields, including Sale v2 `cashSessionId`;
- CashSession v1/v2 fields, including both immutable legacy baselines and the
  migration marker/compatibility state where applicable;
- `CashMovement`;
- `SaleReversal`;
- all required references, record counts, limits, checksum material, scope, and
  safe-integer validation.

Export, preview, normalization/validation, and restore behavior must agree on the
same v8 contract. A v8 backup must not silently omit a v8 store or field.
Legacy backups remain processable under the existing compatibility policy and
must not be silently upgraded, assigned invented lineage, or converted into
synthetic movements.

Because backup v8 is active before Issue #95, every later CashMovement producer
must write records already covered by the merged backup contract.

### 9. Ledger close after activation

After #94, expected cash for a migrated active session is derived from its
immutable v7 baseline plus v8 ledger movements:

`openingCashMinor + legacyCashSalesMinor - legacyExpenseOutMinor + sum(CashMovement.amountMinor)`

The exact sign convention is owned by the CashMovement domain contract and must
be applied consistently for Sale, Expense, and reversal events. New v8 writes
must append movements; they must not alter either legacy baseline.

Issue #96 does not run a versionchange migration and does not calculate, insert,
or rewrite baselines. It only consumes CashSession v2 and baseline state already
committed by Issue #94.

Closing an active native-v8 or migrated session reloads all authoritative
records inside one transaction, verifies membership and active-session
invariants, and computes the final values from the committed baseline plus the
complete scoped ledger. The close operation atomically persists the closed
session, immutable `closingSummary`, audit event, and operation receipt.

Sale/Expense writes and close must have deterministic concurrency behavior: one
transaction commits first and the other observes the authoritative resulting
state or fails/retries. No CashMovement may commit outside a closing summary that
claims to cover it.

### 10. Immutable closing summary

Once a CashSession is closed, its `closingSummary` is an immutable historical
snapshot. Later ledger events, refunds, corrections, migrations, retries, or a
new active session cannot mutate or recompute it.

A duplicate-safe close retry returns the previously committed closed session and
summary. It must not reread newer movements to produce a different result.

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
- Original financial records, ledger events, baselines, migration state, and
  closing summaries are immutable.
- Timestamp inference and synthetic historical ledger creation are prohibited.
- A producer cannot be activated before the storage and backup contracts that
  preserve its records are active.

## Atomicity and idempotency

Each command owns one transaction boundary containing all of its domain writes,
audit record, and operation receipt. Any failure rolls back the whole command.
No path may commit an entity without its required movement or receipt.

The v8 activation owns one versionchange transaction for schema, CashSession v2,
baselines, and migration/compatibility marker state. Backup-contract validation
is a hard activation gate. Any failure leaves v7 authoritative and prevents
partial v8 activation.

Every mutating command requires a scoped `operationId` and canonical material
payload. Retrying the same operation and payload returns the committed result
without duplicate entities or movements. Reusing the operation ID with
different material returns `idempotency_mismatch`. Activation retries verify the
same marker and baseline values and never duplicate or recalculate ledger
history.

## Required verification

Implementation issues must cover, at minimum:

- Sale v1 read compatibility and fail-closed reversal;
- Sale v2 cash finalization with verified originating session;
- missing, stale, closed, inactive, and cross-tenant expected references;
- membership and active-session race checks inside the transaction;
- v7-to-v8 schema, CashSession v2, baseline, marker, and compatibility-state
  atomic commit;
- upgrade abort on baseline, marker, backup-contract, safe-integer, corrupt, or
  cross-scope failure;
- closed CashSession v7 preservation;
- active CashSession v7 baseline exactly once and no synthetic movement;
- backup v8 export, preview, validation, restore, complete field/store coverage,
  checksum, limits, and legacy compatibility;
- proof that #94 activates no Sale/Expense CashMovement producer and no
  SaleReversal service;
- Sale, Expense, reversal, and CashMovement atomic rollback points after their
  producer issues are reached;
- movement uniqueness and same/different-payload retry behavior;
- close calculation for native-v8 and migrated active sessions using baselines
  committed by #94;
- deterministic close-versus-Sale/Expense concurrency;
- duplicate close returning the stored snapshot without recomputation;
- immutable closed summary and rejection of normal post-close reversal;
- memory/IndexedDB parity, scoped indexes, audit, and operation receipts.

## Consequences

Positive: cash lineage becomes deterministic, tenant-safe, auditable, and
replayable without mutating financial history. Schema, active-session migration,
and backup are activated as one coherent boundary before any producer can create
new ledger records.

Negative: Issue #94 is larger than a store-only migration, legacy Sale v1 cannot
use normal reversal, post-close corrections need a separate workflow, and the
prerequisite sequence delays Issue #88.

## Delivery sequence

The implementation sequence is strictly:

1. #92 / PR #91 — approve ADR cash lineage;
2. #93 — Sale v2 persists the verified originating CashSession while database
   schema and backup remain at the current version;
3. #94 — sole v8 activation boundary: schema v8, CashMovement and SaleReversal
   stores, CashSession v2, active-session baseline migration, migration marker,
   backup v8, legacy backup compatibility, and append-only repositories;
4. #95 — activate CashMovement producers for Sale and Expense using the v8
   backup contract already merged in #94;
5. #96 — CashSession v2 ledger close and concurrency hardening, consuming but
   never recalculating the baselines committed by #94;
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
5. Split schema v8 activation, active-session baseline migration, and backup v8
   across later issues: rejected because versionchange occurs once and producers
   must never outrun backup coverage.
6. Continue implementing on PR #90: rejected because its history combines
   unresolved contracts and schema/backup changes.
