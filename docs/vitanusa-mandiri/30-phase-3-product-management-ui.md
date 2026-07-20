# Fase 3 PR 3 — UI Pengelolaan Produk

## Ruang lingkup

PR ini menambahkan halaman lokal `/mandiri/kasir/products.html` untuk mengelola kategori dan produk NusaKasir. Entrypoint hanya muncul ketika flag internal Mandiri dan NusaKasir aktif. Jika flag NusaKasir mati, halaman berhenti sebelum autentikasi, IndexedDB, paket, atau repository diinisialisasi.

UI memakai `CategoryRepository` dan `ProductRepository` dari IndexedDB v3 melalui `ProductPersistenceService`. Versi database tetap 3; tidak ada object store, index, migrasi, atau jalur hard-delete baru.

## Akses dan isolasi

- Pembacaan dan penulisan selalu memakai `accountScope` dan `workspaceId` aktif.
- Membership aktif dibaca dari repository. `merchant_owner` dapat membaca dan menulis; `cashier` hanya dapat membaca sesuai permission policy yang sudah ada.
- Service memeriksa ulang membership dan role di dalam transaksi atomik bersama entity, audit event, dan operation receipt. Penolakan permission tidak meninggalkan data parsial.
- Pergantian sesi menutup koneksi lama dan hasil async dari sesi lama diabaikan.

## Alur UI

- Kategori: daftar, tambah, edit, aktif/nonaktif melalui update.
- Produk: daftar, pencarian nama/SKU, filter kategori dan status, tambah, edit, aktif/nonaktif melalui update.
- SKU bersifat opsional. Konflik case-insensitive ditampilkan sebagai pesan aman tanpa membocorkan data lain.
- Pilihan kategori hanya memuat kategori aktif dari workspace aktif.
- Harga ditulis sebagai rupiah dan dinormalisasi dengan helper money yang ada menjadi safe integer `sellingPriceMinor`/`purchasePriceMinor`.
- Edit mengirim `expectedVersion`. Konflik versi memuat ulang daftar dan memberitahu pengguna bahwa data sudah berubah.
- Submit yang sedang berjalan dipakai ulang sehingga klik ganda tidak membuat operasi kedua.

Semua nilai pengguna dibuat sebagai node dan diisi dengan `textContent`. Halaman menyediakan label, status `aria-live`, fokus error, fokus keyboard yang terlihat, ukuran kontrol sentuh, layout mobile, forced-colors, dan reduced-motion.

## Batasan

Tidak ada inventory, stok saldo, cart, sale, payment, receipt, expense, laporan, impor, barcode, gambar, cloud sync, Firestore, AI, deployment, atau data contoh. Produk inactive tetap terlihat dengan label status dan tidak dihapus. PR Fase 3 berikutnya tidak termasuk dalam perubahan ini.

## Verifikasi

Pengujian mencakup flag off, isolasi scope, permission, create/edit, parsing rupiah, SKU/category validation, active/inactive, optimistic conflict, idempotency submit, safe rendering, state UI, accessibility/responsive, persistensi setelah inisialisasi ulang, serta assertion schema IndexedDB v3.
