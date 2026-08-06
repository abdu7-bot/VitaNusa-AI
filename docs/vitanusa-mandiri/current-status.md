# VitaNusa Mandiri — Status Implementasi

Terakhir diperbarui: 26 Juli 2026

Dokumen ini mencatat keadaan implementasi yang benar-benar sudah berada di `main` dan pekerjaan yang masih terbuka. Roadmap tetap menjadi arah arsitektur; status ini tidak boleh dipakai untuk mengklaim aplikasi sudah production-ready.

## Ringkasan

| Area | Status | Bukti utama | Catatan |
| --- | --- | --- | --- |
| Fase 1 — Foundation | Implemented | Fondasi local-only, workspace, permission, IndexedDB, repository, audit, backup, recovery preview | Tetap internal dan feature-flagged |
| Fase 2 — NusaBelajar MVP | Implemented untuk scope internal lokal | PR #56–#64 | Konten awal, reader, exercise, quiz, progress, offline hardening; belum cloud/pilot |
| Fase 3 — NusaKasir Local MVP | In progress | PR #65–#85 merged; PR #86 draft | Produk, inventory, cart, sale/payment/receipt, Expense dan CashSession foundation sudah tersedia |
| Fase 4 — VitaSheet | Not started sebagai fase penuh | CSV/backup JSON existing menjadi fondasi | Menunggu kontrak laporan Fase 3 stabil |
| Fase 5 — Cloud Workspace | Not started | — | Tidak boleh didahulukan sebelum domain lokal matang |
| Fase 6 — NusaAgent Actions | Not started | — | NusaAgent tetap informational/draft-only |
| Fase 7 — Security & Hardening | Partial cross-cutting work | PR #79 dan #84 | Hardening backend dan content rendering sudah merged; phase-wide chaos/recovery belum selesai |
| Fase 8 — Pilot | Not started | — | Tidak ada klaim produksi atau rollout luas |

## Fase 3 — keadaan aktual

### Sudah merged ke `main`

1. Product domain foundation.
2. Product persistence dan backup v3.
3. Product management UI.
4. Inventory foundation dan backup v4.
5. Inventory management UI dan navigasi.
6. CartDraft dan sale preview foundation, persistence, serta hardening v5.
7. Sale, Payment tunai, Receipt immutable, stock deduction, dan backup v6.
8. Expense dan CashSession foundation, repository parity, transaksi atomik, serta backup v7.

Schema lokal yang menjadi sumber kebenaran saat dokumen ini dibuat adalah **IndexedDB v7** dan **backup v7**. Versi lama tetap hanya dipreview sesuai kontrak compatibility; tidak ada downgrade-write atau restore commit otomatis.

### Sedang direview

- PR #86 — Cash Session dan Expense UI.
- Status GitHub saat snapshot ini dibuat: open, draft, mergeable, base `main`.
- PR harus tetap menunggu review kode, seluruh test relevan, GitHub Actions hijau, dan pemeriksaan browser dasar sebelum merge.

### Belum dikerjakan dalam Fase 3

- void/reversal untuk Sale final;
- local report yang merekonsiliasi Sale, Payment, Expense, CashSession, dan inventory movement;
- end-to-end day simulation dan crash/retry hardening;
- recovery/read-only flow untuk data schema baru bila binary lama dibuka;
- smoke test browser/Android nyata;
- printer/PDF, refund, split payment, debt, barcode, cloud sync, dan multi-device tetap di luar MVP saat ini.

## Pekerjaan lintas area yang sudah selesai

- Backend security hardening: Bearer auth, redaksi log/queue, rate limit, retention, dan fail-closed behavior telah merged melalui PR #79.
- Static page accessibility telah merged melalui PR #81.
- Content rendering security berbasis allowlist ketat telah merged melalui PR #84.
- Dokumentasi Navigator Kesehatan Multi-Bidang dengan biaya layanan digital Rp0 telah merged melalui PR #83; implementasi runtime belum diklaim selesai.

## Urutan kerja berikutnya

1. Selesaikan review dan merge PR #86 tanpa memperluas scope schema, backup, refund, atau laporan.
2. Buat PR terpisah untuk **Fase 3 PR 10 — Sale void/reversal foundation**.
3. Buat PR terpisah untuk **Fase 3 PR 11 — Local report foundation dan UI**.
4. Buat PR terpisah untuk **Fase 3 PR 12 — end-to-end hardening dan simulated business day**.
5. Jalankan smoke test browser/Android dengan data nyata non-sensitif, termasuk reload, retry, double tap, storage blocked/quota, dan backup preview.
6. Triage PR lama #2, #3, dan #4; jangan merge otomatis karena sudah tertinggal jauh dari `main` dan perlu diputuskan apakah ditutup, dibangun ulang, atau ditinggalkan sebagai eksperimen.

## Release blockers

VitaNusa Mandiri belum boleh disebut siap produksi sebelum minimal:

- tidak ada defect critical/high pada money, permission, tenant/account scope, idempotency, migration, dan backup;
- Sale final, stock movement, Expense, CashSession, void/reversal, dan report dapat direkonsiliasi dalam satu simulated day;
- browser/Android smoke test lulus;
- backup aktual berhasil dibuat dan preview valid, corrupt, serta scope-mismatch diuji;
- rollback tidak menurunkan schema dan tidak menghapus data pengguna;
- seluruh CI dan security regression hijau;
- feature flag dan jalur recovery telah diuji.

## Aturan perubahan

- Jangan bekerja langsung di `main`.
- Satu fokus per branch dan Pull Request.
- Jangan menjalankan dua agent untuk mengedit branch yang sama secara bersamaan.
- Jangan merge bila CI, review, atau pemeriksaan scope belum selesai.
- Jangan downgrade IndexedDB atau mengubah backup secara destruktif.
- Jangan menyimpan token, API key, password, UID, data kesehatan, atau data usaha sensitif di repository maupun log.
- Deployment merupakan tindakan terpisah setelah merge dan persetujuan eksplisit.
