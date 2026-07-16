# ADR-003 — Offline Storage

## Status

**Proposed**.

## Context

NusaKasir transactions and learning progress must survive offline use and app restart. `localStorage` is synchronous, small, lacks multi-store transactions, and is already used only for minimal VitaCheck/prefs. Cache API is for request/response shell, not user records.

## Decision

Use IndexedDB through a small repository/wrapper with explicit schema version, migrations, atomic multi-store transactions, accountScope/workspace compound keys, and error mapping. Domain code depends on repository ports with an in-memory fake. Do not add a dependency in Fase 0; wrapper technology is selected in implementation review, defaulting to native API if sufficient.

Financial finalization writes entity, movement, audit, and outbox atomically. Service worker does not own or migrate the database.

## Alternatives

1. **localStorage:** rejected for domain records due sync API, no transactions, quota/serialization risks.
2. **Cache API:** rejected; wrong model and privacy/cache lifecycle.
3. **SQLite/WASM:** powerful but bundle/migration/performance complexity unsupported for MVP; deferred.
4. **Cloud-only Firestore persistence:** violates local-first/no-login foundation and obscures transaction control; rejected.

## Consequences

Positive: durable structured data, indexes, transaction atomicity, offline operation. Negative: browser-specific quota/eviction, async complexity, migration responsibility, same-origin script access, and difficult inspection/recovery for users.

## Security impact

IndexedDB is not a trusted or encrypted vault. Never store credentials/raw invite tokens. XSS and shared device remain threats. Repository must require scopes and render plain text.

## Privacy impact

Logout/account switch behavior is explicit: close database, stop sync, offer purge, preserve cloud/backup separately. Anonymous data is not auto-merged after login.

## Offline impact

This is the core offline source. UI acknowledges local commit only after transaction complete. Quota warning cannot delete sale/outbox automatically. Backup/recovery is planned early.

## Migration impact

Every store/index change increments schema. Migration is idempotent, network-free, checkpointed, and supports read-only rejection for newer schemas. Destructive store removal is delayed across releases.

## Open questions

- Is native IndexedDB ergonomics sufficient or is a small audited wrapper justified?
- What storage-size thresholds work on target Android devices?
- Should shared-device mode default to purge at logout during pilot?
- How is corrupted record quarantine exported for support without leaking data?
