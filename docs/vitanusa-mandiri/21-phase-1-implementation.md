# 21 — Implementasi Fase 1 VitaNusa Mandiri

Status dokumen: implementasi PR 1–4 tersedia di `main`; PR 5 menyelesaikan backup, preview recovery, hardening lokal, dan dokumentasi setelah review serta merge. Seluruh fungsi Mandiri tetap **local-only**, di balik feature flag, dan belum siap produksi.

## Tujuan dan status

Fase 1 membangun fondasi teknis yang terpisah dari VitaCheck, admin, backend, dan modul chat. Fondasi ini menyediakan shell mobile-first, primitive domain murni, IndexedDB versioned, repository ter-scope, satu workspace lokal atomik, backup JSON, dan pemeriksaan backup preview-only.

Fase 1 tidak menghasilkan aplikasi kasir lengkap, aplikasi belajar, laporan XLSX, sinkronisasi cloud, atau penyimpanan Firestore.

## Pembagian PR

1. PR 1 — feature flag dan application shell.
2. PR 2 — workspace/membership, permission, money, ID, idempotency, dan audit domain.
3. PR 3 — IndexedDB version 1, migration, scoped repositories, dan memory repositories.
4. PR 4 — integrasi auth publik dan pembuatan workspace lokal atomik.
5. PR 5 — backup JSON, restore preview-only, security boundary tests, dan dokumentasi.

## Struktur modul

```text
mandiri/
├── index.html
└── recovery.html

assets/js/mandiri/
├── config/
├── domain/
├── storage/
├── repositories/
├── services/
├── export/
└── shell/

tests/mandiri/
├── domain/
├── storage/
├── repositories/
├── services/
├── export/
├── security/
└── shell/
```

Kode Mandiri tidak mengimpor Firestore Rules atau backend. Recovery preview tidak mengimpor database atau repository.

## Feature flag

Build environment yang dibaca adalah `VITE_VITANUSA_MANDIRI_STATE` dengan nilai yang didukung `off` dan `internal`. Nilai default, kosong, atau tidak dikenal selalu menjadi `off`.

Saat `off`, route langsung hanya menampilkan halaman belum tersedia. Shell internal, auth Mandiri, workspace panel, backup panel, dan IndexedDB tidak diinisialisasi. Feature flag mengatur exposure fitur, bukan permission.

## Integrasi auth dan scope

Mandiri memakai modul auth publik yang sudah ada di `assets/js/modules/user-auth.js`; tidak ada Firebase app atau auth provider kedua. Login tidak otomatis memberi platform role atau workspace permission.

UID dipakai hanya sebagai input Web Crypto SHA-256 untuk membentuk identifier lokal deterministik:

```text
account:<64 lowercase hex>
user:<64 lowercase hex>
```

Email, display name, foto profil, dan token tidak menjadi key atau record domain. `accountScope` di backup adalah identifier pseudonim, bukan secret dan bukan enkripsi.

## Database dan migrasi

- Nama database: `vitanusa-mandiri`.
- Schema version: `1`.
- Object store: `metadata`, `workspaces`, `memberships`, `auditEvents`, `operationReceipts`.
- Tidak ada store produk, penjualan, learning, outbox, atau conflict.

Compound primary key:

| Store | Primary key |
| --- | --- |
| `metadata` | `key` |
| `workspaces` | `[accountScope, workspaceId]` |
| `memberships` | `[accountScope, workspaceId, membershipId]` |
| `auditEvents` | `[accountScope, workspaceId, eventId]` |
| `operationReceipts` | `[accountScope, operationId]` |

Migration v1 hanya membuat store/index dan metadata schema. Migration tidak melakukan network, tidak menghapus store, dan tidak menulis downgrade. Database dengan versi lebih baru ditutup dan menghasilkan pesan aman tanpa perubahan data.

## Repository contracts

Repository utama:

- workspace: `add`, `getById`, `listByAccount`, `listByStatus`;
- membership: `add`, `getById`, `getByUserScope`, `listByWorkspace`, `listByStatus`, `countActiveOwners`;
- audit: append-only `append`, `getById`, `listByWorkspace`, `listByOperation`;
- operation receipt: append-only `append`, `getByOperationId`, `findByEntity`.

Reader backup internal pada audit dan receipt tetap mewajibkan `accountScope`, `workspaceId`, dan limit. Reader memakai index `byWorkspaceCreatedAt`; tidak ada `getAll()` global, `dumpDatabase`, atau fallback diam-diam ke memory.

IndexedDB dan memory repositories mempunyai contract serta rollback penting yang setara. Memory repository hanya fake test, bukan fallback produksi.

## Money, ID, dan idempotency

Nilai uang direpresentasikan sebagai integer rupiah `Number.isSafeInteger`. Float, `NaN`, infinity, implicit coercion, dan overflow ditolak. Pembulatan hanya memakai mode eksplisit `floor`, `ceil`, atau `half_up`; `Intl.NumberFormat` hanya untuk display.

Entity/operation ID memakai `crypto.randomUUID()` dengan fallback `crypto.getRandomValues()`. Canonical payload mempertahankan urutan array dan mengurutkan object key. Digest berbentuk `sha256:<64 hex>` dan dipakai untuk deteksi mismatch, bukan authorization.

## Pembuatan workspace atomik

Saat flag `internal` dan pengguna login, satu transaction IndexedDB membuat:

1. Workspace aktif, currency `IDR`.
2. Membership aktif ber-role `merchant_owner`.
3. Audit event `workspace_created`.
4. Operation receipt `committed`.

Service menegakkan satu workspace lokal per accountScope pada Fase 1. Retry command yang sama memakai operation ID dan digest yang sama; replay valid menjadi `duplicate-safe`, sedangkan digest berbeda ditolak sebagai `idempotency_mismatch`. Satu write gagal berarti seluruh transaction abort.

## Audit dan operation receipt

Audit event menyimpan ID/scope, actor role, action, entity reference, operation ID, result, reason code, dan timestamp. Audit tidak menyimpan before/after object, prompt, token, catatan bebas, data kesehatan, atau isi transaksi lengkap.

Operation receipt menyimpan metadata idempotency dan payload digest, bukan payload asli. Kedua repository bersifat append-only pada API publik.

## Backup JSON

Format root:

```text
format = vitanusa-mandiri-backup
formatVersion = 1
databaseSchemaVersion = 1
checksumAlgorithm = SHA-256
```

Backup hanya memuat satu workspace aktif yang dipilih serta membership, audit event, dan operation receipt dari account/workspace yang sama. Semua pembacaan berlangsung dalam satu repository context `readonly`.

Batas Fase 1:

| Collection | Maksimum |
| --- | ---: |
| workspace | 1 |
| membership | 100 |
| audit event | 5.000 |
| operation receipt | 5.000 |

Jika batas terlampaui, ekspor gagal dan tidak memotong data. Filename dinormalisasi, separator/control character dibersihkan, reserved name dicegah, panjang dibatasi, dan extension selalu `.json`.

Checksum dihitung dari canonical payload seluruh backup kecuali field `checksum`. Checksum mendeteksi perubahan/kerusakan; checksum **bukan tanda tangan digital, bukti pembuat, atau enkripsi**.

Backup tidak menyertakan email, UID mentah, token, foto, data VitaCheck, percakapan Nusa, data admin, produk, penjualan, atau pembelajaran.

## Restore preview-only

`mandiri/recovery.html` hanya memeriksa file. Alurnya memeriksa batas 5 MiB, JSON, dangerous key, exact fields, versi, accountScope, workspace, record count, domain record, referential integrity, dan checksum. Output hanya ringkasan aman tanpa internal ID atau raw JSON.

Recovery preview tidak membuka IndexedDB, tidak memanggil repository write, tidak memakai localStorage, dan tidak melakukan network. Tidak ada fungsi commit restore atau tombol pemulihan pada Fase 1.

## Isolasi dan data governance

- Query tenant selalu dimulai dari compound key/index yang mengandung `accountScope`.
- Query workspace juga mengandung `workspaceId`.
- Account switch menutup connection lama dan generation guard mencegah hasil async akun lama dirender.
- Logout tidak menghapus IndexedDB dan tidak memperlihatkan data akun sebelumnya.
- Platform admin/owner tidak otomatis menjadi merchant owner.
- IndexedDB adalah sandbox origin, bukan brankas terenkripsi.

## Data yang disimpan

- metadata teknis schema;
- metadata satu workspace lokal;
- membership awal merchant owner;
- audit event minimal;
- operation receipt minimal.

## Data yang tidak disimpan

- auth/access/refresh token, password, API key, private key;
- email atau nama akun dalam record domain;
- data VitaCheck atau kesehatan;
- percakapan Nusa atau prompt;
- data admin;
- produk, stok, penjualan, pembayaran, laporan;
- materi/progres belajar;
- cloud outbox atau sync conflict.

## Test dan CI

Perintah utama:

```bash
npm run check
npm run test:mandiri
npm run test:mandiri:backup
npm run test:mandiri:security
npm run test:mandiri:recovery-ui
python scripts/check_suspicious_unicode.py
git diff --check
```

CI juga mempertahankan admin, public auth, VitaCheck, Android PWA, Firestore Rules emulator, backend, syntax, Unicode, dan repository-safety tests.

## Known limitations dan out of scope

- Local-only, satu perangkat, dan satu workspace aktif per akun untuk Fase 1.
- Tidak ada enkripsi aplikasi pada IndexedDB atau file backup.
- Tidak ada cloud backup, Firestore workspace, sync, restore commit, atau automatic recovery.
- Tidak ada purge UI; penghapusan manual adalah tindakan browser yang destruktif.
- Tidak ada POS, learning engine, cashier invitation, multi-cashier, XLSX, APK, atau deployment.
- Backup di atas batas record perlu rancangan pagination/format fase berikutnya.
- Pengujian perangkat Android fisik harus dicatat terpisah bila tersedia.

## Gate sebelum Fase 2

Fase 2 hanya boleh dimulai setelah PR 5 direview dan merge, seluruh GitHub Actions hijau, main bersih, `npm run test:mandiri` lulus, dokumentasi sesuai implementasi, dan batas local-only tetap diterima owner. Fase 2 tidak boleh mengubah keputusan Fase 1 secara diam-diam.
