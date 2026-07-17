# 24 — Fase 2 PR 2: Paket Konten Awal NusaBelajar

Status: **Published; review manusia disetujui**.

Dokumen ini menjelaskan satu paket materi statis berbahasa Indonesia untuk NusaBelajar. Paket `money-basics-id-v1` telah mendapat persetujuan eksplisit dari Pemilik proyek VitaNusa, berstatus `published/approved`, dan dapat menjadi sumber untuk PR 3 setelah perubahan publikasi ini merge. Status tersebut belum berarti NusaBelajar siap produksi karena UI dan persistence belum tersedia.

## Tujuan dan batas PR 2

Paket membahas membaca harga, menjumlahkan dua harga, dan menghitung kembalian sederhana. Patch publikasi tidak menambah halaman katalog, lesson reader, exercise/quiz UI, IndexedDB learning, progress, cloud sync, mentor, atau tindakan NusaAgent.

Database `vitanusa-mandiri` tetap versi `1`. Learning flag tetap default `off`.

## Struktur folder

```text
content/mandiri/learning/
├── catalog.json
└── packages/
    └── money-basics-id-v1/
        ├── manifest.json
        ├── content.json
        └── CONTENT-REVIEW.md
```

Validator package berada pada `assets/js/mandiri/learning/content/`. Script read-only berada pada `scripts/mandiri/learning/`; test berada pada `tests/mandiri/learning-content/`.

## Package format

Manifest memakai exact-field schema:

```text
packageFormat packageFormatVersion packageId schemaVersion
contentVersion locale status reviewStatus title summary
contentFile contentSha256 contentBytes programIds
```

Nilai setelah persetujuan manusia:

- `packageFormat: vitanusa-learning-package`;
- `packageFormatVersion: 1`;
- `packageId: money-basics-id-v1`;
- `schemaVersion: 1`;
- `contentVersion: 1`;
- `locale: id-ID`;
- `status: published`;
- `reviewStatus: approved`.

Unknown field, dangerous key, checksum bukan lowercase SHA-256, path content selain `content.json`, status tidak dikenal, dan kombinasi status/review yang tidak konsisten ditolak.

## Catalog format

Catalog memakai root `catalogFormat`, `catalogVersion`, dan `packages`. Setiap entry hanya mempunyai `packageId`, `manifestPath`, `locale`, `status`, dan `reviewStatus`.

`manifestPath` harus tepat `packages/{packageId}/manifest.json`. Absolute path, backslash, URL/scheme, segment kosong, `.` dan `..` ditolak. Catalog dan manifest harus mempunyai package ID, locale, status, dan review status yang sama.

## Content graph

`content.json` mengikuti graph PR 1:

```text
Program
└── Course
    └── Module
        ├── Lesson 1 + Activity + Exercise
        ├── Lesson 2 + Activity + Exercise
        ├── Lesson 3 + Activity + Exercise
        └── Quiz module
```

Semua entity memakai `schemaVersion: 1`, `contentVersion: 1`, `locale: id-ID`, dan `status: published`.

## Materi published

- Program: **Keterampilan Dasar Sehari-hari**.
- Course: **Menghitung Uang Sederhana**.
- Module: **Belanja dan Kembalian**.
- Lesson 1: **Membaca Harga** — tanda Rp, pemisah ribuan, nilai integer, dan label harga.
- Lesson 2: **Menjumlahkan Dua Harga** — contoh `8000 + 3000 = 11000` dan urutan pemeriksaan.
- Lesson 3: **Menghitung Kembalian Sederhana** — `uang dibayar - total belanja` dengan dua contoh pembayaran cukup.

Activity memakai `read_example` dan `observe_sequence`; activity tidak menghasilkan score. Sembilan exercise memakai `single_choice`, `multiple_choice`, `numeric_input`, `short_text_exact`, dan `sequence`. Nilai rupiah untuk kalkulasi selalu integer.

Quiz module memilih enam exercise yang sudah ada, dua dari setiap lesson. Passing threshold `7000` basis points telah termasuk dalam persetujuan manusia untuk content version 1. Tidak ada timer, ranking, leaderboard, penalti pengulangan, atau AI grading.

## Checksum dan deterministic JSON

`contentSha256` adalah SHA-256 dari byte UTF-8 `content.json` yang benar-benar tersimpan. `contentBytes` harus sama dengan ukuran file. JSON memakai indent dua spasi, LF, dan satu newline akhir. Tidak ada timestamp build sehingga checksum stabil pada checkout yang sama.

Checksum hanya mendeteksi perubahan atau kerusakan file. Checksum bukan tanda tangan, bukti pembuat, autentikasi, atau enkripsi.

## Verifikasi package

```bash
npm run check:mandiri:learning-content
```

Script melakukan pembacaan read-only atas catalog, manifest, dan content; memeriksa path, byte count, SHA-256, exact-field manifest/catalog, content graph PR 1, referensi, versi, locale, status, dan safety lint. Kegagalan menghasilkan exit code non-zero. Script tidak mengubah file dan tidak melakukan network.

Ringkasan reviewer dapat dicetak dengan:

```bash
npm run review:mandiri:learning-content
```

Output memuat Program, Course, Module, Lesson, Exercise, correct answer, explanation, status checksum, safety finding, dan review status. Script tidak membuat file atau menyetujui konten.

## Content safety dan arithmetic verification

Safety test memastikan paket utama tidak memuat bahasa merendahkan, klaim pendidikan formal, diagnosis/klaim kesehatan, klaim keuntungan, laporan pajak resmi, raw HTML, script/event handler, atau URL. Fixture negatif membuktikan lint tetap mendeteksi pelanggaran dan tidak masuk package utama.

Arithmetic test memeriksa:

```text
8000 + 3000 = 11000
5000 + 7000 = 12000
4000 + 6000 = 10000
3000 + 7000 = 10000
5000 + 4000 != 10000
20000 - 13000 = 7000
15000 - 10000 = 5000
```

Evaluator PR 1 juga membuktikan multiple choice tidak bergantung urutan, sequence bergantung urutan, dan numeric input menolak desimal serta exponent notation.

Lint dan test tidak menggantikan review manusia.

## Hasil human-review gate

Pada 2026-07-17, Pemilik proyek VitaNusa memberikan persetujuan eksplisit setelah meninjau seluruh teks, contoh angka, latihan, jawaban benar, explanation, dan threshold quiz. Berdasarkan persetujuan itu, perubahan publikasi menetapkan:

```text
package status: published
reviewStatus: approved
entity status: published
```

Verifikasi otomatis yang terpisah memeriksa schema, arithmetic, checksum, content safety, serta graph reference. Identitas reviewer dokumentasi tidak memuat nama pribadi, email, tanda tangan, atau jabatan yang tidak diberikan. Codex tidak melakukan self-approval dan script repository tetap read-only.

## Memperbarui checksum dan koreksi berikutnya

Perubahan status entity dari `draft` ke `published` mengubah byte `content.json`. Ukuran dan checksum publikasi diperbarui dari file aktual menjadi:

```text
contentBytes: 16142
contentSha256: sha256:063e0dcfe9ca5914dadcf37b00b237cb0ca4067881c6a0385f13d8b1363f3ae0
```

Untuk perubahan pada paket yang belum published, hitung SHA-256 dari byte UTF-8 file aktual dengan primitive platform tepercaya, perbarui `contentBytes` dan `contentSha256`, lalu jalankan ulang seluruh verifikasi. Koreksi materi setelah versi ini published wajib menghasilkan content version baru; jangan overwrite content version 1 secara diam-diam.

## Privasi dan AI

Paket statis tidak memuat learner/account/workspace/user scope, UID, email, token, data VitaCheck, data usaha, data admin, atau percakapan. NusaAgent tidak diubah. Correct answer ditentukan oleh data terstruktur dan evaluator deterministik, bukan LLM.

## Known limitations

- Persetujuan dan status published hanya berlaku untuk paket `money-basics-id-v1` content version 1; ini bukan klaim kesiapan produksi aplikasi.
- Hanya ada satu module dengan tiga lesson dan sembilan exercise.
- Tidak ada UI, progress, attempt persistence, atau offline installation package.
- Contoh hanya mencakup integer rupiah tanpa pajak, diskon, hutang, atau pembayaran kurang.
- Checksum tidak membuktikan keaslian paket.
- Usability, literasi sasaran, screen reader, dan perangkat Android belum diuji karena belum ada UI.

## Rollback

Revert patch publikasi ini untuk mengembalikan status package ke gate kandidat bila diperlukan. Feature flag tetap `off`; tidak ada migrasi database atau data pengguna yang perlu diubah. Jangan menghapus IndexedDB Fase 1.

## PR 3 berikutnya

PR 3 belum dimulai pada branch publikasi ini. Setelah PR publikasi merge dan seluruh Actions hijau, paket dapat digunakan sebagai sumber PR 3 untuk membangun lesson reader serta exercise engine tanpa memperluas materi secara diam-diam.
