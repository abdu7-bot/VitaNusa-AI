# ADR-002 — Multi-tenant Workspaces

## Status

**Proposed**.

## Context

Data usaha dimiliki bersama anggota satu workspace, bukan satu UID. Sistem harus mendukung owner/cashier, export/delete per usaha, Rules yang dapat diaudit, dan sync offline tanpa memberi platform admin akses global.

## Decision

Gunakan `workspaces/{workspaceId}` sebagai tenant root dengan subcollection member dan entity usaha. `workspaceId` UUID client-generated dan juga divalidasi pada command. Membership `workspaces/{workspaceId}/members/{uid}` adalah satu-satunya sumber role tenant cloud. Setiap workspace minimal satu active merchant owner. Platform roles tidak diperiksa sebagai allow path tenant.

Learning tetap user-centric; ia bukan child workspace. MVP merekomendasikan satu toko per workspace dan hanya owner/cashier pada implementasi awal.

## Alternatives

1. **Top-level collections + workspaceId field:** query global mudah tetapi filter/Rules mudah salah; rejected untuk MVP.
2. **User-owned copies:** self Rules sederhana tetapi data bersama berkonflik/terduplikasi; rejected untuk POS.
3. **Single global merchant document:** tidak mendukung batas/anggota/export/deletion dengan jelas; rejected.

## Consequences

Positive: path menunjukkan tenant, query/export/deletion scoped, membership logic seragam. Negative: membership lookup cost, cascade deletion manual, collection-group analytics dibatasi, and owner-count invariant may need trusted transaction/service.

## Security impact

Every get/list/write requires active membership and action-role check. Unknown roles deny. Owner transfer is atomic. API with privileged credentials must reproduce the same matrix and cannot inherit platform admin rights.

## Privacy impact

Products and financial records are tenant-private/sensitive. No customer personal profile in MVP. Workspace members can only see role-appropriate subsets; cashier reports are limited.

## Offline impact

Local records carry accountScope/workspaceId. Cached membership enables bounded offline UX but is not cloud authority. Revocation latency is residual risk; first local MVP is single device.

## Migration impact

No existing tenant data exists. Once production data exists, changing root structure requires dual-read/write or export/reimport and Rules migration; therefore hierarchy must be spiked before Phase 5.

## Open questions

- Is multi-device required for first cloud pilot?
- What offline permission lease is acceptable after revocation?
- How is receipt numbering unique across devices?
- Is any tenant-authorized emergency recovery path required?
