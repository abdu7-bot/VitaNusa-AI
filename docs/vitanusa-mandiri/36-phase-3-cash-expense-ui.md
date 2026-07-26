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

Command Expense yang belum terkonfirmasi disimpan di `sessionStorage` dengan scope akun,
workspace, dan pengguna. Dengan demikian refresh pada tab yang sama mempertahankan
operation/expense/event ID dan timestamp untuk reconciliation; reset hanya membuang
command setelah pengguna memilih reset secara eksplisit. Command juga dibuang setelah
sukses terkonfirmasi, logout, atau perubahan konteks. Snapshot storage divalidasi ulang
sebagai command Expense dan data rusak dibuang; bila Web Storage diblokir, idempotensi
in-memory tetap berjalan. Penyimpanan ini tidak mengubah IndexedDB v7 atau format backup.
Menutup tab tetap menghapus `sessionStorage`; operasi yang telah sempat commit tetap aman
bila retry dilakukan tanpa kehilangan command, tetapi tab baru tidak dapat merekonstruksi
identity dari input yang sama saja.

Saat halaman dimuat ulang, snapshot direkonsiliasi dengan Expense hasil reload berdasarkan
expense/operation ID. Record yang cocok mengonfirmasi sukses dan membersihkan snapshot;
tabrakan payload dibuang sebagai idempotency mismatch yang aman. Guard submit membagikan
Promise hanya untuk kind dan payload material yang sama. Operasi berbeda selama write
aktif ditolak eksplisit, dan pergantian auth melepas guard berdasarkan generation tanpa
membiarkan hasil async lama mengubah UI konteks baru.

Ringkasan session aktif memakai agregasi sale/expense repository dan kalkulasi domain
existing. Session closed hanya menampilkan `closingSummary` immutable. Tidak ada summary
di localStorage/Cache API, edit/delete Expense, cash adjustment, atau Expense otomatis
dari selisih.

## Verifikasi dan risiko

Test UI mencakup feature gate, lifecycle, alur open/expense/close, double submit,
normalisasi uang, navigasi, XSS guard, responsive, forced colors, dan reduced motion.
Risiko local-first lintas perangkat, void/refund, cash movement umum, dan cloud sync
tetap di luar scope.
