# 24 — Fase 2 PR 2: Paket Konten Awal NusaBelajar

Status: **Kandidat draft; menunggu review manusia**.

PR ini menambahkan satu paket materi statis berbahasa Indonesia untuk NusaBelajar. Paket sudah dapat diperiksa oleh validator, checksum, arithmetic test, dan safety lint, tetapi belum published dan belum dapat digunakan learner karena UI serta persistence belum tersedia.

## Tujuan dan batas PR 2

Paket kandidat membahas membaca harga, menjumlahkan dua harga, dan menghitung kembalian sederhana. PR ini tidak menambah halaman katalog, lesson reader, exercise/quiz UI, IndexedDB learning, progress, cloud sync, mentor, atau tindakan NusaAgent.

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

Nilai kandidat:

- `packageFormat: vitanusa-learning-package`;
- `packageFormatVersion: 1`;
- `packageId: money-basics-id-v1`;
- `schemaVersion: 1`;
- `contentVersion: 1`;
- `locale: id-ID`;
- `status: draft`;
- `reviewStatus: pending_human_review`.

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

Semua entity memakai `schemaVersion: 1`, `contentVersion: 1`, `locale: id-ID`, dan `status: draft`.

## Materi kandidat

- Program: **Keterampilan Dasar Sehari-hari**.
- Course: **Menghitung Uang Sederhana**.
- Module: **Belanja dan Kembalian**.
- Lesson 1: **Membaca Harga** — tanda Rp, pemisah ribuan, nilai integer, dan label harga.
- Lesson 2: **Menjumlahkan Dua Harga** — contoh `8000 + 3000 = 11000` dan urutan pemeriksaan.
- Lesson 3: **Menghitung Kembalian Sederhana** — `uang dibayar - total belanja` dengan dua contoh pembayaran cukup.

Activity memakai `read_example` dan `observe_sequence`; activity tidak menghasilkan score. Sembilan exercise memakai `single_choice`, `multiple_choice`, `numeric_input`, `short_text_exact`, dan `sequence`. Nilai rupiah untuk kalkulasi selalu integer.

Quiz module memilih enam exercise yang sudah ada, dua dari setiap lesson. Passing threshold kandidat adalah `7000` basis points. Threshold ini belum final sampai review manusia selesai. Tidak ada timer, ranking, leaderboard, penalti pengulangan, atau AI grading.

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

## Human-review gate

Kandidat awal wajib tetap:

```text
package status: draft
reviewStatus: pending_human_review
entity status: draft
```

Codex bukan content reviewer manusia. Prosedur setelah review, yang didokumentasikan tetapi tidak dijalankan pada PR kandidat ini:

1. Reviewer membaca `CONTENT-REVIEW.md` dan seluruh `content.json`.
2. Reviewer memeriksa setiap teks, contoh angka, correct answer, explanation, dan threshold.
3. Koreksi dimasukkan ke `content.json` pada branch yang sama.
4. `contentBytes` dan `contentSha256` diperbarui dari byte file terbaru.
5. Semua test dan script verifikasi dijalankan ulang.
6. Reviewer memberi persetujuan eksplisit.
7. `reviewStatus` diubah menjadi `approved`.
8. Package, catalog, dan seluruh entity diubah menjadi `published` dalam perubahan yang sama.
9. Semua test dijalankan ulang.
10. PR baru dapat dipertimbangkan untuk merge.

Tidak ada self-approval atau publikasi otomatis.

## Memperbaiki materi dan memperbarui checksum

1. Edit hanya field yang diizinkan schema dalam `content.json`.
2. Jalankan `npm run check:mandiri:learning-content`; mismatch checksum diharapkan sebelum manifest diperbarui.
3. Hitung SHA-256 dari byte UTF-8 file aktual dengan primitive platform tepercaya, bukan algoritma buatan sendiri.
4. Perbarui `contentBytes` dan `contentSha256` pada manifest.
5. Jalankan verifikasi, content tests, learning domain tests, dan seluruh Mandiri tests.
6. Perbarui `CONTENT-REVIEW.md` bila teks, angka, jawaban, atau explanation berubah.

Koreksi setelah versi published harus menghasilkan content version baru; jangan overwrite versi published secara diam-diam.

## Privasi dan AI

Paket statis tidak memuat learner/account/workspace/user scope, UID, email, token, data VitaCheck, data usaha, data admin, atau percakapan. NusaAgent tidak diubah. Correct answer ditentukan oleh data terstruktur dan evaluator deterministik, bukan LLM.

## Known limitations

- Konten belum mendapat review manusia dan belum published.
- Hanya ada satu module dengan tiga lesson dan sembilan exercise.
- Tidak ada UI, progress, attempt persistence, atau offline installation package.
- Contoh hanya mencakup integer rupiah tanpa pajak, diskon, hutang, atau pembayaran kurang.
- Checksum tidak membuktikan keaslian paket.
- Usability, literasi sasaran, screen reader, dan perangkat Android belum diuji karena belum ada UI.

## Rollback

Revert PR ini untuk menghapus kandidat package dan validator manifest/catalog. Feature flag tetap `off`; tidak ada migrasi database atau data pengguna yang perlu diubah. Jangan menghapus IndexedDB Fase 1.

## PR 3 berikutnya

PR 3 belum dimulai. Setelah kandidat direview manusia, disetujui eksplisit, diperbarui menjadi published, test hijau, dan PR 2 merge, PR 3 dapat membangun lesson reader serta exercise engine tanpa memperluas paket materi secara diam-diam.
