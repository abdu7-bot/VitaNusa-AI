# 28 — Fase 3 PR 1: Fondasi Domain Produk

Status: **implemented untuk review**. Dokumen ini hanya mencatat fondasi domain
Category dan Product NusaKasir Local MVP. PR 2 belum dimulai.

## Batas implementasi

- Flag `VITE_NUSAKASIR_STATE` default `off`; mode `internal` hanya efektif bila
  VitaNusa Mandiri juga `internal`.
- Flag tidak memberi permission dan tidak membuka storage. IndexedDB tetap versi 2.
- Category dan Product adalah fungsi domain murni tanpa repository atau UI.
- ID menggunakan UUID v4 dari helper Mandiri existing dengan prefix `category_`
  atau `product_`; setiap record wajib membawa `workspaceId` valid.
- Validasi expected workspace menolak entity lintas workspace.

## Kontrak Category

Category menerima field `schemaVersion`, `version`, `categoryId`, `workspaceId`,
`name`, dan `active`. Dua field version boleh tidak dikirim dan default ke 1.
Nama adalah plain text 1–80 karakter dan `active` wajib boolean.

## Kontrak Product

Product menerima field `schemaVersion`, `version`, `productId`, `workspaceId`,
`name`, `sku`, `categoryId`, `sellingPriceMinor`, `purchasePriceMinor`,
`stockTracking`, dan `active`. Field SKU, category, dan purchase price opsional
serta dinormalisasi menjadi `null` ketika tidak tersedia.

- Nama adalah plain text 1–160 karakter.
- SKU maksimal 80 karakter, dinormalisasi Unicode NFC, whitespace, dan uppercase
  deterministik. Helper uniqueness membandingkannya case-insensitive hanya di
  workspace yang sama dan tidak menganggap record produk yang sama sebagai duplikat.
- `sellingPriceMinor` adalah safe integer rupiah lebih besar dari nol.
- `purchasePriceMinor` adalah safe integer rupiah non-negatif atau `null`.
- `stockTracking` dan `active` wajib boolean.
- Guard domain menolak produk inactive untuk cart baru dengan `inactive_product`.
- Kalkulasi/validasi nominal memakai helper money Mandiri existing; tidak ada float.

Input tidak dimutasi dan output dibekukan. Unknown field, dangerous key, ID atau
scope invalid, uang unsafe, dan tipe boolean invalid gagal dengan error code
domain terkontrol.

## Privacy dan rollback

Tidak ada data produk contoh, komposisi, BPOM, status halal, manfaat, Firestore,
backend, cloud sync, atau AI. Rollback dilakukan dengan mempertahankan flag `off`
dan merevert kode domain; tidak ada database, migration, atau data yang dihapus.

## Di luar scope

PR ini tidak membuat repository, UI kasir, inventory, cart, sale, payment,
receipt, expense, cash session, void, laporan, deployment, atau fitur VitaSheet.
NusaBelajar, admin, VitaCheck, dan NusaAgent tidak diubah. Fase 3 PR 2 belum
dimulai.
