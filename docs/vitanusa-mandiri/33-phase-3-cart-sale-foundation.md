# Fase 3 PR 6 — Fondasi Cart dan Sale Preview

## Ruang lingkup

PR ini menyediakan domain dan persistensi draft cart lokal serta kalkulasi sale preview. Belum ada UI cart/checkout dan belum ada entity Sale committed, SaleLine final, Payment, Receipt, atau pengurangan inventory.

## Domain cart

`CartDraft` menyimpan status `draft`, version, diskon cart, subtotal, grand total, jumlah line, currency IDR, dan timestamp. `CartLine` menyimpan snapshot produk yang diperlukan untuk preview: nama, SKU opsional, quantity bulat, harga satuan, diskon line, gross, dan subtotal.

Semua quantity wajib safe integer positif. Semua harga, diskon, subtotal, dan total memakai helper money berbasis safe integer. Diskon line tidak boleh melebihi gross line dan diskon cart tidak boleh melebihi subtotal. Produk inactive ditolak. Produk dengan stock tracking memerlukan saldo lokal yang cukup, tetapi draft cart tidak mengurangi saldo.

Cart hanya menghasilkan `salePreview`, bukan Sale committed. Perubahan harga pada produk yang masih ada di draft ditolak dengan `price_changed` agar pengguna dapat meninjau ulang snapshot.

## Persistensi IndexedDB v5

Migrasi v4→v5 non-destruktif menambahkan:

- `cartDrafts`, key `[accountScope, workspaceId, cartId]`, dengan index `byWorkspaceUpdatedAt`;
- `cartLines`, key `[accountScope, workspaceId, cartId, lineNo]`, dengan index `byCart` dan `byWorkspaceProduct`.

Record CartLine di storage menyimpan `accountScope` dan `workspaceId` agar sesuai keyPath pada IndexedDB maupun memory repository. Bentuk publik menghapus kedua field scope. `cartId` setiap line wajib cocok dengan CartDraft pada scope yang sama; line lintas cart ditolak sebelum write. Seluruh store dan data v1–v4 dipertahankan. Target migrasi atau database v6 dan lebih baru ditolak tanpa downgrade atau penghapusan.

Repository menyediakan create, update dengan `expectedVersion`, get/list ter-scope, dan list line. Tidak ada delete, global list, atau dump. Implementasi IndexedDB dan memory mempunyai perilaku setara. Helper backup internal dipasang sebelum repository dibekukan.

## Operasi atomik dan permission

Create/update cart, line replacement, audit event, dan operation receipt berjalan dalam satu transaksi. Update memeriksa `expectedVersion` sebelum membaca snapshot produk. `operationId` dan payload yang sama menghasilkan `duplicate-safe`; operation ID sama dengan payload berbeda ditolak. Konflik version, referensi produk, permission, stok, harga, dan kegagalan audit me-rollback tanpa draft atau line parsial.

Policy workspace existing digunakan: merchant owner dapat menulis draft; cashier hanya membaca. Membership aktif dan role command diverifikasi di dalam transaksi.

## Backup

Backup format v5 menambahkan `cartDrafts` dan `cartLines`, memvalidasi relasi cart-line-product, identitas cart, nomor line unik, dan seluruh total melalui validasi CartDraft/CartLine yang sama dengan runtime. Format v1, v2, v3, dan v4 tetap dapat divalidasi dan dipreview. Restore tetap preview-only dan tidak memiliki jalur commit.

## Batasan

Tidak ada UI cart/checkout, Sale committed, Payment, Receipt, perubahan stok, void/refund, expense, cash session, Firestore, backend, cloud sync, deployment, atau pekerjaan PR berikutnya dalam perubahan ini.
