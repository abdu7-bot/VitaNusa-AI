# 23 — Dashboard Product Blueprint VitaNusa Mandiri

Status: implementasi UI local-only untuk review. Dokumen ini tidak mengubah ADR Fase 1, tidak mengaktifkan modul planned, dan tidak menandai VitaNusa Mandiri siap produksi.

## Tujuan

Dashboard menyatukan hubungan antara pengguna, Tanya Nusa, workspace lokal, backup JSON, recovery preview-only, dan batas produk. Antarmuka harus tenang, mudah dipahami, responsif, aksesibel, serta jujur mengenai fungsi yang sudah dan belum tersedia.

## Status modul

| Modul | Status | Tindakan |
| --- | --- | --- |
| Tanya Nusa | Aktif | Link menuju halaman percakapan VitaNusa yang sudah tersedia. |
| NusaKasir | Direncanakan | Tidak mempunyai navigasi atau fungsi kasir palsu. |
| NusaBelajar | Direncanakan | Tidak mempunyai navigasi atau materi belajar palsu. |
| VitaSheet | Direncanakan | Tidak mempunyai navigasi atau laporan palsu. |

Status `Aktif` pada Tanya Nusa tidak berarti jawaban selalu benar atau menggantikan tenaga ahli. Tiga modul planned selalu memakai teks `Direncanakan` dan `Belum tersedia`.

## Struktur UI

- sidebar desktop berisi identitas `Mandiri • Local-only`, Beranda, Tanya Nusa, Backup & Recovery, dan Pengaturan;
- drawer mobile memakai tombol semantik, `aria-expanded`, overlay, Escape, pengembalian fokus, dan focus trap;
- header berisi sapaan ruang kerja, deskripsi, `Sistem lokal aktif`, status feature flag, local-only, dan koneksi perangkat;
- hero Tanya Nusa menjadi fitur utama;
- module grid memakai konfigurasi terpusat di `app-shell.js`;
- workspace panel lama dipertahankan beserta seluruh data attribute yang dipakai controller;
- backup panel lama dipertahankan dan hanya tampil setelah account/workspace aktif tersedia;
- recovery tetap menuju halaman preview-only yang terpisah;
- panel batas aman menjelaskan larangan cloud sync, write saat preview, fitur palsu, dan pencampuran scope.

## Komponen implementasi

Repository saat ini memakai HTML statis, CSS tokens, ES Modules, dan `node:test`, bukan React. Karena itu konsep komponen diterapkan sebagai bagian UI semantik dan controller reusable, bukan menambah framework baru:

- `MandiriDashboardLayout` — `.vn-mandiri-dashboard`;
- `SidebarNavigation` dan `MobileNavigation` — markup sidebar serta `initMandiriDashboardNavigation`;
- `DashboardHeader` — `.vn-mandiri-header`;
- `SystemStatusBadge` — `.vn-mandiri-system-badge`;
- `TanyaNusaHero` — `.vn-mandiri-tanya-hero`;
- `ModuleGrid` dan `ModuleCard` — `.vn-mandiri-module-grid` dan konfigurasi `MANDIRI_MODULES`;
- `BackupSummaryCard` — `.vn-mandiri-backup-summary`;
- `ProductBoundaryCard` — `.vn-mandiri-boundary`.

Pemecahan ini mengikuti fondasi repository dan menghindari abstraksi DOM baru yang tidak dibutuhkan.

## Responsivitas

Breakpoint yang sudah digunakan repository dipertahankan:

- di atas `1180px`: sidebar sticky dan module grid empat kolom;
- sampai `1180px`: sidebar menjadi drawer dan module grid dua kolom;
- sampai `820px`: header/hero menjadi vertikal dan module grid satu kolom;
- sampai `420px`: tombol memakai lebar penuh dan padding safe-area dipertahankan.

Seluruh container memakai `min-width: 0`, halaman menolak horizontal overflow, dan animasi drawer dinonaktifkan secara praktis saat `prefers-reduced-motion: reduce`.

## Batas keamanan

Perubahan dashboard hanya menyentuh presentasi dan controller navigasi. Perubahan ini tidak:

- mengubah service workspace;
- mengubah repository atau IndexedDB schema;
- mengubah derivasi accountScope/userScope;
- mengubah backup schema, checksum, sanitasi filename, atau batas record;
- menambah write pada recovery preview;
- menambah Firestore, backend, cloud database, cloud sync, atau network Mandiri;
- merender HTML tidak tepercaya;
- menulis data sensitif ke log browser.

Pernyataan checksum SHA-256, scope account/workspace aktif, dan preview tanpa write ditampilkan karena implementasinya sudah tersedia di `main` setelah PR 5.

## Pengujian

Target test baru: `tests/mandiri/shell/dashboard.test.mjs`.

Test mencakup:

1. shell internal dan empat modul dirender;
2. Tanya Nusa satu-satunya modul aktif;
3. NusaKasir, NusaBelajar, dan VitaSheet berstatus planned;
4. planned module tidak mempunyai link tindakan;
5. link Tanya Nusa menuju halaman yang benar;
6. status local-only dan batas backup/recovery terlihat;
7. landmark navigasi serta focus-visible tersedia;
8. drawer merespons Escape dan mengembalikan fokus;
9. Tab dijaga di dalam drawer mobile;
10. grid empat/dua/satu kolom dan pencegahan overflow;
11. app shell tidak menambah backend, Firestore, network, atau HTML tidak tepercaya.

Perintah utama tetap:

```bash
npm run test:mandiri:shell
npm run test:mandiri
npm run check
python scripts/check_suspicious_unicode.py
git diff --check
```

## Perbedaan dari blueprint Figma

- Tidak ada komponen atau token baru yang diimpor dari Figma; token CSS repository dipakai sebagai sumber implementasi.
- Shared right rail VitaNusa tetap diinisialisasi untuk PWA dan Nusa Agent singleton, tetapi disembunyikan pada halaman Mandiri agar tidak menduplikasi sidebar dashboard.
- Ikon menggunakan mark teks singkat yang konsisten, bukan menambah dependency ikon.
- Pengaturan diarahkan ke workspace lokal yang memang sudah tersedia, bukan halaman pengaturan Mandiri palsu.
- Tidak ada data contoh produksi, grafik, metrik transaksi, atau aktivitas palsu.

## Acceptance gate

Dashboard belum boleh ditandai selesai hanya karena tampilannya sudah dibuat. Status selesai memerlukan:

- lint/syntax check lulus;
- type/check atau build Vite lulus;
- test Mandiri lama dan baru lulus;
- pemeriksaan desktop, tablet, dan mobile;
- pemeriksaan keyboard dan screen reader dasar;
- diff akhir hanya berisi file dashboard terkait;
- tidak ada file build, secret, commit, push, PR, atau deployment yang dibuat tanpa instruksi terpisah.
