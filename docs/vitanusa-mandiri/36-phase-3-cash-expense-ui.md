# 36 — Fase 3 Cash Session dan Expense UI

## Scope

PR 9 menambahkan halaman lokal `/mandiri/kasir/cash.html` untuk membuka dan melihat
session kas, mencatat Expense pada session aktif, melihat ringkasan dan daftar Expense,
menutup session, serta melihat session terakhir yang sudah ditutup. UI memakai domain,
service, repository, IndexedDB v7, dan backup v7 dari PR 8 tanpa schema atau policy baru.

## Lifecycle dan akses

- VitaNusa Mandiri dan NusaKasir harus sama-sama berstatus `internal`.
- Feature flag off tidak melakukan subscribe auth atau membuka storage/service.
- Akses memerlukan login, tepat satu workspace aktif, dan membership aktif pada account
  serta workspace yang sama.
- Pergantian auth/account/workspace dan `destroy()` menaikkan generation token, menutup
  koneksi, membuang context lama, dan mengabaikan hasil async stale.
- Cashier aktif dapat membuka session dan melihat data. Form Expense dan penutupan hanya
  dirender aktif untuk merchant owner sesuai permission existing.

## Data dan keamanan

Nominal dinormalisasi dengan helper money existing menjadi safe integer rupiah. Kategori
Expense berasal dari allowlist domain dan note dibatasi 240 karakter. Service tetap
memvalidasi permission, payload, session reference, operation ID, dan expected version.
Setelah mutasi berhasil UI selalu membaca ulang repository; version conflict juga memuat
ulang tanpa retry otomatis. Expense diurutkan terbaru dahulu dengan timestamp lalu ID.

Ringkasan session aktif memakai agregasi sale/expense repository dan kalkulasi domain
existing. Session closed hanya menampilkan `closingSummary` immutable. Tidak ada summary
di localStorage/Cache API, edit/delete Expense, cash adjustment, atau Expense otomatis
dari selisih.

## Verifikasi dan risiko

Test UI mencakup feature gate, lifecycle, alur open/expense/close, double submit,
normalisasi uang, navigasi, XSS guard, responsive, forced colors, dan reduced motion.
Risiko local-first lintas perangkat, void/refund, cash movement umum, dan cloud sync
tetap di luar scope.
