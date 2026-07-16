# ADR-008 — Health, Learning, Business, and Admin Data Separation

## Status

**Proposed**.

## Context

VitaNusa already stores optional private VitaCheck summaries under user UID. Mandiri adds educational and financial data. A unified profile or analytics pipeline could enable unintended inference and platform access.

## Decision

Separate domains by path, entity, repository, permission, consent, audit category, export, retention, and deletion workflow:

- health: existing `users/{uid}/vitaCheckHistory`, self-only;
- learning: user-private profile/progress/attempt, mentor scoped grant only;
- business: workspace tenant root/membership;
- platform admin: existing admin collection/content tools.

Common UID establishes identity but is not permission to join or analyze data. No health data in workspace report/action log; no business data in learning recommendation; no platform admin bypass.

## Alternatives

1. **One giant user profile:** easy reads but couples retention/consent and exposes sensitive joins; rejected.
2. **One analytics warehouse:** deferred and prohibited without new purpose/consent/security review.
3. **Workspace owns learner progress:** rejected because learning ownership/mentor consent differs.

## Consequences

Positive: purpose limitation, simpler least privilege, domain-specific deletion/export. Negative: duplicate minimal identity references, no cross-domain dashboard, more repository/Rules tests.

## Security impact

Every role class is tested as denied outside its domain. Default deny remains. Service/admin credentials cannot be used as a human support shortcut.

## Privacy impact

Reduces sensitive inference and accidental export. Consent is not bundled. Incident/deletion scope can be contained. UID correlation still exists at identity provider and must not be logged/queried unnecessarily.

## Offline impact

Separate account-scoped stores/logical repositories prevent one module reading another. Cache shell is public only. Purge UI explains local domain choices separately where needed.

## Migration impact

Existing VitaCheck path and Rules remain unchanged. New learning/workspace paths are added later. If any prototype mixes data, it must migrate to separated stores before pilot and verify deletion of obsolete copies.

## Open questions

- Does learner export include only progress or attempts too?
- What support workflow can diagnose sync without viewing payload?
- Can platform owner ever assist tenant restore, and under what separate grant?
- What retention applies independently to each domain?
