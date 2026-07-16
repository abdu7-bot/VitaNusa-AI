# ADR-007 — NusaAgent Actions

## Status

**Proposed**.

## Context

Nusa Agent existing supports chat/navigasi through a safety pipeline. Business and learning users may ask it to prepare records. Direct model-to-database execution would make prompt/model output an authorization and calculation source.

## Decision

Adopt three modes: Informational, Draft, Execute-after-confirmation. Model output is an untrusted draft. An allowlisted schema validator identifies missing/user-sourced fields; UI shows human-readable preview. Execution requires an explicit control, active draft, short-lived one-time confirmation nonce, fresh auth/role/version checks, deterministic domain recomputation, operation ID, atomic audit, and receipt.

Initial implementation is draft-only. Each executable action requires its own threat/test review. High-risk actions remain manual-only even with confirmation.

## Alternatives

1. **Natural-language confirmation (“ya”):** ambiguous and replayable; rejected.
2. **Model function calling directly to repository:** model becomes trusted boundary; rejected.
3. **Informational Agent forever:** safest but misses draft usability; retained as fallback.

## Consequences

Positive: user control, auditable actions, deterministic values, model/provider failure does not block manual UI. Negative: more UI steps, action registry/schema maintenance, expiry/conflict handling, and usability testing.

## Security impact

No generic unrestricted action endpoint. Workspace comes from selected trusted context. Prompt injection treated as data. Permission changes and double confirm are denied/idempotent. Emergency/Policy Engine still runs for current message.

## Privacy impact

Only fields needed for a draft enter model context; no whole database, health history, or cross-tenant retrieval. Audit omits prompt/full payload. Draft TTL is short and cleared on logout.

## Offline impact

Informational local fallback remains. Draft can exist locally. Only actions explicitly safe for local domain command may commit/outbox offline; server-only actions remain unavailable with honest status.

## Migration impact

Action schema is versioned. Existing chat route/response remains backward compatible. Removing executable actions only disables registry entries; manual forms and informational Agent continue.

## Open questions

- Which single low-risk action, if any, should be first executable pilot?
- Is re-auth needed for expense/product creation?
- How should confirmation preview support low literacy without hiding detail?
- Should all financial actions remain form-submit manual through Pilot?
