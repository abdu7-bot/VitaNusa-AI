# Fase 2 PR 3 — NusaBelajar Lesson Reader

## Status

PR ini menyediakan lesson reader dan latihan interaktif **internal-only** untuk paket
`money-basics-id-v1`. Ini belum merupakan aplikasi belajar siap produksi. Jawaban hanya
berada di memori halaman; belum ada attempt, progress, mastery, learner scope, atau
sinkronisasi cloud.

## Tujuan dan batas fitur

Reader menampilkan paket yang telah berstatus `published` dan `approved`, memverifikasi
byte serta checksum-nya di browser, lalu menjalankan lima tipe latihan menggunakan
evaluator deterministik dari PR 1. Reader tidak memakai login karena paketnya statis dan
PR ini tidak menyimpan data pengguna.

Fitur hanya aktif bila kedua build flag bernilai `internal`:

```text
VITE_VITANUSA_MANDIRI_STATE=internal
VITE_NUSABELAJAR_STATE=internal
```

Nilai tidak dikenal dan nilai yang tidak diisi menjadi `off`. Saat salah satu flag `off`,
halaman menampilkan pesan belum tersedia dan tidak memanggil `fetch`, auth, workspace,
atau IndexedDB. Feature flag bukan permission.

## Halaman

- `mandiri/belajar/index.html` menampilkan hierarchy Program → Course → Module → Lesson.
- `mandiri/belajar/lesson.html?lesson=<lessonId>` menampilkan satu lesson, activity,
  exercise, serta navigasi previous/next.

Query lesson harus berisi tepat satu parameter `lesson`, panjangnya dibatasi, dan ID-nya
divalidasi. ID hanya dipakai untuk lookup pada graph terverifikasi—tidak pernah menjadi
path fetch, dynamic import, HTML, atau URL konten.

## Static content build

Vite tetap menggunakan `base: './'` dan mode multi-page. Plugin internal kecil menyalin
hanya file runtime berikut secara byte-for-byte:

```text
content/mandiri/learning/catalog.json
content/mandiri/learning/packages/money-basics-id-v1/manifest.json
content/mandiri/learning/packages/money-basics-id-v1/content.json
```

Laporan `CONTENT-REVIEW.md` tidak masuk public build. Tidak ada timestamp build dan JSON
tidak diformat ulang. Service worker tidak diubah oleh PR ini.

## Loading dan integritas

Urutan loader adalah feature gate → byte catalog → batas ukuran → parse dan validasi
catalog → filter `published/approved` → byte manifest → validasi manifest → byte content
→ `contentBytes` → SHA-256 → parse dan validasi graph → pemeriksaan seluruh entity
`published` → content index immutable.

Semua URL runtime diselesaikan dari catalog same-origin di bawah
`content/mandiri/learning/`. Absolute URL, URL scheme, protocol-relative URL, path
traversal (termasuk encoded/double-encoded), backslash, query, fragment, dan null byte
ditolak. Tidak ada remote endpoint.

Batas defensif awal:

- catalog: 64 KiB;
- manifest: 64 KiB;
- content: 1 MiB.

SHA-256 dihitung dengan `crypto.subtle.digest('SHA-256', bytes)`. Checksum juga harus
berformat `sha256:<64 hex lowercase>`. Checksum mendeteksi perubahan file; checksum bukan
tanda tangan digital dan tidak membuktikan identitas penerbit.

## Content index dan view model

Setelah graph tervalidasi, loader membentuk index privat untuk Program, Course, Module,
Lesson, Activity, Exercise, dan Quiz. Index tidak disimpan di global mutable state.

`getCatalogView()` hanya mengembalikan summary public yang dibutuhkan katalog, dalam
urutan ID yang ditentukan paket. `getLessonView(lessonId)` mengembalikan breadcrumb,
metadata lesson, blocks, activities, public exercises, serta previous/next lesson.
Public exercise hanya memuat `exerciseId`, `type`, `prompt`, `choices`, dan
`maxAttempts`; `correctAnswer` tidak masuk view model atau DOM.

## Rendering aman dan aksesibilitas

Block renderer mendukung `heading`, `paragraph`, `example`, `tip`, `warning`, dan
`simple_list`. Semua teks dipasang dengan `textContent`; tidak ada raw HTML,
`innerHTML`, `eval`, atau executable content.

Activity renderer mendukung `read_example` dan `observe_sequence`. Penandaan activity
hanya bertahan di memori halaman, tidak mempunyai skor, dan tidak membuat progress.

Exercise memakai `fieldset`, `legend`, label, radio/checkbox, atau input text. Sequence
menggunakan tombol `Naik` dan `Turun` sehingga tidak bergantung pada drag-and-drop.
Perubahan sequence dan feedback diumumkan melalui `aria-live`. Halaman memiliki skip
link, landmark `main`, focus-visible, touch target sekitar 44 px, safe-area padding, dan
dukungan `prefers-reduced-motion`.

## Exercise session dan evaluasi

Session immutable mempunyai state `idle`, `answering`, `invalid`, `incorrect`, `correct`,
dan `limit_reached`. Session hanya menyimpan jawaban sementara, jumlah submit, feedback,
dan hasil evaluasi minimal. `maxAttempts: null` berarti tidak dibatasi; integer membatasi
session halaman tersebut. Tombol ulangi membuat session baru.

Tipe yang tersedia:

- `single_choice`: membandingkan choice ID;
- `multiple_choice`: set choice ID, tanpa ketergantungan urutan klik;
- `numeric_input`: controlled integer tanpa desimal, exponent, rumus, atau coercion;
- `short_text_exact`: normalisasi terbatas sesuai schema, tanpa fuzzy/AI;
- `sequence`: urutan choice ID yang exact dan order-sensitive.

Evaluator PR 1 tetap menjadi sumber kebenaran. UI menerima hanya `correct`,
`feedbackCode`, `explanation`, `submissionCount`, dan `attemptsRemaining`. Feedback yang
dipakai adalah ramah: jawaban tepat, coba kembali, lihat contoh, atau jawaban invalid.
Tidak ada AI grading.

## Privasi dan lifecycle

Jawaban tidak ditulis ke localStorage, sessionStorage, IndexedDB, cookie, Cache API,
analytics, console, atau network. Reload halaman membuat controller dan session baru,
sehingga seluruh jawaban/activity state hilang. Database `vitanusa-mandiri` tetap version
1 dan tidak memperoleh learning object store.

## Pengujian

```bash
npm run check
npm run check:mandiri:learning-content
npm run test:mandiri:learning-domain
npm run test:mandiri:learning-content
npm run test:mandiri:learning-reader
npm run test:mandiri
python scripts/check_suspicious_unicode.py
git diff --check
```

Suite reader menguji path traversal, byte limit, checksum browser, gate published-only,
graph validation, immutable index/view model, routing, seluruh block/activity/exercise,
feedback, session memory, shell flags, dan output build byte-for-byte.

CSS dirancang untuk 360×800, 390×844, 412×915, dan 768×1024. Pemeriksaan struktural
responsive dilakukan di test/build; pengujian pada perangkat Android fisik tetap harus
dilakukan secara manual sebelum klaim kompatibilitas perangkat.

## Rollback

Matikan `VITE_NUSABELAJAR_STATE` ke `off` untuk menutup reader tanpa menghapus data
Mandiri. Revert PR ini bila perlu, tetapi jangan menghapus IndexedDB Fase 1. Karena PR ini
tidak menyimpan jawaban, tidak ada migrasi atau rollback data belajar.

## Keterbatasan dan pekerjaan berikutnya

- internal-only dan belum siap produksi;
- hanya satu paket statis;
- tidak ada module quiz session;
- tidak ada attempt atau progress;
- tidak ada persistence offline khusus paket di IndexedDB;
- tidak ada learner scope, rekomendasi, atau sync;
- checksum bukan signature;
- belum diuji pada Android fisik dalam PR ini.

PR 4 kelak dapat menambah quiz, attempt, progress, dan IndexedDB version 2 setelah PR ini
direview dan merge. Pekerjaan tersebut tidak dimulai pada branch ini.
