# Review Pipeline, Human Approval, dan Integrator Contract

Bagian ini menetapkan urutan pipeline, gate approval manusia, dan kapan Integrator
diperlukan. Isinya memperketat aturan T002-R1, tidak melonggarkannya. Revisi
T003-R1 mengoreksi bagian tafsir Integrator yang terlalu luas pada versi T003
awal.

## 1. Urutan pipeline kanonik

```text
IMPLEMENT
  ↓
VALIDATE
  ↓
REVIEW
  ↓
INTEGRATOR HANDOFF (bila Integrator diperlukan)
  ↓
HUMAN APPROVAL (bila diwajibkan)
  ↓
COMMIT atau MERGE
```

Urutan ini adalah urutan canonical untuk seluruh dokumen T003. Urutannya diambil
dari governance repository, bukan dari pipeline generik:

- `.agents/WORKFLOW.md` §1 memetakan `IMPLEMENT` ke `ACTIVE`, `VALIDATE` ke
  `TESTING`, `REVIEW` ke `REVIEW`, dan `COMMIT` ke `DONE`.
- `.agents/WORKFLOW.md` §2 menyatakan `TESTING → REVIEW` hanya setelah validasi
  dicatat, dan `REVIEW → DONE` hanya setelah checklist review PASS.

Karena itu validation selalu mendahului review. Tidak ada diagram atau dokumen
T003 yang boleh menampilkan urutan lain. Istilah lain seperti "reviewer sebelum
validation" hanya sah sebagai sebutan lain dari tahap yang sama, bukan urutan
baru.

## 2. Stage dan syaratnya

| Stage | Syarat masuk | Syarat keluar | Siapa yang melakukan |
|---|---|---|---|
| IMPLEMENT | Claim tercatat, scope eksplisit, kelas task jelas, approval tertulis bila diwajibkan | Diff hanya pada scope; kategori sesuai `**Class:**` | Implementer |
| VALIDATE | Diff lengkap | Semua perintah validasi pada `.agents/WORKFLOW.md` §6 lulus dan tercatat | Implementer atau Reviewer |
| REVIEW | Validation PASS | Checklist `.agents/WORKFLOW.md` §7 PASS dan tercatat | Reviewer terpisah, atau self-review untuk `DOC` dan `TEST` |
| INTEGRATOR HANDOFF | Review PASS dan Integrator diperlukan (§4.1) | Bukti gate terkumpul dan handoff dicatat | Implementer |
| HUMAN APPROVAL | Approval diwajibkan oleh kelas task atau area terlindungi | Approval tercatat pada file task | Manusia |
| COMMIT atau MERGE | Semua gate yang berlaku PASS | Satu commit dengan task ID; status task diperbarui | Implementer untuk sesi satu task tanpa branch; Integrator bila Integrator diperlukan |

Aturan yang tidak bisa dilanggar:

1. Implementer tidak boleh menjadi satu-satunya penilai perubahan yang ia buat
   untuk kelas `TOOL`, `CONFIG`, `CI`, `CODE`, dan `ADR`. Ia boleh menjalankan
   validasi, tetapi penentu PASS adalah Reviewer.
2. Tidak ada jalur `implement → merge` tanpa review PASS dan tanpa gate yang
   diwajibkan. Untuk sesi satu task pada branch saat ini, Implementer boleh
   commit setelah reviewer PASS (`.agents/WORKFLOW.md` §8); Integrator bukan
   syarat tambahan pada jalur itu.
3. Validation yang gagal dengan penyebab yang belum dipahami adalah stop
   condition (`TESTING → FAILED`), bukan alasan untuk melanjutkan
   (`.agents/AGENTS.md` §7).
4. Review yang tidak ditelusuri ke task berarti `BLOCKED`, bukan `PASS`.
5. Urutan tidak boleh dibalik. Validation sebelum review, bukan sesudahnya.

## 3. Human approval gate

Aturan T002-R1 dipertahankan apa adanya. Ringkasnya:

1. Setiap perubahan production code memerlukan tiga syarat sekaligus: scope
   eksplisit, human approval tertulis **sebelum** perubahan dibuat, dan
   traceability (`.agents/AGENTS.md` §5.1).
2. Approval juga diwajibkan untuk workflow CI, konfigurasi deployment, dan
   manifest dependency runtime (`.agents/RULES.md` §Human approval wajib).
3. Approval dicatat pada file task sebelum file pertama disentuh. Approval yang
   tidak tercatat dianggap tidak ada.
4. Approval lisan, asumsi, "kayaknya tidak berisiko", atau persetujuan setelah
   review bukan approval.

Ada dua titik approval yang berbeda dan keduanya dapat berlaku:

| Titik | Waktu | Pemicu |
|---|---|---|
| Approval pra-perubahan | Sebelum file pertama disentuh | Perubahan production code, CI, deployment, atau dependency manifest |
| Approval integrasi | Sebelum merge | Area terlindungi yang diubah, atau task dengan `DEPLOY` |

Keduanya direkam pada file task dengan field `**Approval:**`.

## 4. Integrator

### 4.1 Kapan Integrator diperlukan

Integrator **hanya** diperlukan pada tiga kondisi berikut. Di luar tiga kondisi
itu, sesi satu task selesai tanpa Integrator.

| Kondisi | Integrator | Dasar |
|---|---|---|
| Sesi satu task, perubahan dikomit pada branch saat ini, reviewer PASS | **Tidak diperlukan**; Implementer commit | `.agents/WORKFLOW.md` §8 |
| Sesi satu task pada `task/<TASK-ID>`, reviewer PASS, lalu branch itu digabungkan ke branch tujuan | **Diperlukan** untuk merge branch tersebut | `ROADMAP.md` §5 Tier 4 |
| Dua atau lebih task digabungkan menjadi satu hasil | **Wajib** | `.agents/AGENTS.md` §2 dan `ROADMAP.md` §5 Tier 4 |
| Merge yang menyentuh area terlindungi atau konfigurasi deployment | **Wajib**, ditambah approval manusia | `.agents/RULES.md` §Human approval wajib |

Dengan model workspace yang berlaku sekarang (lihat `workspace-isolation.md`
§2), case kedua belum terjadi karena tidak ada task branch. Case pertama adalah
default. Case ketiga dan keempat adalah Integrate aktual.

### 4.2 Syarat masuk Integrator

Syarat ini berlaku hanya bila salah satu kondisi §4.1 terpenuhi.

| Syarat | Bukti yang harus ada |
|---|---|
| Review PASS | Checklist `.agents/WORKFLOW.md` §7 tertulis pada file task |
| Validation PASS | Ringkasan hasil perintah validasi pada file task |
| Acceptance criteria PASS | Seluruh checkbox acceptance terpenuhi |
| Human approval PASS bila diwajibkan | Field `**Approval:**` terisi dan mendahului perubahan |
| Commit bersih dan traceable | Branch atau hasil punya satu commit dengan task ID; `git diff --check` bersih |
| Tidak ada ekspansi scope | Daftar file yang berubah sama dengan `**Claimed files:**` |

Pemeriksaan 1 sampai 8 pada `validation-contract.md` tetap menjadi syarat task
`DONE` untuk semua task. Pemeriksaan itu bukan syarat Integrator semata: ia
berlaku pada Implementer juga, karena Implementer boleh commit pada sesi satu task.

### 4.3 Kewenangan Integrator

- Menggabungkan perubahan yang sudah memenuhi syarat §4.2 ke branch tujuan.
- Menolak integrasi dan mengembalikan task ke `REVIEW` atau `BLOCKED` dengan
  alasan tertulis.
- Menjalankan validasi ulang pada branch hasil gabungan.
- Menjaga build dan test tetap hijau (`ROADMAP.md` §5 Tier 4).

### 4.4 Larangan Integrator

- Mengambil alih pekerjaan implementer. Bug yang ditemukan Integrator
  dikembalikan ke Implementer; memperbaikinya sendiri berarti Integrator menjadi
  penulis perubahan yang sedang ia nilai.
- Menambah scope, menambah fitur, atau memperbaiki di luar `**Claimed files:**`.
- Memberikan approval atas perubahan yang ia buat sendiri.
- Menggabungkan perubahan ke area terlindungi tanpa approval manusia.
- Melakukan destructive operation tanpa approval manusia.
- Memaksa Integrator pada sesi satu task yang tidak membutuhkan integrasi. Itu
  menambah langkah tanpa dasar governance.

### 4.5 Hasil integrasi

Integrator menulis pada file task: commit SHA hasil gabungan, reviewer yang
memverifikasi, hasil validasi ulang, dan keputusan integrate atau tolak. Tanpa
catatan itu, integrasi dianggap belum terjadi.

## 5. Perbedaan single-task dan multi-task

| Aspek | Sesi satu task | Integrasi multi-task |
|---|---|---|
| Jumlah task | Satu | Dua atau lebih |
| Goal | Menyelesaikan satu objective | Menggabungkan beberapa perubahan yang sudah PASS |
| Siapa melakukan merge | Implementer bila commit langsung pada branch saat ini | Integrator |
| Pemeriksa | Reviewer, atau self-review untuk `DOC` dan `TEST` | Reviewer tiap task, lalu Integrator |
| Approval manusia | Sesuai kelas task dan area terlindungi | Sesuai kelas task, area terlindungi, dan tiap task yang digabungkan |
| Jejak audit | Satu commit dengan satu task ID | Satu commit hasil gabungan dengan semua task ID disebut |
| Kapan selesai | `DONE` setelah commit dan status task diperbarui | `DONE` per task setelah integrasi tercatat |

## 6. Yang tidak dikerjakan pada T003 dan T003-R1

T003 tidak menjalankan integrasi apa pun dan tidak membuat merge. `main` tidak
disentuh untuk purposes integrasi pada kedua task tersebut. Kontrak ini diuji
pada task integrasi pertama yang benar-benar membutuhkan Integrator.
