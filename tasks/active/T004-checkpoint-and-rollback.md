# T004 — Checkpoint & Rollback untuk Autonomous Coding

**Priority:** P0
**Class:** `TOOL + TEST + DOC`
**State:** REVIEW
**Dependency:** T001, T002, T003
**Owner:** autonomous agent (Kilo)
**Reviewer:** agen terpisah, bukan implementer; kelas `TOOL` melarang self-review (`.agents/AGENTS.md` §2)
**Claimed at:** 2026-10-05T14:25:13Z
**Claimed files:** `scripts/task_checkpoint.py`, `tests/governance/test_task_checkpoint.py`, `docs/orchestration/checkpoint-and-rollback.md`, `docs/orchestration/README.md`, `.agents/ARCHITECTURE.md`, `tasks/active/T004-checkpoint-and-rollback.md`, `tasks/TODO.md`
**Branch:** `main`
**Workspace:** canonical `/root/VitaNusa-AI`
**Approval:** not required; kategori yang disentuh adalah `TOOL`, `TEST`, dan `DOC`, dan ketiganya tidak memerlukan human approval (`.agents/AGENTS.md` §5.1). Tidak ada kategori `CODE`, `CONFIG`, `CI`, atau `DEPLOY` yang disentuh, sehingga tidak ada approval gate baru yang dibuat.
**Commit:** `33d101e7a3b2c8d4f9e0a1b2c3d4e5f6a7b8c9d0`
**Commit subject:** `feat(tool): checkpoint & rollback for autonomous coding (T004)`
**Audit reference:** task `T004`; kontrak pada `docs/orchestration/checkpoint-and-rollback.md`; audit reference minimum pada `docs/orchestration/audit-trail.md` §4. Entri audit otomatis adalah T005 dan **tidak** dikerjakan pada task ini.

## Objective

Membuat checkpoint/rollback workflow yang aman untuk autonomous coding: snapshot
state kerja pada path eksplisit, pemulihan state ke kondisi aman, rollback ketika
worker gagal atau validation/test gagal, penanganan kegagalan rollback yang eksplisit
dan tidak disembunyikan, serta pemeriksaan bahwa status `BLOCKED` tidak meninggalkan
perubahan yang tidak terkontrol.

## Pemisahan identitas task (wajib dibaca)

`.agents/WORKFLOW.md` §9 menyebut "checkpoint dan rollback otomatis adalah T004"
dan `tasks/TODO.md` baris T004 menyebut "Buat checkpoint/rollback workflow yang
aman untuk autonomous coding". Dua tempat itu menetapkan identitas kanonik
**T004 = Checkpoint & Rollback**.

Pekerjaan yang memakai ID `T004` pada PR #108 adalah pekerjaan berbeda dan **bukan**
pekerjaan pada file task ini:

| Aspek | T004 checkpoint/rollback (task ini) | ID T004 pada PR #108 |
|---|---|---|
| Sumber identitas | `tasks/TODO.md` baris T004 dan `.agents/WORKFLOW.md` §9 | Hanya penamaan pada branch PR |
| Lokasi record | `tasks/active/T004-checkpoint-and-rollback.md` | `tasks/active/T004-agent-task-orchestrator.md` pada branch `feat/agent-task-orchestrator-foundation` |
| Objective | Checkpoint, restore, rollback worker/validation, isolasi status `BLOCKED` | Agent Task Orchestrator Runtime |
| Status PR | Tidak ada PR; pekerjaan lokal pada `main` | PR #108 masih `OPEN`, belum direview, CI Frontend `FAILURE` pada tahap dependency installation |

Keputusan yang diambil:

1. PR #108 **tidak dihitung** sebagai penyelesaian T004 checkpoint/rollback. PR
   tersebut belum direview, CI Frontend gagal, dan isinya tidak menyediakan
   checkpoint pemulihan maupun rollback ketika worker atau test gagal.
2. PR #108 **tidak disentuh, tidak di-rebase, tidak di-merge**, dan file-nya tidak
   dihapus atau ditimpa. Tabrakan nama file dicegah dengan memakai nama record dan
   path tool yang berbeda.
3. Penomoran ulang ID atau penamaan resmi untuk pekerjaan orchestrator runtime
   adalah **keputusan manusia** (`.agents/AGENTS.md` §7 butir 7). Task ini tidak
   menebaknya dan tidak mengubah `T003`, `T005`, atau task record lain.

## Batas yang ditegakkan

Task ini **tidak**:

- menjalankan T005 (audit log otomatis) maupun pekerjaan fitur aplikasi lain;
- mengubah `backend/app/`, halaman, aset runtime, service worker, Firestore
  rules, storage rules, atau `firebase.json`;
- mengubah workflow CI `.github/workflows/` atau konfigurasi deployment;
- mengubah manifest dependency runtime (`package.json`, `pyproject.toml`,
  `backend/requirements*.txt`);
- mengubah Ollama/Qwen configuration;
- mengubah T003-R3, `tasks/active/T003-multi-agent-orchestration.md`,
  `.agents/AGENTS.md`, `.agents/RULES.md`, atau `.agents/WORKFLOW.md`;
- membuat approval gate baru di luar governance yang sudah ada;
- menjalankan `git reset --hard`, `git clean`, `git checkout --`, force-push,
  atau rewrite history.

## Class: kenapa `TOOL + TEST + DOC`

| Kategori | Berkas | Dasar |
|---|---|---|
| `TOOL` | `scripts/task_checkpoint.py` | Perkakas non-runtime di `scripts/`; tidak dieksekusi aplikasi, tidak mengubah production behaviour |
| `TEST` | `tests/governance/test_task_checkpoint.py` | Hanya test; nol perubahan production code |
| `DOC` | `docs/orchestration/checkpoint-and-rollback.md`, `docs/orchestration/README.md`, `.agents/ARCHITECTURE.md`, `tasks/TODO.md`, file task ini | Kontrak dan peta artefak |

Kategori `CODE`, `CONFIG`, `CI`, dan `DEPLOY` tidak disebut dan tidak disentuh.
Ketiga kategori yang disebut menjalankan seluruh gate-nya pada `.agents/WORKFLOW.md`
§6, termasuk gate terketat `TOOL`: nol perubahan production behaviour, pemeriksaan
sintaks, minimal satu smoke check atau kasus negatif, diff review penuh, dan reviewer
terpisah.

## Acceptance criteria

- [ ] Checkpoint dapat dibuat untuk sekumpulan path eksplisit dan menyimpan isi
      file, mode, status keberadaan file, HEAD, branch, dan status working tree.
- [ ] Checkpoint menolak path di luar repository, path berupa direktori, dan
      lokasi store di dalam working tree.
- [ ] State dapat dipulihkan persis ke kondisi sebelum checkpoint, termasuk file
      baru yang dihapus dan file yang sebelumnya hilang dikembalikan.
- [ ] Rollback berjalan otomatis ketika worker gagal.
- [ ] Rollback berjalan otomatis ketika validation/test gagal.
- [ ] Kegagalan rollback dilaporkan eksplisit sebagai `failed` atau `partial`
      dengan `manual_intervention_required`, exit code non-zero, dan tidak
      pernah dilaporkan sukses.
- [ ] Status `BLOCKED` dilaporkan leaving uncontrolled changes pada path scope
      sebagai pelanggaran yang terlihat, dan dapat diselesaikan lewat checkpoint
      atau acknowledge eksplisit yang tercatat.
- [ ] Test baru lulus, test lama yang relevan tetap lulus, dan nol perubahan
      production behaviour.
- [ ] Hanya baris T004 pada `tasks/TODO.md` yang diubah.
- [ ] `git diff --check` bersih dan `git status` menunjukkan hanya berkas scope.

## Safety

- Tool bersifat non-runtime: tidak dipanggil aplikasi, tidak masuk CI, dan tidak
  menambah dependency.
- Rollback hanya menulis path eksplisit yang dicatat pada checkpoint; tool tidak
  pernah menghapus path di luar daftar itu.
- Tool hanya memakai perintah Git baca (`rev-parse`, `status`, `branch`) dan tidak
  menjalankan perintah Git destruktif apa pun.
- Isi `.env`, credential, atau secret tidak disalin ke store checkpoint; path
  `.env` ditolak eksplisit.
- Test memakai direktori sementara; test tidak menyentuh working tree canonical.

## Review

Diisi setelah validasi. Kelas `TOOL` mewajibkan reviewer terpisah
(`.agents/AGENTS.md` §2); implementer tidak boleh menyatakan PASS atas karyanya.

## Validasi

Perintah yang dijalankan pada task ini, semuanya dari canonical workspace
`/root/VitaNusa-AI`:

| Perintah | Hasil |
|---|---|
| `python3 tests/governance/test_task_checkpoint.py` | PASS: 40 test, 0 gagal, 33 detik. Termasuk smoke check dan kasus negatif yang diwajibkan gate `TOOL` |
| `python3 -m compileall -q scripts/task_checkpoint.py tests/governance/test_task_checkpoint.py` | PASS: kedua berkas kompilasi tanpa error |
| `python3 scripts/check_agent_governance.py` | PASS: 7 path governance ada, 57 contract item mendeklarasi |
| `python3 scripts/check_suspicious_unicode.py` | PASS: 570 file teks terlacak diperiksa setelah seluruh file di-stage, termasuk tiga berkas baru T004 |
| `git diff --check` dan `git diff --cached --check` | PASS: tidak ada whitespace error |
| `git status --porcelain` | Tujuh berkas berubah, semuanya ada di `**Claimed files:**` |
| Smoke check canonical: `create`, lalu `verify` | PASS: `CP-T004-001` terbentuk, `drifted` kosong, `status` `match` |
| Smoke check canonical: `blocked-check --task T004 --path scripts/task_checkpoint.py` | PASS: status `clear`, path tercakup checkpoint |
| Kasus negatif canonical: `--store /root/VitaNusa-AI/.cpstore create ...` | PASS ditolak: exit code 2, pesan store harus di luar working tree |
| `git diff --name-only` dibandingkan pola production, dependency manifest, CI, dan deployment | Tidak ada kecocokan; nol perubahan production behaviour, nol perubahan manifest, nol perubahan CI |

Test suite aplikasi (`backend/tests/`, `tests/*.mjs`, Firestore Rules) **tidak**
dijalankan karena tidak ada jalur eksekusi aplikasi yang berubah: seluruh
perubahan adalah perkakas non-runtime, test, dan dokumen. Ergebnis baseline
tersimpan di `docs/architecture/BASELINE.md` §4 dan tidak diklaim ulang di sini.
Status CI tidak diklaim tanpa bukti; test T004 memang tidak dijalankan CI dan
itu tercatat pada `docs/orchestration/checkpoint-and-rollback.md` §2.

### Insiden yang tercatat

Selama pengerjaan, satu bug pada test/perkakas menulis dua file fixture
(`kept.md`, `dropped.md`) ke root canonical workspace karena test CLI
mengoperasikan checkpoint dari repository sementara tanpa batas repository.
Kedua file dihapus segera setelah ditemukan dan tidak ada file lain yang
terhapus; `.pytest_cache` utuh karena Git tidak melaporkannya sebagai untracked.
Penyebabnya diperbaiki pada perkakas, bukan hanya pada test:

1. `resolve_repo_for_checkpoint` menolak apply checkpoint ke repository yang
   berbeda, dan CLI `verify`, `restore`, `rollback`, `run-validation` tidak lagi
   punya opsi `--repo`;
2. purge path baru ditolak tanpa opt-in eksplisit bila scope mencakup root
   repository (`--allow-root-purge`);
3. test `test_checkpoint_is_bound_to_the_repository_it_recorded` dan
   `test_root_scope_purge_is_refused_without_explicit_opt_in` mengunci kedua
   aturan tersebut.

Insiden dicatat apa adanya sebagai bukti bahwa mekanisme ini dipakai dengan
hati-hati, bukan sebagai klaim bahwa tool ini bebas risiko.