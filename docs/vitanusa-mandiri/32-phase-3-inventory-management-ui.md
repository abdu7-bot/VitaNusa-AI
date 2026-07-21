# Fase 3 PR 5 — UI Pengelolaan Inventory NusaKasir

## Tujuan dan route

Halaman lokal `/mandiri/kasir/inventory.html` menyediakan UI inventory untuk membaca saldo stok, melihat riwayat movement, dan mencatat movement manual pada workspace aktif.

Halaman ini memakai entrypoint `assets/js/mandiri/pos/ui/inventory-management-page.js` dan stylesheet `assets/css/nusakasir-inventory.css`.

## Feature gate

- Entrypoint hanya aktif bila kontrak NusaKasir dan Mandiri sama-sama aktif.
- Jika gate mati, halaman berhenti sebelum auth, database, atau repository dipakai.
- Tidak ada jalur fallback ke cart, sale, payment, receipt, atau PR 6.

## Akses dan isolasi

- Owner (`merchant_owner`) dapat menulis movement.
- Cashier bersifat read-only untuk inventory.
- Permission diverifikasi pada workspace aktif sebelum penulisan ledger, balance, audit, atau receipt.
- Semua read dan write memakai `accountScope` dan `workspaceId` aktif.
- Session/workspace yang berubah harus memutus koneksi lama dan mengabaikan hasil async sesi lama.

## Movement yang didukung

UI hanya menerima movement manual berikut:

- `opening_stock`
- `purchase_in`
- `adjustment`

Aturan input:

- kuantitas harus integer aman;
- `opening_stock` dan `purchase_in` harus positif;
- `adjustment` boleh positif atau negatif;
- `adjustment` wajib memiliki reason plain text singkat.

## Optimistic control dan idempotency

- Submit mengirim `expectedVersion` dari balance saat ini.
- Konflik versi memaksa reload data terbaru.
- Double submit dicegah dengan satu promise submit yang dipakai ulang selama request aktif.
- Command memakai `operationId` dan payload aman untuk duplicate-safe handling.

## Local-first

- UI membaca data lokal terlebih dahulu dari IndexedDB.
- Status yang ditampilkan berasal dari data lokal, bukan dari cloud.
- Tidak ada sinkronisasi cloud baru pada PR ini.

## Accessibility

- Halaman memakai label, landmark semantik, dan `aria-live`.
- Kontrol dapat dipakai via keyboard.
- Fokus terlihat, layout mobile responsif, reduced-motion dihormati, dan forced-colors tetap terbaca.

## IndexedDB dan rollback

- IndexedDB tetap version 4.
- Tidak ada perubahan schema, store, index, atau versi database.
- Operasi inventory harus rollback aman: jika gagal, tidak boleh ada data parsial.

## Risiko browser nyata

- Perlu diuji di browser nyata karena ukuran histori bisa besar.
- Fokus utama: performa render daftar, perilaku dialog, dan kompatibilitas keyboard / mobile.

## Status PR 6

PR 6 belum dimulai.
