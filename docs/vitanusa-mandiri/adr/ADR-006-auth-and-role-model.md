# ADR-006 — Authentication and Role Model

## Status

**Proposed**.

## Context

Firebase Google Auth exists for public users and admin. Existing platform roles `owner|admin` govern platform content/admin accounts. Mandiri needs merchant and learning roles without giving platform staff tenant access.

## Decision

Reuse Firebase Auth only as identity. Define separate authorization sources:

- platform: existing `admins/{uid}` interpreted architecturally as platform owner/admin;
- workspace: `workspaces/{workspaceId}/members/{uid}` role/status/version;
- learning: owner UID plus explicit mentor grants.

Login never grants workspace role. Platform role is never consulted as tenant allow. Workspace membership is not a custom claim because it can be many, changes often, and must be resource-scoped. Unknown/inactive roles deny.

## Alternatives

1. **Single global role field:** rejected; cannot represent multiple workspaces/domains and enables bypass.
2. **All workspace roles in Firebase custom claims:** size/staleness/admin update complexity; rejected for primary source.
3. **Platform admin as support superuser:** rejected by privacy charter; future emergency grant requires separate ADR.

## Consequences

Positive: least privilege and clear vocabulary. Negative: additional membership read/versioning, offline revocation latency, UI context switching, and need to prevent generic `isAdmin` helpers in Mandiri.

## Security impact

Owner last-access invariant, no self-promotion, fresh permission on writes, and Rules/API actor matrix. Auth token/session object is SDK-managed; tokens are not stored in app database/log/export.

## Privacy impact

Platform staff cannot browse tenant/progress/health. Mentor consent is independent. A UID can participate in multiple domains without data joins.

## Offline impact

Verified membership snapshot may enable bounded offline local commands, marked pending. Cloud applies only after fresh check. Shared-device/account switch cleanup is mandatory.

## Migration impact

Existing admin docs remain unchanged in initial phases. Renaming runtime role values would require separate migration/Rules/UI compatibility PR and is not necessary merely to use clearer architecture terms.

## Open questions

- How long may cached membership authorize offline work?
- Is re-auth required for workspace deletion/ownership transfer/export?
- Is one active actor per device acceptable in MVP?
- How should invitation identity be verified without an email directory?
