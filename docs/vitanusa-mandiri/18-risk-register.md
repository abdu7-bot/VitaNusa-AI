# 18 — Risk Register

Status values are initial planning assessments, not measured production statistics. Owner is an accountable role, not a named individual.

| ID | Risk | Category | Likelihood | Impact | Severity | Owner | Mitigation | Trigger | Contingency | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | Scope terlalu besar untuk dikendalikan | Product | High | High | Critical | Product owner | Eight phases, feature flags, small PRs, out-of-scope gates | PR crosses multiple domains | Cut scope to foundation/local MVP | Open |
| R02 | UI terlalu rumit untuk tugas singkat | UX | Medium | High | High | Product owner | One-task screens, usability test, no role clutter | Users need repeated assistance | Simplify flow/disable advanced role | Open |
| R03 | Bahasa sulit atau mempermalukan pelajar | Content | Medium | High | High | Content reviewer | Language guide, target-user review, banned labels | Confusion/stigma feedback | Withdraw/revise content package | Open |
| R04 | Data hilang saat offline/storage pressure | Technical | Medium | Critical | Critical | Technical lead | Atomic IndexedDB, quota UX, backup, migrations | quota/migration error | Read-only recovery/export | Open |
| R05 | Transaksi ganda saat sync | Integrity | Medium | Critical | Critical | Technical lead | Operation receipt/hash/idempotency | retry count/duplicate report | Freeze sync, reconcile ledger | Open |
| R06 | Tenant isolation bocor | Security | Low–Medium | Critical | Critical | Security reviewer | Nested paths, no admin bypass, >=56 tests | cross-tenant denial anomaly | Disable cloud access, incident response | Open |
| R07 | Firestore read/write cost membesar | Cost | Medium | High | High | Technical lead | Query budget, pagination, no global scan, pilot metrics | budget threshold | Limit sync/report, optimize indexes | Open |
| R08 | Laporan atau estimasi keliru | Business | Medium | High | High | Product owner | Domain reconciliation, immutable snapshot, disclaimers | mismatch test/user report | Disable export/report, issue corrected file | Open |
| R09 | Role platform/tenant tertukar | Security | Medium | Critical | Critical | Security reviewer | Namespace separation, explicit deny, ADR-006 | code uses generic `isAdmin` | Block merge/disable path | Open |
| R10 | Shared Android device membuka data akun lama | Privacy | High | High | Critical | Security reviewer | accountScope, purge option/mode, no SW data cache | account-switch leak | Purge local scope, notify affected users | Open |
| R11 | PWA cache/schema lama tidak kompatibel | Technical | Medium | High | High | Technical lead | update gate, DB min version, rollback shell | migration/update failures | Serve read-only update-required page | Open |
| R12 | Workbook rusak/terlalu besar | Technical | Medium | Medium | Medium | Technical lead | row limit, parser validation, CSV fallback | open/generation failure | Offer CSV split and retry | Open |
| R13 | Dependency XLSX berlisensi/tidak aman | Legal/Security | Medium | High | High | Technical lead | ADR/license/CVE/bundle review before add | library decision | Use backend openpyxl or CSV only | Open |
| R14 | Backend Render tidak tersedia | Operational | High | Medium | High | Technical lead | local-first, honest status, retries, CSV offline | health/request failure | Queue sync; disable online XLSX/action | Open |
| R15 | AI membuat/menjalankan tindakan salah | Safety | Medium | Critical | Critical | Security reviewer | draft-only default, confirmation, recompute, allowlist | action mismatch | Disable execution flag, preserve manual UI | Open |
| R16 | Konten belajar tidak sesuai sasaran | Product/Content | Medium | High | High | Content reviewer | versioned content, pilot review, no auto-publish | low comprehension/complaint | Roll back package version | Open |
| R17 | Klaim kesehatan/halal berlebihan masuk materi/produk | Safety | Medium | Critical | Critical | Content reviewer | existing constitution/policy, source-only product data | safety test/reviewer flag | Unpublish content; block route | Open |
| R18 | Pilot tanpa onboarding/dukungan | Operational | Medium | High | High | Pilot coordinator | training, small enrollment, support/runbook | repeated errors/tickets | Pause pilot and retrain | Open |
| R19 | Tidak ada backup sebelum device loss | Operational | High | High | Critical | Product owner | backup reminder, optional cloud, restore test | device/storage incident | Explain limitation; recover last cloud/export only | Open |
| R20 | Konflik multi-device tidak dipahami | UX/Integrity | Medium | High | High | Product owner | conflict copy/preview, restrict first pilot | unresolved/dead-letter growth | Single-device mode; manual reconciliation | Open |
| R21 | Retention finansial salah atau tak jelas | Privacy/Legal | Medium | High | High | Product owner | owner/legal decision before pilot, deletion policy | pilot readiness review | Keep pilot local/small; delay cloud | Open |
| R22 | Import file merusak katalog | Security/Integrity | Medium | High | High | Technical lead | preview, schema/limits, idempotent commit, backup | validation/commit mismatch | Abort/restore pre-import snapshot | Open |
| R23 | Audit log menyimpan data berlebihan | Privacy | Medium | High | High | Security reviewer | field allowlist, redaction tests, retention | payload appears in log | Stop logging, purge per incident plan | Open |
| R24 | Offline permission revoke terlambat | Security | Medium | High | High | Security reviewer | bounded permission snapshot, recheck sync, device policy | removed cashier continues offline | Deny sync, reconcile/audit, shorten offline lease | Needs validation |

## Review cadence

Register ditinjau pada awal/akhir setiap fase, saat ADR berubah, dan setelah insiden/pilot. Severity tidak diturunkan hanya karena mitigasi direncanakan; diperlukan test evidence dan owner acceptance. Risiko Critical yang terkait tenant, uang, data loss, atau Agent memblokir pilot bila statusnya tidak memiliki mitigasi teruji.
