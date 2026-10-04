# Workspace Isolation Model

Model ini memungkinkan beberapa agent bekerja secara paralel tanpa saling
menimpa perubahan. Model ini memakai Git karena canonical workspace sudah Git
(`git worktree list` dan `git branch --list` terverifikasi), dan karena
`.agents/RULES.md` §Git mengizinkan checkpoint serta melarang destructive
operation tanpa approval.

## Alur konseptual

```text
canonical repository (/root/VitaNusa-AI, branch main)
  ↓
isolated agent workspace (git worktree, branch task/<TASK-ID>)
  ↓
implementation di dalam workspace itu
  ↓
review
  ↓
validation
  ↓
integrator handoff
  ↓
human approval bila diwajibkan
  ↓
merge oleh Integrator
```

Urutan langkah di dalam folder ini mengikuti urutan repository pada
`.agents/WORKFLOW.md` §1: IMPLEMENT, VALIDATE, REVIEW, COMMIT. Lihat
`review-approval-integration.md` untuk pemetaannya ke pipeline konseptual.

## Lapisan dan aturan

| Lapisan | Definisi | Aturan |
|---|---|---|
| Canonical repository | `/root/VitaNusa-AI` pada branch `main`, satu-satunya lokasi yang boleh dibaca agent lain di luar workspace miliknya | Tidak boleh dipakai sebagai tempat kerja paralel. Hanya Integrator yang menulis ke `main` setelah gate lulus. |
| Agent workspace | Satu `git worktree` per agent yang mengerjakan task | Path di luar canonical hanya sah bila dicatat pada file task. `/home/vita/VitaNusa-AI` tetap read-only dan tidak boleh dipakai. |
| Task branch | `task/<TASK-ID>` yang dibuat dari `main` pada saat task dimulai | Satu task, satu branch. Nama branch memakai ID task yang ada di `tasks/`. |
| Integrator lane | Penyatuan beberapa branch task yang sudah PASS review | Dijalankan Integrator (`.agents/AGENTS.md` §2). Tidak boleh membuat perubahan baru di dalam lane ini. |

## Konvensi nama

| Objek | Format | Contoh |
|---|---|---|
| Branch task | `task/<TASK-ID>` | `task/T011` |
| Worktree agent | `<canonical-parent>/../<agent>-<TASK-ID>` | `/root/agent-copilot-T011` |
| Label audit | `task:<TASK-ID>` | `task:T011` |

Nama worktree adalah konvensi, bukan lokasi yang sudah ada. Belum ada worktree
agent yang dibuat pada T003.

## Aturan isolation yang wajib

1. Satu agent, satu task, satu branch. Dua agent tidak boleh menulis branch yang
   sama (`.agents/RULES.md` §Anti-tabrakan).
2. Claim dicatat pada file task **sebelum** workspace dan branch dibuat
   (`.agents/WORKFLOW.md` §4). Claim yang tidak tercatat bukan claim.
3. Branch dibuat dari `main` yang bersih. Condition `git status --short` dicatat
   sebelum dan sesudah pekerjaan (`.agents/RULES.md` §Git).
4. Perubahan hanya boleh menyentuh file pada `**Claimed files:**`. Perubahan di
   luar scope membatalkan commit, bukan sekadar diperbaiki.
5. Reviewer dan validator membaca branch task, bukan working tree reviewer.
   Reviewer tidak boleh mengedit branch yang sedang direview.
6. Merge hanya oleh Integrator, hanya dari branch yang review PASS, validation
   PASS, acceptance criteria PASS, dan approval yang diwajibkan sudah ada.
7. Tidak ada destructive operation: `git reset --hard`, `git clean -fd`,
   force-push, dan rewrite history tetap dilarang tanpa approval manusia
   (`.agents/RULES.md` §Git).
8. Canonical repository tidak pernah dipakai untuk bereksperimen. Perubahan di
   `main` tanpa gate adalah pelanggaran, bukan cara cepat.

## Bootstrap worker: sengaja ditunda

T003 **tidak** membuat worktree worker. Yang dilakukan T003 adalah kontrak di atas
agar bootstrap dapat dilakukan aman pada task berikutnya:

- banyak worktree dibuat bersamaan pada percobaan pertama, atau dengan
  path yang tidak tercatat pada file task;
- branch dibuat tanpa claim, sehingga dua agent bisa klaim file yang sama tanpa
  ada yang menyadarinya;
- jumlah worktree tumbuh tanpa batas karena tidak ada aturan lifecycle.

Aturan bootstrap yang harus dipakai task berikutnya:

1. Bootstrap satu worker pada satu waktu, dengan claim task yang sudah tercatat.
2. Catat path workspace, branch, dan owner pada file task sebelum file pertama
   disentuh.
3. Verifikasi `git worktree list` hanya berisi canonical dan workspace task itu
   sebelum pekerjaan dimulai.
4. Setelah task selesai atau `BLOCKED`, release claim dan hapus workspace sesuai
   `workspace-isolation.md` bagian release.
5. Jangan membuat worker yang tidak punya task. Workspace kosong adalah state
   yang tidak punya owner dan tidak boleh dibiarkan menggantung.

## Workspace lifecycle

| Urutan | Aksi | Pemeriksa yang boleh |
|---|---|---|
| 1 | Claim task tercatat | Implementer/Planner yang mengclaim |
| 2 | `git worktree add` dengan branch `task/<TASK-ID>` | Implementer |
| 3 | Verifikasi `git status --short` bersih dan `git worktree list` sesuai | Implementer |
| 4 | Implementasi pada workspace itu | Implementer |
| 5 | Review dan validation pada branch task | Reviewer, validator |
| 6 | Handoff ke Integrator dengan bukti gate | Implementer |
| 7 | Merge atau penolakan | Integrator |
| 8 | Release claim dan hapus workspace bila tidak dipakai lagi | Implementer atau Integrator |

Langkah 1 sampai 3 adalah batas T003 sebagai kontrak. Eksekusi aktualnya
adalah pekerjaan lanjutan, bukan bagian task ini.