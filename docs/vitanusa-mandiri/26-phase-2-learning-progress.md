# Fase 2 PR 4 — Kuis dan Progres Lokal NusaBelajar

## Status dan scope

PR ini menambahkan kuis akhir modul dan progres local-only pada NusaBelajar internal.
Tidak ada Firestore, sinkronisasi cloud, AI grading, leaderboard, deployment, atau restore
commit. Evaluator deterministik dan kontrak domain Fase 2 tetap menjadi sumber kebenaran.

Kedua feature flag Mandiri dan NusaBelajar harus `internal`. Bila gate `off`, controller
tidak membuat runtime, tidak membuka IndexedDB, dan tidak memuat materi.

## IndexedDB version 2

Migration non-destruktif v1 ke v2 mempertahankan lima store lama dan menambah:

- `learningAttempts`, key `[learnerScope, attemptId]`;
- `learningProgress`, key `[learnerScope, courseId, moduleId, lessonId]`.

Seluruh index diawali `learnerScope`. Index operasi attempt bersifat unique agar satu
`operationId` tidak dapat menghasilkan completion kedua dalam scope learner yang sama.
Migration tidak menghapus store/index dan tidak melakukan network.

## Completion transaction

UI membentuk quiz session immutable dan hanya mengizinkan simpan setelah setiap soal
mempunyai evaluasi valid. Completion membuat attempt terminal `completed`. Repository
attempt hanya menyediakan `addCompleted`; tidak ada jalur update/overwrite attempt.

Attempt dan progress ditulis dalam satu transaction readwrite yang mencakup tepat dua
learning store. Transaction membaca duplicate operation dan progress lama, lalu:

1. menolak operation ID yang sama dengan payload berbeda;
2. mengembalikan hasil duplicate tanpa menambah `attemptCount` bila payload sama;
3. menambahkan attempt completed secara append-only;
4. menaikkan `attemptCount` tepat satu;
5. mempertahankan maksimum `bestScoreBasisPoints`;
6. memperbarui last attempt dan state mastery berdasarkan passing threshold.

Kegagalan salah satu write meng-abort keduanya. Semua read/write memerlukan
`learnerScope` eksplisit dan record dari scope lain tidak dikembalikan.

## UI dan learner scope

Kuis modul tampil setelah lesson terakhir. Hasil dan skor terbaik ditampilkan sebagai
persentase, bersama jumlah percobaan. Guest learner scope adalah identifier acak non-email
yang disimpan lokal agar stabil pada perangkat tersebut. Scope guest tidak digabungkan
otomatis dengan akun atau workspace.

## Backup dan recovery

Backup baru memakai format version 2 dan database schema version 2. Dua collection
learning untuk user scope yang berpasangan dengan account scope ikut checksum, batas
record, exact-field validation, duplicate detection, serta pemeriksaan scope. Backup
format version 1 tetap diterima oleh validator dan menghasilkan preview dengan count
learning nol.

Recovery tetap preview-only: file dibaca, divalidasi, dicocokkan scope, dan diringkas.
Tidak ada API import, write transaction restore, atau tombol commit restore.

## Rollback

Kode dapat di-revert tanpa menghapus IndexedDB. Database yang sudah naik ke v2 tidak
boleh dipaksa turun ke binary v1; binary lama akan menolak schema terlalu baru. Backup v2
harus dipertahankan. Jangan menghapus learning store sebagai bagian rollback otomatis.
