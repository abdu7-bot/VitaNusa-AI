# 23 — Fase 2 PR 1: Domain dan Schema Konten NusaBelajar

Status: **Implemented untuk fondasi domain; belum ada UI, materi final, atau penyimpanan progres**.

Dokumen ini mencatat implementasi Fase 2 PR 1. NusaBelajar belum dapat digunakan sebagai aplikasi belajar pada tahap ini. PR ini hanya menyediakan model data murni, validator graph, evaluator deterministik, lint keselamatan konten, dan unit test.

## Tujuan PR 1

PR ini membentuk batas domain NusaBelajar yang terpisah dari VitaCheck, data workspace usaha, admin, backend, dan NusaAgent. Semua modul baru:

- hanya memproses plain object dan plain array;
- tidak menyentuh DOM;
- tidak membuka IndexedDB;
- tidak memakai `localStorage`;
- tidak memakai Firebase atau network;
- tidak memanggil LLM atau NusaAgent;
- tidak memutasi input;
- menghasilkan salinan yang dibekukan mendalam.

Database `vitanusa-mandiri` tetap versi `1` dengan object store Fase 1 saja.

## Feature flag

Subfeature memakai build variable non-rahasia `VITE_NUSABELAJAR_STATE`. Nilai yang didukung hanya `off` dan `internal`; nilai kosong atau tidak dikenal menjadi `off`.

Kontrak NusaBelajar bernilai `internal` hanya ketika kedua kondisi berikut terpenuhi:

1. `VITE_VITANUSA_MANDIRI_STATE=internal`;
2. `VITE_NUSABELAJAR_STATE=internal`.

Helper pada PR ini bersifat murni. Tidak ada navigasi atau UI yang diaktifkan. Feature flag bukan permission dan tidak memulai storage.

## Hierarki domain

```text
Program
└── Course
    └── Module
        └── Lesson
            ├── Activity
            ├── Exercise
            └── Quiz

Attempt  → versi konten yang dikerjakan
Progress → ringkasan per lesson dan versi konten
```

`Activity` tidak mempunyai score. `Exercise` mempunyai jawaban benar terstruktur. `Quiz` mengacu pada exercise. `Attempt` menyimpan satu pengerjaan secara immutable setelah terminal. `Progress` merupakan ringkasan, bukan pengganti attempt.

## Content version dan status

Entity konten membawa:

- `schemaVersion`, dinormalisasi ke `1`;
- `contentVersion`, safe integer positif;
- `locale`, saat ini hanya `id-ID`;
- `status`: `draft`, `published`, atau `retired`.

Semua hasil normalisasi dibekukan. Graph published hanya boleh mengacu pada entity published dengan versi dan locale yang sama. Koreksi terhadap materi published harus diterbitkan sebagai `contentVersion` baru pada workflow konten Fase 2 PR 2; overwrite package published tidak dibuat pada PR ini.

## Model konten

### Program

`programId`, `contentVersion`, `locale`, `title`, `summary`, `courseIds`, dan `status`. `courseIds` wajib unik dan tidak kosong.

### Course

`courseId`, `programId`, `contentVersion`, `locale`, `title`, `summary`, `learningObjective`, `moduleIds`, `prerequisiteCourseIds`, dan `status`. Self-prerequisite ditolak; circular prerequisite diperiksa pada graph.

### Module

`moduleId`, `courseId`, `contentVersion`, `locale`, `title`, `summary`, `learningObjective`, `lessonIds`, dan `status`. Urutan `lessonIds` dipertahankan.

### Lesson

`lessonId`, `moduleId`, `contentVersion`, `locale`, `title`, `summary`, `learningObjective`, `estimatedMinutes`, `blocks`, `activityIds`, `exerciseIds`, `quizId`, dan `status`.

`estimatedMinutes` adalah integer `1..60` dan hanya perkiraan. Tipe block yang didukung:

- `heading`;
- `paragraph`;
- `example`;
- `tip`;
- `warning`;
- `simple_list`.

Blok bukan HTML. Tag, event handler, URL scheme berbahaya, arbitrary URL, dan tautan Markdown ditolak. Satu lesson dibatasi sampai 50 block.

### Activity

`activityId`, `lessonId`, `contentVersion`, `locale`, `type`, `prompt`, `items`, `explanation`, dan `status`.

Tipe MVP:

- `read_example`;
- `observe_sequence`;
- `match_concept`.

Activity tidak membawa field score atau mastery.

### Exercise

`exerciseId`, `lessonId`, `contentVersion`, `locale`, `type`, `prompt`, `choices`, `correctAnswer`, `explanation`, `maxAttempts`, dan `status`.

Tipe yang didukung:

- `single_choice`: ID pilihan dibandingkan tepat;
- `multiple_choice`: set ID dibandingkan tanpa bergantung urutan;
- `numeric_input`: hanya safe integer;
- `short_text_exact`: trim, normalisasi Unicode dan whitespace, serta aturan case-sensitive eksplisit;
- `sequence`: urutan ID dibandingkan tepat.

Choice hanya mempunyai `choiceId` dan `label`. Choice tidak menyimpan `isCorrect`. Correct answer tidak pernah dieksekusi sebagai kode. Essay, AI grading, voice grading, image recognition, formula string, dan free-form LLM tidak didukung.

### Quiz

`quizId`, tepat satu dari `moduleId` atau `lessonId`, `contentVersion`, `locale`, `exerciseIds`, `passingThresholdBasisPoints`, dan `status`. Threshold adalah integer `0..10000`. Timer tidak tersedia.

## Evaluator dan score

`evaluateAnswer(exercise, submittedAnswer)` menormalkan jawaban secara terbatas dan mengembalikan:

- `correct`;
- `normalizedAnswer`;
- `expectedAnswerSummary`;
- `feedbackCode`.

Feedback code yang disediakan adalah `correct`, `try_again`, `review_example`, dan `invalid_answer`. Teks UI baru dibuat pada PR berikutnya.

Score dihitung sebagai basis points integer:

```text
round_half_up(correctCount × 10000 / questionCount)
```

Implementasi memakai integer/`BigInt` untuk keputusan pembulatan. Score bukan ukuran kecerdasan, tidak dibandingkan dengan pengguna lain, dan bukan bukti kesetaraan sekolah.

## Attempt

Attempt membawa `attemptId`, `learnerScope`, relasi course/module/lesson/quiz, `contentVersion`, jawaban terstruktur terbatas, hasil basis points, hitungan benar/soal, status, timestamp lokal, dan `operationId`.

Status yang didukung:

- `in_progress` tanpa hasil final;
- `completed` dengan timestamp dan score yang cocok dengan hitungan deterministik;
- `abandoned` tanpa hasil final.

Record yang dinormalisasi dibekukan. Attempt terminal tidak dapat diganti dengan record berbeda. Transisi dari `in_progress` mempertahankan identitas, scope, versi konten, dan waktu mulai.

## Progress

State yang didukung:

| State | Label masa depan |
| --- | --- |
| `not_started` | Belum dicoba |
| `in_progress` | Sedang dipelajari |
| `needs_practice` | Perlu latihan |
| `mastered_this_practice` | Sudah dikuasai pada latihan ini |

Progress membawa best score, attempt terakhir, jumlah attempt, dan waktu latihan terakhir. `attemptCount` hanya metadata teknis dan tidak digunakan sebagai penalti. Label tidak menyatakan kemampuan umum, IQ, kelulusan, atau kesetaraan sekolah.

## Validasi content graph

`validateContentPackageGraph()` menerima graph in-memory dengan collection `programs`, `courses`, `modules`, `lessons`, `activities`, `exercises`, dan `quizzes`.

Validator memeriksa:

- exact-field dan dangerous key secara rekursif;
- plain data, kedalaman, dan ukuran collection;
- duplicate entity dan nested ID;
- seluruh referensi maju dan balik;
- relasi parent-child;
- circular prerequisite;
- kesesuaian content version, locale, dan status published;
- choice dan correct answer;
- threshold quiz;
- raw HTML, script/event handler, dan URL berbahaya;
- lint keselamatan bahasa.

Error mempunyai `code`, `path`, dan pesan aman. Konten invalid ditolak; validator tidak memperbaiki graph secara diam-diam.

Batas defensif awal adalah 10 program, 100 course, 500 module, 2.000 lesson, 5.000 activity, 10.000 exercise, 2.000 quiz, 50 block per lesson, dan 20 choice per exercise. Batas ini bukan target jumlah materi.

## Content safety lint

Lint mendeteksi pola terkontrol untuk:

- bahasa yang menilai pribadi, misalnya “kamu bodoh” atau “gagal total”;
- klaim kesetaraan/kelulusan pendidikan formal;
- diagnosis atau klaim kesehatan berlebihan;
- klaim keuntungan atau laporan pajak resmi.

Kalimat teknis netral seperti “Jika koneksi gagal, coba lagi” tidak ditandai. Lint tidak menggantikan review manusia dan tidak boleh menjadi satu-satunya proses penerbitan materi.

## Batas AI

Tidak ada AI grading pada PR ini. NusaAgent tidak diubah dan tidak dapat menentukan jawaban, score, attempt, mastery, publikasi konten, atau progress. Evaluator hanya memakai rule terstruktur dan deterministic.

## Batas privasi

PR ini tidak menyimpan data. Attempt dan Progress memakai `learnerScope`, bukan `workspaceId`. Schema konten tidak menerima email, token, role admin, role workspace, hasil VitaCheck, atau data usaha. Pembuatan guest scope dan persistence baru direncanakan pada PR berikutnya.

## Pengujian

```bash
npm run test:mandiri:learning-domain
npm run test:mandiri
npm run check
python scripts/check_suspicious_unicode.py
git diff --check
```

CI menjalankan suite NusaBelajar tanpa menghapus suite Fase 1, admin, user auth, VitaCheck, Android PWA, Firestore Rules, backend, Unicode, atau repository safety.

## Known limitations

- Belum ada UI, katalog, lesson reader, exercise page, atau quiz page.
- Belum ada content package atau materi published yang dapat dipakai learner.
- Belum ada IndexedDB version 2, attempt repository, progress repository, atau guest scope generator.
- Belum ada offline package, rekomendasi, mentor, sertifikat, leaderboard, atau cloud sync.
- Lint berbasis pola terkontrol membutuhkan review manusia dan pengujian bahasa lebih luas.
- Format activity item dan kebijakan transisi package published perlu divalidasi bersama content reviewer.

## Needs validation

Dokumen Fase 0 masih berstatus `Proposed` dan memakai beberapa nama field/enum lama seperti `levelLabel`, `bodyBlocks`, `choice/ordering/numeric`, dan `ownerUid`. PR ini memakai kontrak yang lebih sempit pada spesifikasi Fase 2: `learningObjective`, structured blocks, lima tipe exercise, dan `learnerScope`. Keputusan ini dicatat sebagai **Needs validation** dan tidak mengubah status ADR atau keputusan bisnis lain.

## PR 2 berikutnya

PR 2 boleh dimulai hanya setelah PR ini direview dan merge. Scope yang direncanakan adalah satu content package kecil, materi awal yang ditinjau manusia, package manifest, checksum build, dan content lint terhadap materi tersebut. PR ini tidak membuat materi final.

## Rollback

Rollback kode dilakukan dengan merevert PR ini dan mempertahankan kedua feature flag pada `off`. Tidak ada migrasi database atau data learning yang perlu dihapus karena PR ini tidak membuka atau menulis IndexedDB.
