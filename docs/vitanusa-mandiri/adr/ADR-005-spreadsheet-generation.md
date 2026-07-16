# ADR-005 — Spreadsheet Generation

## Status

**Needs validation**.

## Context

Users need portable CSV and rich XLSX reports. Client-side XLSX supports offline use but can enlarge bundle and exhaust Android memory. Backend openpyxl offers deterministic control but requires network, authenticates highly sensitive financial snapshots, and creates temporary files.

## Decision

Recommend hybrid: generate CSV and versioned backup JSON locally/offline; generate the ten-sheet rich XLSX through an authenticated backend job when online. Keep one report snapshot/schema so both paths reconcile. Before implementation, run a spike for privacy, auth/IDOR, performance, hosting cost, openpyxl licensing/maintenance, temporary file cleanup, and common spreadsheet compatibility.

If owner requires offline XLSX, reopen this ADR and compare a client library's license, bundle size, memory, formula safety, and maintenance. No library is added during Fase 0.

## Alternatives

1. **Client-only XLSX:** best offline, but performance/license/bundle unknown; not selected without spike.
2. **Backend-only all formats:** browser light but removes offline portability; rejected.
3. **CSV only:** simplest/safest MVP but lacks requested workbook richness; viable fallback.

## Consequences

Positive: early offline portability, rich workbook control, smaller baseline bundle. Negative: two generation paths, online data processing, backend availability/cost, and snapshot contract complexity.

## Security impact

All text cells neutralize formula prefixes; no macros/external links. Online jobs bind actor/workspace, use short-lived downloads, row/size limits, and no tenant-global query. Import remains preview-only and does not accept arbitrary XLSX in MVP.

## Privacy impact

CSV/JSON remain on device. XLSX sends a minimized immutable snapshot or asks backend to query only authorized workspace—final choice needs privacy review. Temporary files expire and are not emailed/logged.

## Offline impact

CSV and backup remain available. Rich XLSX is unavailable offline under recommendation and UI must state this honestly.

## Migration impact

Workbook/schema versions live in export metadata. Column/sheet changes require versioning/backward compatibility. Switching generator must pass golden-workbook reconciliation.

## Open questions

- Is rich XLSX offline mandatory?
- Which spreadsheet apps/devices are pilot targets?
- What maximum rows/file size are realistic?
- May financial snapshots be processed by current Render service?
- What temporary storage is durable/secure enough without increasing retention?
