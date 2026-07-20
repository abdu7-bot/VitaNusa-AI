# Fase 3 PR 4 — Fondasi Inventory Ledger

## Kontrak domain

`StockMovement` adalah record append-only dan immutable. PR ini hanya menerima movement manual `opening_stock`, `purchase_in`, dan `adjustment`. Kuantitas disimpan sebagai signed safe integer; nol, pecahan, tipe non-number, overflow, serta purchase/opening negatif ditolak. Adjustment dapat positif atau negatif dan wajib memiliki alasan plain text terbatas.

Setiap movement menyimpan `movementId`, `productId`, actor scope dan role, timestamp UTC, source reference, serta `operationId` yang aman. Produk harus berada di account/workspace yang sama dan `stockTracking=true`. Sale, void, dan reversal belum tersedia.

`InventoryBalance` adalah snapshot performa yang hanya diperbarui oleh service inventory. UI tidak memiliki API untuk menulis saldo. Invariant utamanya:

```text
quantityOnHand = sum(StockMovement.quantityDelta untuk product tersebut)
version = jumlah movement committed untuk product tersebut
```

`expectedVersion` mencegah lost update. Movement, balance, audit event, dan operation receipt ditulis dalam satu transaksi. Operation ID dan payload yang sama mengembalikan hasil duplicate-safe; payload berbeda ditolak. Semua kegagalan membatalkan transaksi tanpa data parsial.

## IndexedDB v4

Migrasi v3 ke v4 non-destruktif menambahkan:

- `stockMovements`, primary key `[accountScope, workspaceId, movementId]`
  - `byWorkspaceCreatedAt`: `[accountScope, workspaceId, createdAtLocal]`
  - `byProductCreatedAt`: `[accountScope, workspaceId, productId, createdAtLocal]`
  - `byWorkspaceOperation`: `[accountScope, workspaceId, operationId]`, unique
- `inventoryBalances`, primary key `[accountScope, workspaceId, productId]`
  - `byWorkspace`: `[accountScope, workspaceId]`

Semua key dan index diawali scope sehingga tidak membuka traversal lintas workspace. Store Fase 1–3 dipertahankan. Aplikasi menolak database yang lebih baru dan tidak menjalankan downgrade, clear, atau delete store.

## Repository dan permission

Kontrak publik inventory repository hanya menyediakan `appendMovement`, `getBalance`, `listBalances`, dan `listMovements`. Tidak ada update/delete movement, `getAll`, atau dump database. Implementasi IndexedDB dan memory mempunyai kontrak dan rollback yang setara.

Permission menggunakan policy workspace existing. Membership aktif diperiksa di dalam transaksi; owner dapat mencatat movement dan cashier hanya dapat membaca inventory. Penolakan permission terjadi sebelum ledger, balance, audit, atau receipt ditulis.

## Backup dan batasan

Backup format v4 menambahkan `stockMovements` dan `inventoryBalances`, memvalidasi workspace/product, stock tracking, identitas unik, dan kesesuaian saldo dengan jumlah ledger. Format v1, v2, dan v3 tetap dapat dipreview. Restore tetap validasi dan preview-only tanpa jalur commit.

PR ini tidak menambahkan UI inventory, cart, sale, payment, receipt penjualan, expense, cash session, void/reversal, laporan, barcode, impor, cloud sync, Firestore, backend, AI, deployment, atau Fase 3 PR 5.
