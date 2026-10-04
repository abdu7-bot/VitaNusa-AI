# T003 — Multi-Agent Workspace & Orchestration Foundation

Dokumen ini adalah indeks fondasi workspace dan orchestration multi-agent
VitaNusa-AI. Fondasi ini menerjemahkan kontrak `.agents/` menjadi model yang
konkret: isolation, registry, locking, assignment, review, approval, audit, dan
validation contract.

## Status

**FOUNDATION, bukan autonomous factory.** Yang ada di sini adalah kontrak,
skema data, dan prosedur yang dapat diaudit. Yang belum ada adalah automasi
bootstrap workspace, lock terotomasi, dan persistence audit. Batas itu disengaja:
`.agents/RULES.md` melarang membangun mekanisme berlapis sebelum kebutuhan nyata
terbukti, dan `.agents/WORKFLOW.md` §9 menahan loop multi-task sampai task
locking dan rollback tersedia.

## Dokumen

| Dokumen | Isi |
|---|---|
| `workspace-isolation.md` | Model canonical repository, agent workspace, task branch, dan merge |
| `task-registry-and-locking.md` | Struktur task registry, lifecycle, claim, lock, release, stale lock |
| `agent-assignment.md` | Pemetaan peran governance ke agent dan provider |
| `review-approval-integration.md` | Pipeline review, human approval gate, kontrak integrator |
| `validation-contract.md` | Kontrak validation dan pemetaannya per kelas task |
| `audit-trail.md` | Skema audit trail minimum dan keputusan storage |

## Sumber kebenaran

Urutan sumber kebenaran tetap seperti `.agents/AGENTS.md` §1. Dokumen di folder ini
**tidak** membuat aturan baru; dokumen ini merinci dan mengoperasionalkan aturan
yang sudah ada. Jika ada konflik antara dokumen di sini dan `.agents/`, yang
mengikat adalah `.agents/`, dan konflik itu harus dicatat sebagai temuan pada
file task, bukan diselesaikan dengan menebak.

| Pertanyaan | Sumber |
|---|---|
| Workspace canonical | `.agents/AGENTS.md` §0 |
| Peran dan kewenangan | `.agents/AGENTS.md` §2 |
| Syarat boleh coding | `.agents/AGENTS.md` §4 |
| Kelas task dan kategori perubahan | `.agents/AGENTS.md` §5 |
| Area terlindungi | `.agents/AGENTS.md` §6 |
| Stop condition | `.agents/AGENTS.md` §7 |
| Syarat DONE | `.agents/AGENTS.md` §9 |
| State machine dan gate | `.agents/WORKFLOW.md` §1 dan §2 |
| Claim dan anti-tabrakan | `.agents/WORKFLOW.md` §4 |
| Validasi minimum per kelas | `.agents/WORKFLOW.md` §6 |
| Checklist reviewer | `.agents/WORKFLOW.md` §7 |
| Mutlak: scope, traceability, approval | `.agents/RULES.md` |

## Batas T003

T003 **tidak**:

- mengubah production behavior, baik backend maupun frontend;
- menambah dependency runtime atau development;
- mengubah workflow CI;
- membuat worktree worker dalam jumlah banyak;
- mengerjakan checkpoint/rollback otomatis (T004) atau audit log otomatis (T005);
- menjalankan merge apa pun;
- membuat T003closed loop autonomous.

## Bukti kondisi repository saat T003

Fakta di bawah diperiksa pada canonical workspace `/root/VitaNusa-AI` dan dipakai
agar dokumen ini tidak berisi asumsi:

- `git worktree list` hanya menghasilkan satu worktree, yaitu canonical pada
  branch `main`. Belum ada agent workspace.
- `git branch --list` hanya menghasilkan `main`.
- `git version` 2.43.0, `python3` 3.12.3, `node` v22.23.1.
- Task record yang ada: `tasks/active/T001-repository-baseline.md` dan
  `tasks/active/T002-agent-governance.md`. Belum ada task record T003 sebelum
  task ini dibuat.
- `docs/architecture/BASELINE.md` §6 mencatat task locking sebagai MISSING pada
  implementasi yang diaudit, dan agent governance sebagai PARTIAL.

## Follow-up

Pekerjaan yang sengaja ditunda ada pada file task
`tasks/active/T003-multi-agent-orchestration.md` bagian Follow-up, bukan
disembunyikan di dokumen lain.