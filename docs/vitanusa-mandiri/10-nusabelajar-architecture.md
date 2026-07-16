# 10 — NusaBelajar Architecture

Status: **Proposed**. NusaBelajar belum diimplementasikan.

## Struktur konten

```text
Program
└── Course
    └── Module
        └── Lesson
            ├── Activity
            ├── Exercise
            └── Quiz
                └── Attempt
                    └── Progress

Achievement (optional, non-competitive) references Progress
```

- **Program** mengelompokkan tujuan besar, misalnya “Menghitung uang”.
- **Course** adalah rangkaian yang dapat diselesaikan bertahap.
- **Module** mengelompokkan lesson dengan satu hasil belajar.
- **Lesson** berisi blok teks/contoh pendek dan asset yang tervalidasi.
- **Activity** adalah interaksi tanpa nilai, seperti membaca contoh.
- **Exercise** dievaluasi dengan rule deterministik dan memberi feedback langsung.
- **Quiz** mengelompokkan exercise terpilih.
- **Attempt** immutable dan merujuk content version.
- **Progress** adalah read model per unit, bukan ukuran kecerdasan.
- **Achievement** ditunda dari MVP kecuali pilot membuktikan tidak menimbulkan tekanan atau kompetisi yang tidak sehat.

## Topik awal proposed

Membaca informasi sederhana; menulis data sehari-hari; penjumlahan dan pengurangan; perkalian sederhana; menghitung uang; menghitung kembalian; membaca waktu; membaca ukuran; literasi kesehatan dasar; keamanan digital; dan dasar pencatatan usaha.

Materi kesehatan mengikuti konstitusi VitaNusa, bukan diagnosis. Materi usaha menjelaskan bahwa laporan sederhana bukan akuntansi/pajak resmi.

## Content package

Satu package memiliki manifest:

```text
packageId
contentVersion
minAppSchemaVersion
locale
publishedAt
courseIds
assetManifest [{path, bytes, sha256, mediaType}]
totalBytes
signature/checksum metadata
```

JSON schema menolak script, event handler, arbitrary URL scheme, dan field tidak dikenal. Published package immutable; koreksi menghasilkan version baru. Progress lama tetap menunjuk version yang dikerjakan agar score tidak dibandingkan dengan soal berbeda tanpa penjelasan.

## Prinsip bahasa dan interaksi

- Satu instruksi per langkah dan contoh sebelum latihan.
- Kalimat pendek, istilah konsisten, angka ditampilkan dengan contoh benda sehari-hari.
- Tombol tidak hanya memakai ikon atau warna.
- Feedback menjelaskan langkah, bukan menilai pribadi.
- Hindari “bodoh”, “gagal”, “tidak mampu”, atau “tertinggal”.
- Jangan menganggap literasi rendah sebagai ketidakmampuan mengambil keputusan.
- Pengguna dapat mengulang tanpa penalti dan dapat melewati audio/animasi.
- Konten diuji dengan pembaca sasaran dan content reviewer; LLM tidak memublikasikan materi otomatis.

## Skor dan progres

Status yang diizinkan:

- `not_started` — Belum dicoba;
- `in_progress` — Sedang dipelajari;
- `needs_practice` — Perlu latihan;
- `mastered_this_practice` — Sudah dikuasai pada latihan ini.

Score attempt disimpan sebagai basis points integer `0..10000`. Rule example: sebuah quiz dapat menandai `mastered_this_practice` bila correct count memenuhi threshold versioned. Copy selalu menambahkan “pada latihan ini”; tidak menyatakan IQ, kemampuan umum, kelulusan formal, atau kesetaraan sekolah.

Merge cloud menyimpan attempt unique dan best score pada content version yang sama. Attempt count tidak digabung dengan penjumlahan counter mentah. Reset progress merupakan tindakan user eksplisit dan tidak menghapus attempt tanpa consent terpisah.

## Offline package flow

1. Tampilkan ukuran package dan versi sebelum download.
2. Pengguna memilih download; tidak auto-download asset besar.
3. Unduh manifest, validasi schema/checksum, lalu tulis package atomik.
4. Versi lama tetap dipakai sampai versi baru lengkap.
5. Setelah switch sukses, asset lama eligible cleanup bila tidak direferensikan.
6. Lesson/quiz berjalan tanpa network; attempt/progress masuk local repository dan outbox hanya bila cloud consent aktif.

Ukuran awal harus text-first. Batas package dan asset ditentukan setelah pengukuran Android; jangan menetapkan angka tanpa spike. `navigator.storage.estimate()` hanya memberi peringatan.

## Rekomendasi pelajaran berikut

Engine deterministik memakai prerequisite, state unit, content version, dan pilihan pengguna. Urutan proposed:

1. lanjutkan lesson `in_progress`;
2. tawarkan latihan untuk `needs_practice`;
3. buka next prerequisite yang terpenuhi;
4. izinkan pengguna memilih course lain.

NusaAgent boleh menjelaskan atau membuka unit. Agent tidak mengubah score, menandai mastery, atau membuat attempt palsu.

## Mentor consent

Grant proposed:

```text
grantId
learnerUid
mentorUid
scope: {courseIds, fields: [state, bestScore, lastPracticedAt]}
status: active|revoked|expired
grantedAtServer
expiresAt optional
revokedAtServer optional
```

Alur: learner grants → mentor menerima → Rules memeriksa grant pada setiap read → learner dapat revoke → cache mentor dibersihkan. Default scope tidak memuat jawaban, health, usaha, email, atau seluruh activity log. Expiry direkomendasikan tetapi optional untuk MVP; UI harus menampilkan siapa yang dapat melihat apa.

Mentor invitation melalui email atau link masih pertanyaan owner. Token harus random, hashed di server, sekali pakai, expire, dan rate-limited. Invitation tidak membawa progress di URL.

## Accessibility dan safety test

- keyboard dan screen reader mengumumkan prompt, pilihan, feedback, dan status;
- zoom 200% dan viewport 360 px tanpa horizontal scroll;
- touch target sekitar 44 px;
- instruksi tidak bergantung pada drag-only interaction;
- number formatting `id-ID` tidak mengubah nilai internal;
- offline/update message tidak menghilangkan attempt;
- health lesson tetap menampilkan batas edukasi dan emergency routing;
- content review mendeteksi bahasa merendahkan, klaim formal, dan klaim kesehatan berlebihan.

## Boundaries

Data learning tidak masuk workspace report, Agent action audit bisnis, atau VitaCheck. Platform admin dapat mengelola materi published sesuai role platform tetapi tidak membaca progress learner. Mentor permission tidak pernah menjadi membership usaha.
