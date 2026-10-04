# Review Pipeline, Human Approval, dan Integrator Contract

Bagian ini menetapkan urutan pipeline, gate approval manusia, dan syarat masuk
Integrator. Isinya memperketat aturan T002-R1, tidak melonggarkannya.

## 1. Pipeline

```text
IMPLEMENTER
  ↓
VALIDATION
  ↓
INDEPENDENT REVIEWER
  ↓
INTEGRATOR HANDOFF
  ↓
HUMAN APPROVAL BILA DIWAKITKAN
  ↓
MERGE
```

Urutan di atas mengikuti repository, bukan urutan generik. `.agents/WORKFLOW.md`
§1 memetakan `IMPLEMENT` ke `ACTIVE`, `VALIDATE` ke `TESTING`, `REVIEW` ke
`REVIEW`, dan `COMMIT` ke `DONE`. Pipeline konseptual yang menyebut reviewer
sebelum validation dipetakan ke state yang sama; tidak ada stage yang dihapus
dan tidak ada state baru.

## 2. Stage dan syaratnya

| Stage | Syarat masuk | Syarat keluar | Siapa yang melakukan |
|---|---|---|---|
| IMPLEMENTER | Claim tercatat, scope eksplisit, kelas task jelas, approval tertulis bila diwajibkan | Diff hanya pada scope; kategori sesuai `**Class:**` | Implementer |
| VALIDATION | Diff lengkap pada branch task | Semua perintah validasi pada `.agents/WORKFLOW.md` §6 lulus dan tercatat | Implementer atau Reviewer |
| INDEPENDENT REVIEWER | Validation PASS | Checklist `.agents/WORKFLOW.md` §7 PASS dan tercatat | Reviewer terpisah, atau self-review untuk `DOC` dan `TEST` |
| INTEGRATOR HANDOFF | Review PASS | Bukti gate terkumpul dan handoff dicatat | Implementer |
| HUMAN APPROVAL | Handoff lengkap | Approval tercatat pada file task bila diwajibkan | Manusia |
| MERGE | Semua gate di atas PASS | Satu commit dengan task ID pada `main`, status task diperbarui | Integrator |

Aturan yang tidak bisa dilanggar:

1. Implementer tidak boleh menjadi satu-satunya penilai perubahan yang ia buat
   untuk kelas `TOOL`, `CONFIG`, `CI`, `CODE`, dan `ADR`. Ia boleh menjalankan
   validasi, tetapi penentu PASS adalah Reviewer.
2. Tidak ada jalur `agent → implement → langsung merge`. Merge selalu melalui
   Integrator dengan gate yang tercatat.
3. Validation yang gagal dengan penyebab yang belum dipahami adalah stop
   condition (`TESTING → FAILED`), bukan alasan untuk melanjutkan
   (`.agents/AGENTS.md` §7).
4. Review yang tidak ditelusuri ke task berarti `BLOCKED`, bukan `PASS`.

## 3. Human approval gate

Aturan T002-R1 dipertahankan apa adanya. Ringkasnya:

1. Setiap perubahan production code memerlukan tiga syarat sekaligus: scope
   eksplisit, human approval tertulis **sebelum** perubahan dibuat, dan
   traceability (`.agents/AGENTS.md` §5.1).
2. Approval juga diwajibkan untuk workflow CI, konfigurasi deployment, dan
   manifest dependency runtime (`.agents/RULES.md` §Human approval wajib).
3. Approval dicatat pada file task sebelum file pertama disentuh. Approval yang
   tidak tercatat dianggap tidak ada.
4. Approval lisan, asumsi, "kayaknya tidak berisiko", atau persetujuan lisan
   setelah review bukan approval.

Ada dua titik approval yang berbeda dan keduanya dapat berlaku:

| Titik | Waktu | Pemicu |
|---|---|---|
| Approval pra-perubahan | Sebelum file pertama disentuh | Perubahan production code, CI, deployment, atau dependency manifest |
| Approval integrasi | Sebelum merge | Area terlindungi yang diubah, atau task dengan `DEPLOY` |

Keduanya direkam pada file task dengan field `**Approval:**`.

## 4. Kontrak Integrator

### 4.1 Syarat masuk Integrator

| Syarat | Bukti yang harus ada |
|---|---|
| Review PASS | Checklist `.agents/WORKFLOW.md` §7 tertulis pada file task |
| Validation PASS | Ringkasan hasil perintah validasi pada file task |
| Acceptance criteria PASS | Seluruh checkbox acceptance terpenuhi |
| Human approval PASS bila diwajibkan | Field `**Approval:**` terisi dan mendahului perubahan |
| Commit bersih dan traceable | Branch task punya satu commit dengan task ID; `git diff --check` bersih |
| Tidak ada ekspansi scope | Daftar file yang berubah sama dengan `**Claimed files:**` |

### 4.2 Kewenangan Integrator

- Menggabungkan perubahan yang sudah memenuhi syarat 4.1 ke branch tujuan.
- Menolak integrasi dan mengembalikan task ke `REVIEW` atau `BLOCKED` dengan
  alasan tertulis.
- Menjalankan validasi ulang pada branch hasil gabungan.
- Menjaga build dan test tetap hijau (`ROADMAP.md` §5 Tier 4).

### 4.3 Larangan Integrator

- Mengambil alih pekerjaan implementer. Bug yang ditemukan Integrator dikembalikan ke Implementer; memperbaikinya sendiri berarti Integrator menjadi penulis
  perubahan yang sedang ia nilai.
- Menambah scope, menambah fitur, atau memperbaiki di luar `**Claimed files:**`.
- Memberikan approval atas perubahan yang ia buat sendiri.
- Menggabungkan perubahan ke area terlindungi tanpa approval manusia.
- Melakukan destructive operation tanpa approval manusia.

### 4.4 Hasil integrasi

Integrator menulis pada file task: commit SHA hasil gabungan, reviewer yang
memverifikasi, hasil validasi ulang, dan keputusan integrate atau tolak. Tanpa
catatan itu, integrasi dianggap belum terjadi.

## 5. Yang tidak dikerjakan pada T003

T003 tidak menjalankan integrasi apa pun dan tidak membuat merge. Branch `main`
tidak disentuh pada T003. Kontrak ini diuji pada task integrasi pertama
selesai.
