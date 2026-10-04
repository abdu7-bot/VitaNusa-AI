# Workspace Isolation Model

Dokumen ini merekonsiliasi model workspace dengan governance yang berlaku. Pada
revisi T003-R1, governance `.agents/` tidak diubah; dokumen ini disesuaikan dengan
governance itu dan rancangan yang belum diotorisasi ditandai secara eksplisit.

## 1. Konflik yang ditemukan

| Sumber | Isi |
|---|---|
| `.agents/AGENTS.md` §0 | Canonical workspace adalah satu-satunya tempat agent boleh membaca dan menulis; agent wajib BERHENTI bila pekerjaan dilakukan di checkout lain |
| `AGENTS.md` root §Workflow butir 3 | "Gunakan branch/worktree bersih" |
| `docs/orchestration/workspace-isolation.md` versi T003 awal | Menjelaskan isolated agent workspace berbasis `git worktree` sebagai model aktif |

Dua sumber pertama tidak pernah direkonsiliasi pada T003 awal, sehingga dokumen
orchestration menyebut model itu berjalan tanpa dasar governance.

## 2. Keputusan T003-R1

Governance tidak diubah oleh task ini. Governance itu yang berlaku, dan worktree
di luar canonical **tidak diotorisasi**:

1. Canonical repository `/root/VitaNusa-AI` tetap sumber kebenaran dan satu-satunya
   lokasi baca/tulis agent (`.agents/AGENTS.md` §0).
2. Execution workspace yang sah saat ini adalah canonical workspace itu sendiri.
3. Isolated worktree adalah rancangan target, bukan model aktif. Rancangan itu
   hanya sah setelah ada task governance kelas `ADR` dengan approval manusia yang
   tercatat (lihat §5).
4. Pembacaan atas konflik §1 bukan solusi final. `.agents/AGENTS.md` §1
   memerintahkan agent escalate konflik, bukan menebaknya.
   Task ini memilih pembacaan paling aman sambil mengescalasi konflik tersebut ke
   manusia; keputusan akhir tetap milik manusia.

## 3. Model aktif sekarang: single workspace

```text
canonical workspace (/root/VitaNusa-AI, branch saat ini)
  ↓
IMPLEMENT pada file dalam scope
  ↓
VALIDATE
  ↓
REVIEW
  ↓
INTEGRATOR HANDOFF bila Integrator diperlukan
  ↓
HUMAN APPROVAL bila diwajibkan
  ↓
COMMIT oleh Implementer setelah reviewer PASS
  Urutan ini persis urutan repository pada `.agents/WORKFLOW.md` §1 dan §2.
  Lihat `review-approval-integration.md`.
```

Aturan yang berlaku sekarang:

1. Semua agent bekerja di canonical workspace. Tidak ada agent yang bekerja di
   checkout, salinan, atau worktree lain (`.agents/AGENTS.md` §0).
2. `/home/vita/VitaNusa-AI` tetap read-only dan tidak boleh dipakai sebagai
   execution workspace.
3. Claim dicatat pada file task sebelum file pertama disentuh; claim adalah satu
   satu-satunya pagar anti-tabrakan yang berjalan saat ini.
4. Pembuatan branch di dalam canonical workspace tidak melanggar §0 karena lokasi
   tidak berubah, tetapi governance tidak mewajibkannya dan instruksi task
   tertentu dapat melarangnya. Branch dipakai hanya bila task record
   menyatakannya.
5. Commit pada branch saat ini dilakukan oleh Implementer setelah reviewer PASS
   (`.agents/WORKFLOW.md` §8). Integrator tidak menjadi syarat tambahan untuk
   sesi satu task; lihat `review-approval-integration.md` §4.
6. Destructive operation tetap dilarang tanpa approval manusia.

## 4. Rancangan target: isolated worktree

Bagian ini **design, bukan aturan yang sedang berlaku**. Tujuh hal yang diminta
dijawab lengkap supaya task governance berikutnya punya desain siap pakai.

| Pertanyaan | Rancangan |
|---|---|
| Canonical tetap sumber kebenaran? | Ya. Merge, `main`, dan status task ada di canonical; worktree hanya tempat mengerjakan diff |
| Worktree resmi untuk apa? | Menjalankan implementasi task tanpa disturbing workspace agent lain |
| Siapa yang boleh membuatnya? | Implementer yang sudah mencatat claim pada file task. Planner menentukan kebutuhan, tidak membuat worktree |
| Bagaimana claim dicatat sebelum worktree dibuat? | `**Claimed files:**`, `**Owner:**`, `**Claimed at:**`, dan `**Workspace:**` terisi di file task lebih dulu; barulah `git worktree add` dijalankan |
| Bagaimana branch diidentifikasi? | `task/<TASK-ID>`, satu task satu branch, dibuat dari `main` yang bersih |
| Bagaimana hasilnya kembali ke canonical? | Commit pada branch task, lalu Integrator melakukan merge ke branch tujuan setelah gate terpenuhi |
| Kapan workspace dilepas? | Setelah task `DONE` atau `BLOCKED`, claim dicatat penutupannya dan worktree dihapus; worktree tanpa task tidak boleh dibiarkan |
| Bagaimana dua agent tidak memakai task yang sama? | Satu owner per task dan satu agent per file (`.agents/RULES.md`), claim tercatat sebelum worktree dibuat, dan verifikasi `git worktree list` sebelum mulai |

## 5. Gate yang harus dilalui sebelum worktree boleh dipakai

Worktree adalah perubahan aturan workspace, bukan detail teknis. Syaratnya
menurut urutan berikut:

1. Task governance baru dengan class `ADR`.
2. Approval manusia tertulis yang tercatat pada file task.
3. Perubahan eksplisit pada `.agents/AGENTS.md` §0 dan §1 sehingga canonical
   workspace dan agent workspace dibedakan secara eksplisit, dan Konflik dengan
   `AGENTS.md` root §Workflow butir 3 ikut diselesaikan di teks yang sama.
4. Rujukan dari `.agents/WORKFLOW.md` §3 dan §4 ke aturan workspace yang baru.
5. Pemeriksaan bahwa `/home/vita/VitaNusa-AI` tetap read-only dan tidak pernah
   dipakai sebagai execution workspace.

Sebelum lima hal itu terpenuhi, agent yang membuat worktree di luar canonical
melanggar `.agents/AGENTS.md` §0 dan wajib BERHENTI serta melaporkan.

## 6. Aturan yang berlaku sekarang tentang worktree

1. Tidak ada worktree agent yang dibuat pada T003 maupun T003-R1.
2. `git worktree list` hanya berisi canonical repository; keadaan itu harus
   direkam pada file task saat claim diambil.
3. Bootstrap worker massal dilarang. Bootstrap
   worker adalah pekerjaan terpisah dengan scope dan approval sendiri.
4. Agent yang membutuhkan paralelisme sebelum gate §5 terpenuhi memakai
   mekanisme lain: penjadwalan task berurutan dengan claim manual, bukan worktree.

## 7. Yang tidak dikerjakan pada T003 dan T003-R1

- Tidak ada worktree yang dibuat.
- Tidak ada branch baru yang dibuat.
- Tidak ada bootstrap worker.
- Tidak ada perubahan pada `.agents/AGENTS.md` atau `.agents/RULES.md`.
