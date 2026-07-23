# 34 — Fase 3 Payment dan Receipt Foundation

## Status dan scope

PR 7 menambahkan fondasi lokal untuk finalisasi `CartDraft` menjadi `Sale` final, `SaleLine`, satu `Payment` tunai MVP, dan `Receipt` snapshot. Tidak ada UI checkout, printer/PDF, void/refund, expense, cash session, laporan, Firestore, cloud sync, atau AI.

## Kontrak domain

- `Sale` selalu berstatus `final`; `Sale`, `SaleLine`, `Payment`, dan `Receipt` dinormalisasi menjadi object immutable.
- `SaleLine` dan `Receipt.lines` menyimpan snapshot nama, SKU, harga, diskon, quantity, total line, dan status stock tracking pada waktu finalisasi.
- Payment MVP hanya `cash`, `recorded`, dan `IDR`. Underpayment ditolak; overpayment menghasilkan `changeMinor` deterministik.
- Cart yang berhasil difinalisasi ditutup dengan status `finalized` dan version berikutnya. Cart kosong, `cancelled`, atau sudah `finalized` ditolak.
- Merchant owner dan cashier aktif boleh melakukan `sale.create`. Scope account, workspace, membership, dan role command harus konsisten.

## Transaksi atomik dan idempotensi

`createSaleFinalizationService().finalize(command)` memvalidasi membership, operation receipt, cart version/status, product active/existence, snapshot harga, payment, dan saldo stok di dalam satu repository transaction.

Transaction yang sama:

1. menulis Sale dan seluruh SaleLine;
2. menulis Payment dan Receipt snapshot;
3. menulis StockMovement `sale` serta InventoryBalance baru hanya untuk produk tracked;
4. menutup CartDraft;
5. menulis AuditEvent `sale_created`;
6. menulis operation receipt committed.

Kegagalan satu write me-rollback seluruh hasil. Retry dengan `operationId` dan payload identik mengembalikan `duplicate-safe`; payload berbeda pada operation ID yang sama ditolak sebagai `idempotency_mismatch`. Setiap stock movement memakai ID operasi turunan dari UUID movement agar index ledger existing tetap unik, sedangkan operation receipt finalisasi tetap memakai operation ID command.

## Storage dan backup

IndexedDB naik non-destruktif dari schema v5 ke v6 dengan empat store scoped baru: `sales`, `saleLines`, `payments`, dan `receipts`. Tidak ada schema v7 dan tidak ada store lama yang dihapus atau ditulis ulang.

Backup format/schema naik ke v6 dan mencakup empat collection baru. Validator tetap menerima backup v1, v2, v3, v4, dan v5. Recovery tetap preview-only dan tidak mempunyai jalur restore/write.

## Verifikasi

Corpus PR 7 mencakup finalisasi valid, immutable snapshot, cart kosong/cancelled/finalized, product missing/inactive, perubahan harga, stok cukup/kurang, tracked/non-tracked, payment invalid, version conflict, cashier permission, account isolation, idempotency, rollback atomik, persistence IndexedDB setelah reopen, migrasi non-destruktif, dan kompatibilitas preview backup v1–v5.

## Risiko tersisa

- Fondasi ini tetap local-first satu perangkat; oversell lintas perangkat belum diselesaikan.
- Nomor struk human-readable, printer/PDF, cash session, void/refund, dan laporan sengaja deferred.
- Cart yang sudah final tidak dapat dikoreksi sampai workflow void/reversal tersedia pada PR terpisah.
