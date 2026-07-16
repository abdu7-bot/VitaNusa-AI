# 19 — Decision Register and Open Questions

Status `Accepted` hanya dipakai untuk constraint yang sudah menjadi prinsip proyek/repository. Pilihan implementasi Fase 0 umumnya `Proposed` atau `Needs validation`.

## Decision register

| ID | Decision | Status | Rekomendasi/rationale | ADR/evidence | Validation/trigger |
| --- | --- | --- | --- | --- | --- |
| D01 | Project boundary | Proposed | Mandiri sebagai modul terpisah di shell VitaNusa; core health tetap terpisah | ADR-001 | Review owner sebelum Fase 1 |
| D02 | Frontend framework | Accepted | Pertahankan HTML/CSS/JS modular + Vite; tidak ada framework besar | Existing `package.json`, `vite.config.js` | Reopen hanya bila measured need |
| D03 | Local database | Proposed | IndexedDB melalui wrapper/repository | ADR-003 | Migration/quota/device spike |
| D04 | Cloud database | Proposed | Firestore nested workspace; learning user-centric | ADR-002, doc 07 | Query/cost/Rules spike |
| D05 | Tenant model | Proposed | Workspace root + membership; no platform bypass | ADR-002/006 | >=56 security tests |
| D06 | Money representation | Proposed | Integer rupiah IDR, safe integer; fixed-point quantity if needed | Doc 06/09 | Unit boundary tests |
| D07 | Transaction immutability | Proposed | Final sale create-only; void/reversal | Doc 09 | Domain/Rules tests |
| D08 | Inventory model | Proposed | Append-only stock movement + verifiable balance snapshot | Doc 08/09 | Multi-device chaos |
| D09 | Sync strategy | Proposed | Local transaction + outbox + idempotency receipt + explicit conflict | ADR-004 | Command boundary spike |
| D10 | Spreadsheet strategy | Needs validation | Hybrid: offline CSV/JSON, rich XLSX online | ADR-005 | Offline XLSX owner requirement/license/perf |
| D11 | Auth model | Proposed | Reuse Firebase Auth identity; login not membership | ADR-006 | Shared-device/offline session tests |
| D12 | Role model | Proposed | Separate platform/workspace/learning namespaces | ADR-006 | Rules/UI matrix |
| D13 | Agent action model | Proposed | Informational/draft; execute only confirmed allowlist | ADR-007 | First action threat/usability review |
| D14 | Audit log | Needs validation | Append-only minimal event, tenant-owner read, 12-month proposed | Doc 16 | Cost/legal/retention review |
| D15 | Data retention | Needs validation | Per-domain policy; no implicit forever | Doc 13 | Owner/legal before pilot |
| D16 | Health/business separation | Proposed | Separate paths/repositories/consents/exports; no join | ADR-008 | Security/privacy tests |
| D17 | Final financial write boundary | Needs validation | Compare strict client transaction vs authenticated sync service | Doc 07/08 | Fase 5 spike; service credential threat |
| D18 | Quantity model | Needs validation | Whole units MVP; fixed-point only if products timbang required | Doc 06/09 | Owner answer before Fase 3 |
| D19 | Workspace count | Needs validation | One store per workspace MVP, one active workspace UX at a time | Question Q01 | Pilot/business decision |

## Pertanyaan yang memerlukan keputusan owner

| Q | Pertanyaan | Dampak | Rekomendasi | Memblokir Fase 1? |
| --- | --- | --- | --- | --- |
| Q01 | Apakah NusaKasir ditujukan untuk satu toko dahulu? | Menentukan workspace UX, report, dan sync | Ya: satu toko per workspace; multi-cabang deferred | Tidak; memblokir scope Fase 3 |
| Q02 | Apakah kuantitas pecahan diperlukan pada MVP? | Mengubah schema quantity, stock, sale, workbook, rounding | Tidak untuk MVP; bila wajib gunakan fixed-point scale | Tidak; memblokir Fase 3 schema |
| Q03 | Apakah pembayaran campuran diperlukan? | Menambah multiple Payment, change/allocation, report | Tunda; tunai tunggal MVP | Tidak; memblokir Payment Fase 3 bila ya |
| Q04 | Apakah transaksi hutang termasuk MVP? | Membutuhkan customer/debt/privacy/collection domain | Tidak; di luar MVP | Tidak |
| Q05 | Apakah pajak perlu dicatat? | Terminologi/legal/calculation/report berubah | Hanya field informasional setelah review; jangan hitung pajak MVP | Tidak |
| Q06 | Apakah struk harus dapat dicetak? | Hardware/browser support, format, privacy | Share/download sederhana dulu; print browser optional | Tidak |
| Q07 | Apakah barcode diperlukan? | Camera permission/scanner/hardware/product schema | Tunda sampai POS local stabil | Tidak |
| Q08 | Apakah XLSX wajib dapat dibuat offline? | Menentukan library client, bundle, memory, ADR-005 | CSV/JSON offline; XLSX online hybrid | Tidak untuk Fase 1; memblokir Fase 4 decision |
| Q09 | Berapa lama transaksi disimpan? | Retention, deletion, cost, backup, legal | Putuskan sebelum pilot dengan review hukum/operasional | Tidak; memblokir cloud pilot |
| Q10 | Apakah mentor diundang melalui email? | Membutuhkan email provider, token, privacy, anti-abuse | Mulai link/token sekali pakai yang dibagikan learner; email deferred | Tidak; memblokir mentor cloud |
| Q11 | Materi belajar dibuat admin atau file statis? | Authoring workflow, review, offline package, publish permission | Versioned static package untuk MVP; admin authoring post-MVP | Tidak; memblokir Fase 2 content pipeline bila berbeda |
| Q12 | Apakah progres belajar dapat diekspor? | Portability, workbook/CSV, privacy | Ya oleh learner; tidak oleh mentor default | Tidak |
| Q13 | Apakah owner toko dapat memakai beberapa perangkat? | Konflik, receipt number, stock availability, revoke latency | Local MVP satu perangkat; multi-device hanya Fase 5 | Tidak; memblokir pilot cloud scope |
| Q14 | Apakah satu perangkat dapat digunakan beberapa kasir? | Session switch, PIN/re-auth, accountability, local namespace | Tidak pada MVP tanpa re-auth model; satu active actor | Tidak; memblokir Fase 3 UX bila ya |
| Q15 | Bolehkah platform owner memulihkan data tenant saat darurat? | Membuka jalur privileged paling sensitif | Default tidak. Jika wajib, tenant-authorized, time-bound, dual-control, audited | Tidak; memblokir production recovery design |

## Keputusan yang tidak boleh dibuat diam-diam

Setiap jawaban yang berbeda dari rekomendasi harus memperbarui scope, data model, threat model, test strategy, risk register, dan ADR terkait sebelum code PR. Khusus Q02, Q03, Q04, Q09, Q13, Q14, dan Q15 dapat mengubah security/data boundary secara material.

## Owner review checklist

- Konfirmasi batas satu toko/workspace dan satu perangkat pada local MVP.
- Pilih kebutuhan quantity/payment/receipt yang benar-benar harus ada.
- Setujui bahasa laporan sederhana dan disclaimer.
- Putuskan retention sebelum cloud pilot.
- Setujui static content package dan consent mentor.
- Tentukan apakah recovery platform sama sekali diperlukan.
- Pilih apakah hybrid XLSX memenuhi portability.
