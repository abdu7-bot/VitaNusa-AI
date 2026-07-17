# 22 — Runbook Fase 1 VitaNusa Mandiri

Status: panduan operator/developer untuk fondasi **local-only**. Ini bukan runbook produksi, cloud backup, aplikasi kasir, atau laporan keuangan resmi.

## Mengaktifkan internal mode

Feature flag bukan secret. Untuk development:

```bash
VITE_VITANUSA_MANDIRI_STATE=internal npm run dev
```

Untuk memeriksa build internal lokal:

```bash
VITE_VITANUSA_MANDIRI_STATE=internal npm run build
npm run preview
```

Buka `mandiri/` melalui origin Vite. Jangan hardcode domain GitHub Pages; build memakai base relatif.

## Menonaktifkan fitur

Hapus environment override atau set:

```bash
VITE_VITANUSA_MANDIRI_STATE=off npm run build
```

Nilai kosong/tidak dikenal juga menjadi `off`. Menonaktifkan flag menyembunyikan shell dan mencegah auth/storage Mandiri diinisialisasi, tetapi **tidak menghapus IndexedDB**. Ini adalah rollback exposure yang aman, bukan deletion.

## Membuat workspace lokal

1. Aktifkan internal mode.
2. Buka `mandiri/`.
3. Login memakai akun publik VitaNusa.
4. Isi nama workspace, pilih timezone IANA, dan pertahankan currency `IDR`.
5. Tekan **Buat workspace lokal** satu kali.
6. Pastikan ringkasan menampilkan `Local-only` dan role `merchant_owner`.

Satu accountScope hanya dapat mempunyai satu workspace aktif pada Fase 1. Workspace, owner, audit, dan receipt dibuat dalam satu transaction; error tidak boleh menghasilkan record parsial.

## Membuat backup

1. Login dan buka workspace yang sudah tersedia.
2. Baca peringatan bahwa file dapat memuat data usaha pribadi.
3. Tekan **Unduh Backup JSON**.
4. Simpan file di lokasi yang dikendalikan pengguna.
5. Jangan mengirim file otomatis melalui email/chat atau mengunggahnya ke layanan lain.

Backup adalah file lokal, bukan backup cloud. Kehilangan perangkat dan file dapat berarti data tidak dapat dipulihkan.

## Memeriksa backup

1. Buka `mandiri/recovery.html` pada build internal.
2. Login dengan akun yang sama dengan pembuat backup.
3. Tekan **Pilih File JSON** dan pilih satu file maksimum 5 MiB.
4. Tekan **Periksa File**.
5. Periksa nama workspace, timezone, currency, counts, versi, status checksum, dan status scope.

Proses berhenti pada preview. Tidak ada data yang ditulis ke IndexedDB dan tidak ada tombol pemulihan pada Fase 1.

## Menghapus data lokal secara manual

PR 5 tidak menambah tombol delete/purge. Bila penghapusan benar-benar diperlukan:

1. Buat dan periksa backup terlebih dahulu bila data masih dibutuhkan.
2. Buka browser DevTools atau pengaturan site data untuk origin VitaNusa yang benar.
3. Temukan IndexedDB `vitanusa-mandiri`.
4. Hapus site data/database hanya setelah memastikan origin dan dampaknya.

Tindakan ini destruktif dan dapat menghapus data tanpa recovery. Jangan menjalankan deletion otomatis dari script operasional, jangan menghapus seluruh profil browser, dan jangan menganggap logout sebagai delete.

## Logout dan pergantian akun

Logout menutup connection Mandiri dan membersihkan UI in-memory. IndexedDB tidak dihapus. Saat akun B login, helper membentuk accountScope B dan repository hanya meng-query scope B; workspace akun A tetap berada di perangkat tetapi tidak ditampilkan kepada akun B.

Backup akun A akan ditolak pada recovery akun B dengan `scope_mismatch`. Email yang sama tidak menjadi bypass; scope berasal dari digest UID.

## Schema data lebih baru

Pesan:

> Versi data lokal lebih baru daripada aplikasi ini. Data tidak akan diubah. Perbarui aplikasi sebelum melanjutkan.

Tindakan:

1. Jangan menghapus atau downgrade database.
2. Tutup tab lama yang masih membuka connection.
3. Gunakan aplikasi yang mendukung schema tersebut.
4. Pertahankan feature flag `off` bila versi kompatibel belum tersedia.

## Backup rusak atau berubah

Checksum mismatch berarti file berubah atau rusak. Jangan menampilkan preview sebagai valid, jangan memperbaiki checksum otomatis, dan jangan menebak field yang hilang. Gunakan file backup lain yang dibuat dari workspace/scope yang benar.

Checksum bukan autentikasi pembuat dan bukan enkripsi. File dengan checksum valid tetap harus dijaga sebagai data pribadi.

## Recovery rehearsal

Rehearsal Fase 1 hanya sampai preview:

1. Buat workspace fixture lokal.
2. Unduh backup.
3. Buka recovery page.
4. Pilih backup dan pastikan preview valid.
5. Ubah satu field pada copy file dan pastikan checksum mismatch.
6. Coba akun berbeda dan pastikan scope mismatch.
7. Verifikasi jumlah record IndexedDB tidak berubah sebelum/sesudah preview.

Jangan menambahkan langkah import atau write.

## Rollback kode

Urutan aman:

1. Set feature flag ke `off` untuk menghentikan exposure.
2. Revert PR bermasalah melalui review Git normal.
3. Jangan menurunkan schema version.
4. Jangan menghapus IndexedDB saat rollback.
5. Jalankan suite Mandiri dan regression sebelum build berikutnya.

PR 5 tidak mengubah schema database, sehingga rollback kode backup/recovery tidak memerlukan migration atau deletion.

## Troubleshooting

| Kondisi | Tindakan aman |
| --- | --- |
| IndexedDB unavailable | Gunakan browser/profile yang mendukung IndexedDB; jangan fallback diam-diam ke memory. |
| Database blocked | Tutup tab VitaNusa lain, lalu coba kembali. |
| Quota exceeded | Hentikan write baru; buat backup bila masih dapat dibaca; jangan hapus otomatis. |
| Scope mismatch | Login dengan akun pembuat file; tidak ada bypass admin/platform. |
| Backup invalid | Jangan memperbaiki field otomatis; gunakan backup yang sesuai schema. |
| Checksum mismatch | Anggap file berubah/rusak; gunakan file lain. |
| Unsupported version | Perbarui aplikasi; jangan downgrade atau menebak migrasi. |
| Record limit exceeded | Backup parsial tidak dibuat; evaluasi format/pagination pada fase berikutnya. |

## Verifikasi

```bash
npm ci
npm run check
npm run test:mandiri
python scripts/check_suspicious_unicode.py
git diff --check
```

Untuk pemeriksaan manual, uji flag off/internal, signed-out, create/reload/double-submit/account switch/offline, download backup, valid preview, tamper, dan scope mismatch. Catat eksplisit bila Android fisik belum diuji.

## Batas operasional

- Bukan backup cloud atau sinkronisasi.
- Bukan restore otomatis atau restore commit.
- Bukan aplikasi kasir atau sistem stok/penjualan.
- Bukan aplikasi belajar.
- Bukan laporan keuangan resmi.
- Belum siap produksi.
