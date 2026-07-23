# Status Aktual VitaNusa Mandiri

Tanggal audit: **24 Juli 2026**  
Sumber kebenaran implementasi: branch **`main`**  
Commit `main` yang diamati saat audit: **`a036565b982d95cc127a4f1528e560f7dcbd2145`**

Dokumen ini adalah ringkasan status faktual. Ia tidak menggantikan ADR, threat model, runbook, atau spesifikasi domain. Bila ada perbedaan antara dokumen lama dan kode/test di `main`, kode serta test aktual menjadi bukti implementasi, sedangkan dokumen lama dibaca sebagai catatan historis atau rancangan.

## Ruang lingkup audit

Audit membaca:

- [17-phased-roadmap.md](17-phased-roadmap.md);
- seluruh dokumentasi bernomor `00` sampai `34` di `docs/vitanusa-mandiri/`, termasuk dua dokumen bernomor `23`;
- `package.json`;
- `assets/js/mandiri/storage/schema.js`;
- `assets/js/mandiri/export/backup-schema.js`;
- halaman aktual di `mandiri/`;
- struktur dan test utama di `tests/mandiri/`;
- metadata PR #79 secara read-only.

Audit tidak mengubah kode, test, backend, schema, konfigurasi, service worker, manifest, atau README utama.

## Definisi status

| Status | Kriteria |
| --- | --- |
| **Selesai di `main`** | Implementasi dan test relevan tersedia pada `main`. Status ini tidak otomatis berarti production-ready. |
| **Sedang direview / belum merge** | Ada PR terbuka atau branch kerja yang belum masuk `main`. |
| **Belum dimulai** | Tidak ditemukan implementasi di `main` atau PR terbuka yang relevan. |
| **Rencana masa depan** | Arah setelah dependency/gate lain selesai; bukan janji fitur tersedia. |

## Snapshot utama

| Area | Status aktual |
| --- | --- |
| VitaNusa Mandiri | Internal, local-only, default feature flag `off`. |
| NusaBelajar | Internal, local-first; scope Fase 2 selesai di `main`. |
| NusaKasir | Internal, local-first; Fase 3 masih berjalan. |
| IndexedDB | Database `vitanusa-mandiri`, version **6**. |
| Backup | Format version **6**, database schema version **6**, checksum SHA-256. |
| Recovery | Validasi dan preview-only; tidak ada restore commit/write. |
| Firestore Mandiri | Belum tersedia. |
| Cloud sync | Belum tersedia. |
| Checkout UI | Belum tersedia. |
| Void/refund | Belum tersedia. |
| Laporan/VitaSheet | Belum tersedia selain backup JSON dan preview recovery. |
| PR Mandiri terbuka | Tidak ditemukan pada saat audit. |
| PR #79 | Sudah merged; hardening backend umum, bukan fitur Mandiri. Tidak disentuh. |

## Feature flag aktual

| Fitur | Environment key | State | Ketentuan |
| --- | --- | --- | --- |
| VitaNusa Mandiri | `VITE_VITANUSA_MANDIRI_STATE` | `off|internal` | Nilai kosong/tidak dikenal menjadi `off`. |
| NusaBelajar | `VITE_NUSABELAJAR_STATE` | `off|internal` | Hanya aktif bila Mandiri juga `internal`. |
| NusaKasir | `VITE_NUSAKASIR_STATE` | `off|internal` | Hanya aktif bila Mandiri juga `internal`. |

Feature flag bukan permission. Role dan scope tetap diperiksa oleh domain/service/repository yang relevan.

## Halaman yang benar-benar tersedia

| Path | Fungsi aktual | Status |
| --- | --- | --- |
| `mandiri/index.html` | Dashboard internal, workspace lokal, status local-only, backup, dan pintu modul. | **Selesai di `main`** |
| `mandiri/recovery.html` | Memeriksa file backup, scope, versi, record count, dan checksum; tidak menulis data. | **Selesai di `main`** |
| `mandiri/belajar/index.html` | Katalog internal NusaBelajar dan ringkasan progres lokal. | **Selesai di `main`** |
| `mandiri/belajar/lesson.html` | Lesson reader, latihan, kuis, dan progres lokal. | **Selesai di `main`** |
| `mandiri/kasir/products.html` | Pengelolaan kategori dan produk lokal. | **Selesai di `main`** |
| `mandiri/kasir/inventory.html` | Saldo, histori, opening stock, purchase in, dan adjustment lokal. | **Selesai di `main`** |

Tidak ditemukan halaman aktual untuk:

- cart;
- checkout;
- input pembayaran;
- daftar transaksi;
- detail receipt;
- void/refund;
- expense;
- cash session;
- laporan;
- import;
- cloud sync/conflict.

## IndexedDB aktual

Nama database: `vitanusa-mandiri`  
Versi saat ini: **6**

| Versi | Store yang diperkenalkan |
| ---: | --- |
| 1 | `metadata`, `workspaces`, `memberships`, `auditEvents`, `operationReceipts` |
| 2 | `learningAttempts`, `learningProgress` |
| 3 | `categories`, `products` |
| 4 | `stockMovements`, `inventoryBalances` |
| 5 | `cartDrafts`, `cartLines` |
| 6 | `sales`, `saleLines`, `payments`, `receipts` |

Total store aktif pada v6: **17**.

Store yang disebut sebagai masa depan dan belum aktif:

- `expenses`;
- `cashSessions`;
- `syncOutbox`;
- `syncConflicts`.

Tidak ada downgrade otomatis, penghapusan store, atau clear data sebagai bagian migration normal.

## Backup aktual

| Properti | Nilai |
| --- | --- |
| Format | `vitanusa-mandiri-backup` |
| Format version | **6** |
| Database schema version | **6** |
| Checksum | SHA-256 |
| Ukuran file preview | Maksimum 5 MiB |
| Versi lama yang tetap diterima validator | 1, 2, 3, 4, dan 5 |
| Restore commit | Tidak tersedia |

Collection backup v6:

- workspace, membership, audit event, operation receipt;
- learning attempt dan learning progress;
- category dan product;
- stock movement dan inventory balance;
- cart draft dan cart line;
- sale, sale line, payment, dan receipt.

Backup adalah ekspor lokal versioned, bukan cloud backup, tanda tangan digital, atau enkripsi. Recovery hanya melakukan validasi dan preview.

## Status fase

### Fase 1 — Foundation

**Status: selesai di `main` untuk fondasi internal local-only.**

Tersedia:

- shell dan feature gate;
- workspace lokal dan initial owner atomik;
- permission lokal;
- money, ID, idempotency, audit;
- IndexedDB/repository scoped;
- backup JSON;
- recovery preview-only;
- test exit, storage, repository, service, backup, security, shell, dan recovery.

Catatan: dokumen Fase 1 yang menyebut schema version 1 tetap berguna sebagai sejarah fase. Ia tidak menggambarkan schema terkini yang sudah v6.

### Fase 2 — NusaBelajar

**Status: selesai di `main` untuk scope internal local-first.**

Tersedia:

- domain/schema konten;
- satu paket `money-basics-id-v1` published/approved;
- satu program, satu course, satu module, tiga lesson, sembilan exercise, dan satu module quiz;
- katalog dan lesson reader;
- lima tipe latihan deterministik;
- kuis, completed attempt append-only, progress atomik, best score, dan rekomendasi lesson;
- guest learner scope lokal;
- backup/recovery preview;
- offline static allowlist dan integrity validation;
- suite test phase-exit.

Belum tersedia:

- cloud progress;
- mentor;
- authoring UI;
- banyak course/package;
- leaderboard/sertifikat;
- AI grading;
- production release.

### Fase 3 — NusaKasir

**Status: berjalan; merged sampai fondasi payment dan receipt.**

Selesai di `main`:

1. Category dan Product domain.
2. Persistensi Category/Product.
3. UI kategori/produk.
4. Inventory ledger dan balance.
5. UI inventory manual.
6. Cart draft dan sale preview persistence.
7. Finalisasi cart ke Sale/SaleLine.
8. Satu Payment tunai MVP dengan underpayment reject dan change deterministik.
9. Receipt snapshot immutable.
10. Pengurangan inventory untuk produk tracked pada transaction finalisasi yang sama.
11. Audit dan operation receipt atomik.
12. Backup/schema v6 dan kompatibilitas preview versi lama.

Belum tersedia:

- UI cart/checkout;
- UI pembayaran/finalisasi;
- daftar transaksi dan receipt viewer;
- nomor struk human-readable;
- printer/PDF/share receipt;
- expense;
- cash session dan cash movement;
- void/reversal;
- refund;
- laporan;
- restore commit;
- cloud sync;
- multi-device reconciliation.

Fondasi sale/payment/receipt sudah ada dan diuji, tetapi belum dapat dipakai pengguna tanpa UI checkout. Karena itu Fase 3 belum selesai.

### Fase 4 — VitaSheet

**Status: belum dimulai sebagai fase.**

Yang sudah ada hanyalah prerequisite lintas fase berupa backup JSON dan preview recovery. CSV report, import preview, report snapshot, formula-injection test pada file hasil nyata, dan XLSX belum tersedia.

### Fase 5 — Cloud Workspace

**Status: belum dimulai.**

Tidak ada Firestore tenant Mandiri, membership cloud, sync outbox aktif, sync conflict aktif, cloud adapter, conflict UI, atau deletion job Mandiri.

### Fase 6 — NusaAgent Actions

**Status: belum dimulai.**

Tidak ada action registry, draft, preview confirmation, nonce, atau command execution Mandiri. Agent tetap informasional.

### Fase 7 — Security & Hardening

**Status: belum dimulai sebagai fase formal.**

Hardening per-PR sudah ada, tetapi belum ada candidate lengkap untuk matrix cloud, chaos multi-device, retention/deletion, restore commit drill, dan security review penuh.

### Fase 8 — Pilot

**Status: rencana masa depan.**

Belum ada pilot evidence, physical Android matrix lengkap, onboarding pilot, support readiness, atau broad release.

## Test evidence aktual

`package.json` menyediakan suite agregat `npm run test:mandiri` yang menjalankan kelompok test berikut:

- shell dan feature flag;
- domain, storage, migration, repository, dan workspace service;
- backup, restore preview, dan security boundaries;
- NusaBelajar domain, content package, reader, progress, offline, dan phase exit;
- NusaKasir domain, product persistence/UI, inventory persistence/UI, cart, dan sale finalization.

Bukti penting yang ditemukan:

- test schema menetapkan IndexedDB v6 dan 17 store aktif;
- test backup menetapkan format/schema v6;
- test Fase 2 memastikan schema v2 tetap dipertahankan melalui migrasi lanjutan;
- test sale finalization membuktikan Sale, Payment, Receipt, cart finalization, inventory deduction, audit, dan operation receipt berjalan atomik;
- test sale finalization membuktikan data final bertahan setelah IndexedDB ditutup dan dibuka kembali;
- test rollback membuktikan kegagalan audit tidak meninggalkan sale/payment/receipt/cart/inventory parsial.

Test adalah bukti implementasi otomatis, tetapi tidak menggantikan pengujian usability, browser nyata, Android fisik, dan security review produksi.

## Pekerjaan sedang direview atau belum merge

Pada waktu audit:

- tidak ditemukan PR terbuka yang relevan dengan VitaNusa Mandiri, NusaBelajar, atau NusaKasir;
- PR #79 sudah merged dan berisi hardening backend umum;
- branch `docs/vitanusa-status-sync` hanya membawa penyelarasan dokumentasi ini dan tidak menambah fitur produk.

Bila ada branch baru setelah audit, statusnya harus diperiksa ulang sebelum dokumentasi menyebut fitur tersedia.

## Ketidaksesuaian dokumentasi yang ditemukan

| Dokumen/area | Ketidaksesuaian |
| --- | --- |
| `README.md` folder Mandiri | Masih menggambarkan paket terutama sebagai proposal Fase 0, sementara implementasi Fase 1–3 sudah masuk `main`. Tidak diubah karena tugas ini membatasi perubahan ke roadmap dan status baru. |
| `01-current-system-audit.md` | Menyebut NusaBelajar, NusaKasir, dan IndexedDB belum tersedia; kini tidak benar untuk `main`. |
| `04-domain-and-module-map.md` | Menandai learning, POS, dan local repository sebagai planned; sekarang sebagian sudah implemented. |
| `06-data-model.md` | Menyatakan belum membuat IndexedDB; sekarang schema v6 aktif. |
| `08-offline-first-and-sync.md` | Menyatakan tidak ada IndexedDB runtime pada Fase 0; benar sebagai sejarah Fase 0, bukan status saat ini. |
| `09-nusakasir-domain-rules.md` | Menyatakan NusaKasir belum diimplementasikan; kini sebagian besar fondasi lokal sudah ada. |
| `10-nusabelajar-architecture.md` | Menyatakan NusaBelajar belum diimplementasikan; Fase 2 internal local-first kini selesai. |
| `15-test-strategy.md` | Menyebut nama/path test sebagai rencana; banyak test tersebut kini nyata tersedia. |
| `20-phase-1-backlog.md` | Status berhenti pada PR Fase 1 awal dan tidak mencerminkan kemajuan sampai schema v6. |
| `21-phase-1-implementation.md` | Benar sebagai snapshot Fase 1, tetapi schema version 1 dan daftar data yang belum disimpan sudah historis. |
| `22-phase-1-runbook.md` | Batas “bukan kasir/belajar” adalah batas Fase 1, bukan keadaan repository sekarang. |
| `23-dashboard-product-blueprint.md` | Dashboard statis awal masih menulis NusaBelajar/NusaKasir planned; runtime shell sekarang mengaktifkan keduanya bila flag internal sesuai. |
| `27-phase-2-exit.md` | Menyebut Fase 3 belum dimulai; benar saat dokumen dibuat, tetapi tidak lagi menjadi status terkini. |
| `32-phase-3-inventory-management-ui.md` | Menyebut IndexedDB tetap v5 walau inventory foundation berasal dari v4; urutan merge lanjutan membuat status akhir v6. Dokumen ini harus dibaca sebagai snapshot PR. |

Dokumen historis tidak dihapus. Status terkini dipusatkan di file ini dan roadmap yang diperbarui.

## Pekerjaan terbuka prioritas

### Untuk menutup Fase 3

1. UI cart dan checkout.
2. UI payment tunai dan finalisasi.
3. Sale/receipt history dan receipt viewer.
4. Human-readable receipt number serta print/share policy.
5. Expense dan cash movement.
6. Cash session open/close serta reconciliation.
7. Void/reversal; refund tetap workflow terpisah.
8. Laporan lokal dan full-day UI simulation.
9. Backup/recovery rehearsal pada data transaksi yang lebih besar.
10. Browser nyata dan Android fisik.

### Setelah Fase 3 stabil

- VitaSheet/reporting dan CSV/import preview;
- keputusan XLSX;
- Cloud Workspace dan sync;
- Agent actions;
- hardening formal;
- pilot.

## Batas klaim

- `main` memiliki fondasi lokal yang nyata, tetapi VitaNusa Mandiri belum production-ready.
- Sale/payment/receipt tersedia sebagai domain dan persistence, bukan checkout UI.
- Backup tersedia, restore commit belum tersedia.
- Online browser tidak berarti tersinkron ke cloud.
- IndexedDB bukan enkripsi end-to-end.
- Laporan dan pembukuan resmi belum tersedia.
- Roadmap adalah arah kerja, bukan bukti implementasi.
