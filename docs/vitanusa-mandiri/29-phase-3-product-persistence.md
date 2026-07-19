# 29 — Fase 3 PR 2: Persistensi Produk

Status: **implemented untuk review**. Dokumen ini mencatat persistensi lokal
Category dan Product NusaKasir. Fase 3 PR 3 belum dimulai.

## Database dan migrasi

IndexedDB VitaNusa Mandiri naik secara non-destruktif dari versi 2 ke versi 3.
Seluruh store Fase 1–2 dipertahankan. Dua store baru adalah:

- `categories`, key path `[accountScope, workspaceId, categoryId]`, dengan index
  `byWorkspace` dan `byWorkspaceActive`;
- `products`, key path `[accountScope, workspaceId, productId]`, dengan index
  `byWorkspace`, `byWorkspaceActive`, `byWorkspaceCategory`, serta index unik
  `byWorkspaceSku` pada `[accountScope, workspaceId, sku]`.

SKU dinormalisasi domain ke uppercase sebelum ditulis. Produk tanpa SKU tidak
membawa nilai SKU pada record persistence sehingga banyak produk tanpa SKU dapat
disimpan walaupun index unik aktif. `accountScope` hanya menjadi envelope
persistence dan tidak ditambahkan ke schema domain publik.

## Kontrak repository

`CategoryRepository` dan `ProductRepository` hanya menyediakan `create`,
`update`, `get`, dan `list`. Semua method menerima `accountScope` dan
`workspaceId`; tidak ada `getAll`, `listAll`, hard delete, atau database dump.
Memory repository mempunyai kontrak dan hasil yang sama dengan IndexedDB.

Create dan update produk memvalidasi referensi category pada account dan
workspace yang sama. SKU unik berlaku case-insensitive per workspace, tetapi SKU
yang sama boleh dipakai workspace lain. Update memakai expected version dan
menolak lost update dengan `version_conflict`; update yang mempertahankan SKU
produk sendiri tetap sah.

## Atomicity, idempotency, dan audit

Product persistence service menjalankan perubahan entity, audit event aman, dan
operation receipt dalam satu transaksi. Retry operation yang sama mengembalikan
hasil `duplicate-safe`. Operation ID yang dipakai ulang dengan payload berbeda,
duplicate SKU, version conflict, scope mismatch, dan category reference invalid
membatalkan transaksi tanpa record parsial.

Audit hanya membawa metadata entity dan hasil operasi sesuai kontrak Mandiri;
tidak ada credential atau data privat baru. Feature flag NusaKasir tetap default
`off`; ketika off, entrypoint tidak membuka database.

## Backup dan restore

Backup format/schema versi 3 menambah collection `categories` dan `products`
dengan validasi scope, ID unik, SKU unik, dan category reference. Preview backup
versi 1 dan 2 tetap kompatibel. Restore tetap hanya memvalidasi checksum dan
menampilkan preview; tidak ada operasi commit restore.

## Rollback dan batas scope

Rollback kode tidak menurunkan IndexedDB dan tidak menghapus data versi 3.
Implementasi ini tidak membuat UI, cart, inventory, sale, payment, receipt,
expense, laporan, Firestore, backend, cloud sync, AI, deployment, atau IndexedDB
versi 4. NusaBelajar, admin, VitaCheck, NusaAgent, dan VitaSheet tidak diubah.
Fase 3 PR 3 belum dimulai.
