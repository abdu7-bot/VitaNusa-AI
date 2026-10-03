# T002 — Agent Governance Contract

**Priority:** P0
**Class:** `DOC`
**State:** DONE
**Dependency:** T001
**Owner:** autonomous agent
**Claimed at:** 2026-10-03T13:24:31Z
**Claimed files:** `.agents/AGENTS.md`, `.agents/RULES.md`, `.agents/WORKFLOW.md`, `.agents/ARCHITECTURE.md`, `scripts/check_agent_governance.py`, `AGENTS.md`, `ROADMAP.md`, `tasks/TODO.md`, `tasks/active/T002-agent-governance.md`

## Objective

Audit governance yang sudah ada dan finalisasi kontrak kerja untuk coding
factory VitaNusa-AI: workspace canonical, peran agent, alur kerja, task class,
stop condition, gate verifikasi, dan proteksi production code.

## Audit awal

Empat dokumen `.agents/` sudah ada dan isinya valid secara umum, tetapi
belum operasional pada empat hal:

1. Canonical workspace dan aturan read-only secondary copy tidak tertulis.
2. Peran agent belum dipisahkan tegas antara Planner, Implementer, dan Reviewer
   beserta kewenangan masing-masing.
3. Tidak ada klasifikasi task, tidak ada gate per kelas, dan tidak ada checklist
   reviewer yang dapat dijalankan.
4. Tidak ada mekanisme pemeriksaan bahwa kontrak governance masih utuh.

Bukti audit: `ROADMAP.md`, `tasks/TODO.md`, `tasks/BACKLOG.md`,
`docs/architecture/BASELINE.md`, `docs/hierarchy-system.md`,
`docs/vitanusa-master-architecture-2026.md`, `AGENTS.md`, `.agents/memory/`,
`.github/workflows/ci.yml`, dan `git log --oneline -15`.

## Scope

- `.agents/AGENTS.md`
- `.agents/RULES.md`
- `.agents/WORKFLOW.md`
- `.agents/ARCHITECTURE.md`
- `AGENTS.md` (root, pointer satu bagian)
- `ROADMAP.md` (satu label tier: Worker menjadi Implementer)
- `scripts/check_agent_governance.py` (baris)
- `tasks/TODO.md` (status T002)
- `tasks/active/T002-agent-governance.md` (file ini)

## Hasil perubahan

- `.agents/AGENTS.md` menjadi kontrak: canonical workspace `/root/VitaNusa-AI`,
  read-only secondary `/home/vita/VitaNusa-AI`, urutan sumber kebenaran, tabel
  peran Planner/Implementer/Reviewer, alur PLAN → IMPLEMENT → VALIDATE →
  REVIEW → COMMIT → DONE, syarat boleh coding, kelas task DOC/TEST/CODE/ADR,
  area terlindungi, tujuh stop condition, aturan anti-tabrakan, dan syarat DONE.
- `.agents/RULES.md` menambahkan aturan workspace, scope dan traceability,
  task class, proteksi production code, anti-tabrakan antar agent, serta
perapian pada bagian Git, Coding, dan Human approval yang sudah ada.
- `.agents/WORKFLOW.md` menambahkan state machine dengan kriteria masuk/keluar
  per state, format claim, tabel validasi per kelas task, checklist reviewer
  enam butir, aturan commit, dan batas loop autonomous.
- `.agents/ARCHITECTURE.md` menambahkan lapisan governance, peta artefak,
  tabel area terlindungi dengan path nyata, dan batas repository.
- `scripts/check_agent_governance.py` memeriksa keberadaan artefak governance,
  keberadaan butir kontrak, dan bentuk baris task pada `tasks/TODO.md` dan
  `tasks/BACKLOG.md`. Standar library saja, tanpa dependency baru.
- `AGENTS.md` root ditambah satu bagian yang menunjuk kontrak `.agents/` sebagai
  yang mengikat.

Informasi valid dari dokumen lama dipertahankan; tidak ada file yang dihapus.

## Safety

- Tidak ada production code yang diubah.
- Tidak ada perubahan behavior backend atau frontend.
- Tidak ada fitur aplikasi yang ditambahkan.
- Tidak ada dependency baru.
- `/home/vita/VitaNusa-AI` tidak diakses atau diubah.
- Tidak ada autonomous loop atau autopilot baru yang diaktifkan.

## Acceptance criteria

- [x] Audit governance yang sudah ada dilakukan dan tercatat di file ini.
- [x] Canonical workspace dan read-only secondary copy tertulis eksplisit.
- [x] Peran Planner, Implementer, Reviewer, dan Integrator terdefinisi.
- [x] Alur PLAN → IMPLEMENT → VALIDATE → REVIEW → COMMIT → DONE tertulis.
- [x] Syarat agent boleh coding dan syarat agent wajib berhenti tertulis.
- [x] Scope ditentukan oleh Planner dan setiap perubahan dapat ditelusuri ke task.
- [x] Perubahan Production code dilindungi secara eksplisit.
- [x] Task class DOC, TEST, CODE, dan ADR dibedakan beserta gate-nya.
- [x] Test hijau tidak boleh menjadi alasan memperluas scope.
- [x] Pencegahan dua agent pada scope yang sama tertulis beserta format claim.
- [x] Checklist reviewer memuat scope, correctness, regression, architecture
      consistency, documentation consistency, dan git diff.
- [x] `git status --short` dan `git diff --check` dijalankan dan bersih.
- [x] Validasi governance dijalankan: `python scripts/check_agent_governance.py`
      lulus, dan kasus negatif terdeteksi.
- [x] Validasi repository-safety yang relevan dijalankan:
      `python scripts/check_suspicious_unicode.py` lulus.
- [x] Tidak ada production code, dependency, atau behavior yang berubah.
- [x] Diff direview penuh sebelum commit.

## Hasil akhir

- `python scripts/check_agent_governance.py` lulus: 7 path governance ada,
  57 butir kontrak terdeklarasi.
- Kasus negatif diuji pada salinan sementara di luar repository: penghapusan
  butir reviewer dan baris task berbentuk salah keduanya terdeteksi.
- `python scripts/check_suspicious_unicode.py` lulus.
- `git diff --check` tidak melaporkan whitespace error.
- Tidak ada file yang dihapus.

## Review

Task ini kelas `DOC`, jadi implementer dan reviewer boleh sama
(`.agents/AGENTS.md` §2). Checklist `.agents/WORKFLOW.md` §7 dijalankan atas
seluruh diff:

1. **Scope** — PASS. Semua file yang berubah ada di `Claimed files`.
2. **Correctness** — PASS. Kesembilan butir pada instructions T002 ada di
   `.agents/AGENTS.md` §0, §2, §3, §4, §5, §6, §7, §8, §9 dan di
   `.agents/WORKFLOW.md` §1 sampai §7; pemeriksa `scripts/check_agent_governance.py`
   menguji keberadaan butir tersebut secara otomatis.
3. **Regression** — PASS untuk cakupan task. Tidak ada file backend, frontend,
   test, atau manifest yang disentuh, sehingga tidak ada jalur eksekusi aplikasi
   yang berubah. Test suite aplikasi tidak dijalankan karena tidak relevan untuk
   perubahan dokumentasi dan pemeriksa standalone; 결과 baseline tetap
   tercatat di `docs/architecture/BASELINE.md` §4 dan tidak diklaim ulang di sini.
4. **Architecture consistency** — PASS. Tidak ada perubahan pada
   `docs/vitanusa-master-architecture-2026.md`, `docs/hierarchy-system.md`,
   `backend/app/policies/`, atau `backend/app/policy_engine.py`. Urutan layer
   `.agents/ARCHITECTURE.md` tetap sama dengan sebelumnya. Satu label pada
   `ROADMAP.md` §5 Tier 2 diubah dari `Worker` menjadi `Implementer (worker)`
   agar istilah peran sama dengan `.agents/*`; isi tier tidak berubah.
5. **Documentation consistency** — PASS. `AGENTS.md` root diberi penunjuk ke
   kontrak `.agents/`; `tasks/TODO.md` diperbarui pada baris T002 saja; tidak
   ada baris queue lain yang diubah. Semua path yang dikutip di
   `.agents/ARCHITECTURE.md` §7 diverifikasi ada di checkout.
6. **Git diff** — PASS. `git diff` dan `git diff --check` dibaca penuh; tidak ada
   whitespace error, merge marker, secret, atau artefak. Trailing newline
   ditambahkan pada file yang sebelumnya tidak memilikinya.

## Follow-up di luar scope

- Integrasi `scripts/check_agent_governance.py` ke `.github/workflows/ci.yml`
  belum dilakukan karena deployment/CI config adalah area terlindungi. Perlu
  task terpisah dengan approval manusia.
- Task locking terotomasi tetap T003; versi T002 adalah protokol claim manual.
- Checkpoint/rollback otomatis tetap T004; audit log tetap T005.

## Catatan

Dokumen ini tetap berada di `tasks/active/` karena `.agents/WORKFLOW.md`
menetapkan lifecycle status tetapi tidak mewajibkan pemindahan file ke
`tasks/completed/`.
