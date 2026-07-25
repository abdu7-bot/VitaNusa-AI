# 35 — Fase 3 Expense dan Cash Session Foundation

## Status dan scope

PR 8 menambahkan fondasi lokal tanpa UI untuk `Expense` immutable dan `CashSession`
berstatus `open` atau `closed`. Scope mencakup opening cash, expense out, closing
summary, repository memory/IndexedDB, audit, operation receipt, dan backup. UI kasir,
cash in/out manual, void/refund, laporan lengkap, printer/PDF, cloud sync, restore
write, dan deployment tetap di luar PR ini.

## Kontrak domain

- Satu workspace hanya boleh mempunyai satu session `open`.
- `openingCashMinor`, `Expense.amountMinor`, cash sales, expense total, expected cash,
  counted cash, dan difference menggunakan safe integer melalui helper money.
- `Expense` selalu `recorded`, immutable, memiliki kategori allowlist, note plain text
  opsional, session reference, actor, operation ID, dan timestamp.
- Session `open` dapat naik version saat expense dicatat. Transisi yang diizinkan hanya
  `open → open` untuk touch version atau `open → closed`; session closed immutable.
- Closing summary menghitung `opening cash + cash sales - expense out`. Difference
  adalah `counted cash - expected cash` dan tidak otomatis menjadi expense.
- Cash sales pada foundation ini berasal dari Sale final tunai MVP dalam rentang waktu
  session. Sale lama tidak diubah dan tidak ada void/refund.

## Permission, scope, dan transaksi

- Merchant owner aktif dapat membuka/menutup session dan mencatat expense.
- Cashier aktif dapat membuka session sesuai matriks role. Penutupan cashier tetap
  ditolak sampai kebijakan workspace eksplisit tersedia; expense juga owner-only pada
  foundation ini.
- Permission diperiksa ulang di dalam transaksi dengan `accountScope`, `workspaceId`,
  actor scope, role command, dan membership aktif yang sama.
- Open, expense, dan close masing-masing memakai `expectedVersion` bila mengubah
  session yang sudah ada serta operation receipt berbasis digest payload.
- Retry operation ID dengan payload identik mengembalikan `duplicate-safe`; operation ID
  yang sama dengan payload berbeda ditolak.
- Entity mutation, audit event, dan operation receipt berada dalam satu transaction.
  Kegagalan satu write me-rollback seluruh perubahan.

## Storage dan backup

IndexedDB naik non-destruktif dari v6 ke v7. Store baru:

- `expenses`, key scoped `accountScope/workspaceId/expenseId`;
- `cashSessions`, key scoped `accountScope/workspaceId/cashSessionId`.

Tidak ada store lama yang dihapus atau ditulis ulang dan tidak ada schema v8.
Backup format/schema naik ke v7 serta menambahkan collection `expenses` dan
`cashSessions`. Validator tetap menerima backup v1–v6. Recovery tetap preview-only:
tidak ada jalur import/restore yang menulis database.

## Risiko tersisa

- Local-first satu perangkat belum menyelesaikan konflik kas lintas perangkat.
- Cashier close dan expense memerlukan keputusan kebijakan workspace sebelum dibuka.
- Cash movement ledger umum, manual cash in/out, sale-session hard reference,
  void/refund, dan laporan kas lengkap tetap deferred.
