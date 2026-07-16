# ADR-004 — Sync Strategy

## Status

**Proposed**; trusted cloud command location remains `Needs validation`.

## Context

Offline writes, retries, multiple devices, immutable sales, and stock movements make last-write-wins unsafe. Network timeout may occur after server commit, so the client cannot infer whether retry should create another transaction.

## Decision

Use transactional outbox. Each domain command creates a UUID `operationId`; local entity and outbox are committed together. Cloud validator records one operation receipt keyed by workspace and operation ID with canonical payload hash. Replay of identical payload returns the receipt; ID reuse with different hash is denied.

Use entity-specific conflict strategies: product base version/preview; no auto-merge price; append-only stock movements; immutable sale + void/reversal; learning attempt uniqueness + best-score merge per content version. Do not depend solely on Background Sync API.

## Alternatives

1. **Last-write-wins documents:** rejected for money, stock, and sale.
2. **Sync final balance only:** rejected because source movements/audit disappear.
3. **New ID on every retry:** rejected because duplicate business operations.
4. **Always-online transaction:** rejected for product charter.

## Consequences

Positive: retry-safe, visible pending/conflict, immutable records preserved. Negative: receipt retention/cost, payload canonicalization, conflict UI, more states, and need for trusted validation.

## Security impact

Receipt binds actor/workspace/hash/result. Auth and membership are rechecked at apply time. Replay mismatch is audited. A privileged server service, if chosen, needs its own tenant-isolation integration tests because Admin SDK bypasses Rules.

## Privacy impact

Outbox contains tenant data locally; minimize payload and purge only after acknowledgement/retention. Error/receipt does not repeat payload. Account scope prevents accidental cross-account queue.

## Offline impact

Local success is immediate and labeled pending. Auth expiry/permission denial does not delete local data. Manual retry and app-open retry are required; background sync is enhancement.

## Migration impact

Operation payloads are versioned. Validator must accept a bounded set or return schema unsupported; old clients keep dead-letter/export paths. Changing canonical hash requires versioned algorithm.

## Open questions

- Can strict Firestore client transactions/Rules meet invariants, or is an authenticated FastAPI sync service required?
- How long must operation receipts be retained to cover offline devices?
- What is the receipt number allocation strategy across devices?
- What offline stock oversell policy is acceptable?
