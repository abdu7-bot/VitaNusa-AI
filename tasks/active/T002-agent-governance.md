# T002 — Agent Governance Contract

**Priority:** P0
**Class:** `DOC` + `TOOL`
**State:** DONE (revisi T002-R1: DONE)
**Dependency:** T001
**Owner:** autonomous agent
**Claimed at:** 2026-10-03T13:24:31Z
**Claimed files:** `.agents/AGENTS.md`, `.agents/RULES.md`, `.agents/WORKFLOW.md`, `.agents/ARCHITECTURE.md`, `scripts/check_agent_governance.py`, `AGENTS.md`, `ROADMAP.md`, `tasks/TODO.md`, `tasks/active/T002-agent-governance.md`
**Approval:** not required for `DOC`; `TOOL` sudah ada dalam scope yang diklaim dan direview reviewer independen pada 2026-10-04.
**Commit:** `c11bf38` (bagian T002 awal); revisi T002-R1 dicatat pada bagian Remediasi T002-R1.

Catatan kelas: task ini `DOC` + `TOOL` karena diff T002 awal menambahkan
`scripts/check_agent_governance.py`, yaitu tooling repository non-runtime, bukan
dokumen saja. Revisi T002-R1 hanya mengubah dokumen dan tidak menyentuh
`scripts/check_agent_governance.py`, sehingga revisi tersebut sendiri `DOC`.

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
4. Tidak ada pemeriksaan berkala atas kontrak governance. Pemeriksa yang
   ditambahkan pada task ini hanya anchor guard, bukan validator semantik atau
   sumber otoritatif.

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
- `scripts/check_agent_governance.py` adalah anchor guard dan smoke guard.
  Yang diperiksa: keberadaan path governance, keberadaan string anchor tertentu,
  dan bentuk baris task pada `tasks/TODO.md` dan `tasks/BACKLOG.md`. Yang tidak
  diperiksa: makna dan konsistensi antardokumen, kepatuhan agent, dan cakupan
  anchor untuk tabel peran serta kelas task. Standar library saja, tanpa
  dependency baru, dan tidak dijalankan di CI.
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
- [x] Task class dibedakan beserta gate-nya. Kelas dan kategorinya diperbarui
      pada revisi T002-R1 menjadi DOC, TEST, TOOL, CONFIG, CI, DEPLOY, CODE, dan
      ADR; task ini dikoreksi menjadi `DOC` + `TOOL`.
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
- Pemeriksa hanya memberi bukti keberadaan anchor dan path. Ia tidak
  memvalidasi makna atau konsistensi antardokumen.

## Review

Koreksi T002-R1: task ini kelas `DOC` + `TOOL`. Aturan self-review berlaku untuk
`DOC` dan `TEST` saja (`.agents/AGENTS.md` §2), sehingga bagian `TOOL` wajib
direview orang atau agen lain. Review independen terhadap bagian `TOOL` dilakukan
Copilot pada 2026-10-04 dan menghasilkan temuan R1 sampai R5 yang dikerjakan pada
revisi T002-R1. Checklist `.agents/WORKFLOW.md` §7 dijalankan atas seluruh diff:

1. **Scope** — PASS. Semua file yang berubah ada di `Claimed files`.
2. **Correctness** — PASS. Kesembilan butir pada instructions T002 ada di
   `.agents/AGENTS.md` §0, §2, §3, §4, §5, §6, §7, §8, §9 dan di
   `.agents/WORKFLOW.md` §1 sampai §7; anchor guard
   `scripts/check_agent_governance.py` menguji keberadaan butir tersebut secara
   otomatis, tanpa memvalidasi maknanya.
3. **Regression** — PASS untuk cakupan task. Tidak ada file backend, frontend,
   test, atau manifest yang disentuh, sehingga tidak ada jalur eksekusi aplikasi
   yang berubah. Test suite aplikasi tidak dijalankan karena tidak relevan untuk
   perubahan dokumentasi dan anchor guard standalone; 결과 baseline tetap
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
  belum dilakukan karena workflow CI adalah area terlindungi dan task `CI`
  memerlukan approval manusia tertulis. Perlu task terpisah.
- Perluasan cakupan anchor guard pada tabel peran dan kelas task juga pekerjaan
  terpisah: ia mengubah `scripts/check_agent_governance.py`, yaitu kategori
  `TOOL`, dan tidak dikerjakan dalam revisi ini.
- Task locking terotomasi tetap T003; versi T002 adalah protokol claim manual.
- Checkpoint/rollback otomatis tetap T004; audit log tetap T005.

## Remediasi T002-R1

**Class:** `DOC`
**Trigger:** review independen terhadap T002 (Copilot, 2026-10-04) dengan temuan R1-R5.
**Approval:** instruksi manusia tanggal 2026-10-04 untuk menyelesaikan T002-R1 pada repository aktif, tanpa branch change dan tanpa worktree baru.
**Scope:** `.agents/AGENTS.md`, `.agents/RULES.md`, `.agents/WORKFLOW.md`, `.agents/ARCHITECTURE.md`, `AGENTS.md`, `ROADMAP.md`, `tasks/TODO.md`, `tasks/active/T002-agent-governance.md`.
**Tidak diubah:** `scripts/check_agent_governance.py`, seluruh production code, konfigurasi, workflow CI, dan konfigurasi deployment. Karena tidak ada file production code, configuration, CI, atau deployment yang disentuh, approval production-code tidak diperlukan pada revisi ini.

### Temuan dan keputusan

| Temuan | Masalah yang ditemukan | Keputusan remediasi |
|---|---|---|
| R1 | Syarat perubahan production code hanya tersirat sebagai approval untuk area terlindungi; kategori production code, documentation, test, tooling, configuration, deployment, dan CI tidak dibedakan. | `.agents/AGENTS.md` §5 membedakan `DOC`, `TEST`, `TOOL`, `CONFIG`, `CI`, `DEPLOY`, `CODE`, dan `ADR` beserta gate-nya; §5.1 menyatakan tiga syarat perubahan production code; §5.2 menyatakan syarat per kategori. `.agents/RULES.md` mencerminkannya pada Scope dan traceability, Task class, Production code, dan Human approval wajib. |
| R2 | Definisi Integrator di `.agents/AGENTS.md` §2 bertentangan dengan `ROADMAP.md` §5 Tier 4. | Integrator menjadi peran keempat tersendiri sesuai Tier 4, bukan sinonim Planner. Tanggung jawab dan larangannya ditulis eksplisit; commit sesi satu task tetap oleh Implementer setelah reviewer PASS. Istilah peran pada dokumen lain dipetakan di `.agents/ARCHITECTURE.md` §6.1 dan `ROADMAP.md` Tier 4 diberi rujukan. |
| R3 | T002 diklaim `DOC` padahal diff-nya menambahkan Python tooling. | Kelas task dikoreksi menjadi `DOC` + `TOOL`; aturan deklarasi multi-kategori ditambahkan; perluasan validator dipisah sebagai pekerjaan terpisah dan tidak dikerjakan di sini. |
| R4 | `scripts/check_agent_governance.py` dipописikan sebagai pemeriksaan kontrak governance yang utuh. | Diposisikan sebagai anchor guard dan smoke guard dengan batas eksplisit di `.agents/ARCHITECTURE.md` §3.1, `.agents/RULES.md` Governance check, `.agents/WORKFLOW.md` §6, dan file ini. |
| R5 | Dokumen governance saling bertentangan pada role, approval, area terlindungi, kelas task, validator, workflow, dan traceability. | Audit dan resolusinya ada di bagian berikutnya. Kontradiksi yang tidak boleh diubah di dalam scope dicatat sebagai follow-up. |

### Audit kontradiksi R5

Kontradiksi yang diselesaikan:

1. **Role.** `.agents/AGENTS.md` §2 menyebut tiga peran wajib dan menyatakan Integrator adalah peran Planner, sedangkan `ROADMAP.md` §5 Tier 4 dan `.agents/ARCHITECTURE.md` §2 menempatkan Integrator sebagai lapisan tersendiri. Diperbaiki menjadi empat peran.
2. **Role di dokumen lain.** `AGENTS.md` root dan `.agents/ARCHITECTURE.md` §6 hanya menyebut tiga peran. Keduanya diperbarui, ditambah tabel pemetaan istilah pada `.agents/ARCHITECTURE.md` §6.1.
3. **Approval.** `AGENTS.md` root menyatakan area terlindungi cukup diubah bila ada scope, tanpa approval manusia. Diperbaiki menjadi scope eksplisit per file dan approval manusia tertulis.
4. **Area terlindungi.** `backend/app/`, workflow CI, dan manifest dependency tercantum sebagai terlindungi pada `.agents/ARCHITECTURE.md` §7 tetapi tidak pada `.agents/AGENTS.md` §6 maupun `.agents/RULES.md`. Ketiga daftar diselaraskan.
5. **Approval production code.** Approval hanya tersirat untuk area terlindungi. Tiga syarat R1 ditegaskan eksplisit; `CONFIG`, `CI`, dan `DEPLOY` sekarang memerlukan approval manusia tertulis.
6. **Kelas task.** Hanya ada `DOC`, `TEST`, `CODE`, dan `ADR`, padahal area terlindungi sudah memuat config, CI, dan deployment. Taksonomi diperluas tanpa menghapus kelas lama.
7. **Kelas task pada task ini.** T002 menyatakan `DOC` tetapi menambahkan tooling; aturan self-review dipersempit sehingga `TOOL` memerlukan reviewer terpisah.
8. **Workflow.** `.agents/WORKFLOW.md` tidak memiliki tahap Integrator dan format claim tidak memuat `Class` maupun `Approval`. §1, §3, §4, dan §8 diperbarui.
9. **Workflow autonomous loop.** Batas satu task per sesi ditulis seolah-olah steady state. Sekarang dinyatakan sebagai deviasi terdokumentasi dari `ROADMAP.md` §15, tertaut T003-T005.
10. **Validator.** Deskripsi anchor guard sebelumnya menyiratkan validasi semantik dan tidak menyebut status CI. Sekarang batas dan status CI dinyatakan eksplisit.
11. **Traceability.** `.agents/RULES.md` mensyaratkan traceability ke task ID tetapi tidak mewajibkan pencatatan kelas task, perintah validasi, hasil, dan nomor commit. `.agents/AGENTS.md` §9 dan `.agents/RULES.md` sekarang mewajibkannya.

Temuan sisa yang tidak diubah pada revisi ini:

- `docs/vitanusa-master-architecture-2026.md` §10 masih memakai istilah MANAGER, PLANNER, CODER, TESTER, REVIEWER. Resolusi saat ini adalah tabel pemetaan pada `.agents/ARCHITECTURE.md` §6.1; mengubah dokumen master tersebut memerlukan task terpisah dengan approval manusia.
- `tasks/active/T001-repository-baseline.md` tidak punya field `**Class:**` meskipun `.agents/AGENTS.md` §5 mewajibkannya. Perbaikannya berarti mengedit task record lain, jadi dicatat sebagai follow-up.
- Anchor guard belum mengawasi tabel peran dan kelas task yang baru. Perluasan skrip adalah kategori `TOOL` dan tidak dikerjakan di sini.
- Batas autonomous loop tetap T003-T005; tidak ada pekerjaan T003 yang dimulai di sini.

### Checklist review T002-R1

Kelas `DOC`, jadi self-review diperbolehkan (`.agents/AGENTS.md` §2). Checklist `.agents/WORKFLOW.md` §7:

1. **Scope** — PASS. Semua file yang berubah ada dalam `Claimed files` T002. `scripts/check_agent_governance.py` sengaja tidak disentuh.
2. **Correctness** — PASS untuk R1-R5. R1 terlihat pada `.agents/AGENTS.md` §5.1 dan §5.2 serta `.agents/RULES.md`; R2 pada `.agents/AGENTS.md` §2 dan `.agents/ARCHITECTURE.md` §6; R3 pada header file ini dan aturan multi-kategori; R4 pada `.agents/ARCHITECTURE.md` §3.1, `.agents/RULES.md`, `.agents/WORKFLOW.md` §6, dan file ini; R5 pada tabel audit di atas.
3. **Regression** — PASS. Tidak ada file production code, test, manifest, konfigurasi, workflow CI, atau konfigurasi deployment yang berubah, sehingga tidak ada jalur eksekusi aplikasi yang berubah. Test suite aplikasi tidak dijalankan karena tidak relevan untuk perubahan dokumentasi; hasil baseline tetap tercatat di `docs/architecture/BASELINE.md` §4 dan tidak diklaim ulang di sini.
4. **Architecture consistency** — PASS. `docs/vitanusa-master-architecture-2026.md`, `docs/hierarchy-system.md`, `backend/app/policies/`, dan `backend/app/policy_engine.py` tidak diubah. Tabel pemetaan istilah di `.agents/ARCHITECTURE.md` §6.1 menjaga perbedaan nama tetap terlihat tanpa mengubah dokumen master.
5. **Documentation consistency** — PASS. Klaim validator dikoreksi di `.agents/ARCHITECTURE.md` §3.1, `.agents/RULES.md`, `.agents/WORKFLOW.md` §6, `tasks/TODO.md`, dan file ini. Daftar area terlindungi diselaraskan pada `AGENTS.md` root, `.agents/AGENTS.md` §6, `.agents/RULES.md`, dan `.agents/ARCHITECTURE.md` §7.
6. **Git diff** — PASS. `git diff` dan `git diff --check` dibaca penuh; tidak ada whitespace error, merge marker, secret, atau artefak yang tidak disengaja.

### Validasi T002-R1

Perintah yang dijalankan pada revisi ini:

| Perintah | Hasil |
|---|---|
| `python scripts/check_agent_governance.py` | PASS: 7 path governance ada, 57 contract item mendeklarasi |
| `python scripts/check_suspicious_unicode.py` | PASS: 558 file teks terlacak diperiksa |
| `git diff --check` | PASS: tidak ada whitespace error |
| `git status --short` | Hanya delapan file dokumentasi yang berubah |
| `git diff --name-only` terhadap pola production, test, tooling, config, CI, dan deploy | Tidak ada kecocokan; nol perubahan production behavior |

Anchor guard tidak menguji tabel peran dan kelas task yang baru, sehingga
konsistensi dokumen diverifikasi lewat checklist review di atas, bukan lewat
output skrip.

## Catatan

Dokumen ini tetap berada di `tasks/active/` karena `.agents/WORKFLOW.md`
menetapkan lifecycle status tetapi tidak mewajibkan pemindahan file ke
`tasks/completed/`.
