# Architecture Decision Records — VitaNusa Mandiri

ADR mencatat satu keputusan arsitektur beserta alternatif dan dampaknya. Seluruh ADR pada Fase 0 adalah proposal; status tidak berarti implementasi sudah ada.

## Status

- `Proposed`: rekomendasi untuk review sebelum implementation PR.
- `Needs validation`: rekomendasi bergantung spike, owner decision, legal/license, cost, atau device test.
- `Accepted`: hanya setelah reviewer yang berwenang menyetujui dan bukti relevan tersedia.
- `Deferred`: keputusan sengaja ditunda.
- `Rejected`: alternatif tidak dipilih beserta alasan.
- `Superseded`: digantikan ADR baru; file lama tetap menjadi history.

## Index

| ADR | Status | Keputusan proposed |
| --- | --- | --- |
| [ADR-001](ADR-001-project-boundary.md) | Proposed | Mandiri modular di atas shell VitaNusa, domain inti tetap terpisah |
| [ADR-002](ADR-002-multi-tenant-workspaces.md) | Proposed | Nested workspace untuk data usaha |
| [ADR-003](ADR-003-offline-storage.md) | Proposed | IndexedDB + scoped repository untuk local-first |
| [ADR-004](ADR-004-sync-strategy.md) | Proposed | Transactional outbox + idempotency receipt + entity-specific conflict |
| [ADR-005](ADR-005-spreadsheet-generation.md) | Needs validation | Hybrid CSV/JSON offline dan rich XLSX online |
| [ADR-006](ADR-006-auth-and-role-model.md) | Proposed | Firebase identity, role platform/workspace/learning terpisah |
| [ADR-007](ADR-007-nusa-agent-actions.md) | Proposed | Draft + explicit confirmation + trusted validation |
| [ADR-008](ADR-008-health-and-business-data-separation.md) | Proposed | Health, learning, business, dan admin terpisah |

## Perubahan ADR

Jangan mengedit keputusan secara diam-diam setelah Accepted. Tambahkan bagian amendment atau ADR pengganti, perbarui decision/risk/test documents, dan jelaskan migration/rollback. Implementation PR harus menautkan ADR terkait dan menyebut bila asumsi masih `Needs validation`.
