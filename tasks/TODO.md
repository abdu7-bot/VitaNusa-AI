# VitaNusa-AI — TODO

Dokumen ini adalah antrean pekerjaan aktif yang menjadi sumber utama autonomous coding.

## Cara kerja

Agent wajib mengambil **satu task** pada satu waktu, mengikuti `.agents/WORKFLOW.md`, lalu memindahkan task melalui:

`READY → ACTIVE → TESTING → REVIEW → DONE`

Jika terblokir: `ACTIVE → BLOCKED`.

## P0 — Governance & Safety

- [ ] T001 Audit repository dan catat baseline struktur, test, dependency, dan runtime.
- [ ] T002 Validasi `.agents/AGENTS.md`, `.agents/RULES.md`, `.agents/WORKFLOW.md`, dan `.agents/ARCHITECTURE.md` terhadap kondisi repository.
- [ ] T003 Tetapkan mekanisme task locking agar dua agent tidak mengerjakan file/task yang sama.
- [ ] T004 Buat checkpoint/rollback workflow yang aman untuk autonomous coding.
- [ ] T005 Tambahkan audit log untuk setiap autonomous task.

## P1 — Task Orchestrator

- [ ] T010 Implementasikan task-state parser untuk `TODO.md`, `active/`, dan `BACKLOG.md`.
- [ ] T011 Implementasikan task dependency checking.
- [ ] T012 Implementasikan test gate sebelum task dinyatakan DONE.
- [ ] T013 Implementasikan failure/blocked handling.
- [ ] T014 Implementasikan stop condition untuk kegagalan berulang.

## P2 — Provider Router

- [ ] T020 Buat provider registry.
- [ ] T021 Buat health check provider.
- [ ] T022 Buat quota tracking.
- [ ] T023 Buat fallback/retry dengan backoff.
- [ ] T024 Buat circuit breaker.
- [ ] T025 Integrasikan Kilo sebagai provider utama/fallback.
- [ ] T026 Siapkan adapter Copilot, Codex, dan Agy tanpa menganggap quota gratis selalu tersedia.

## P3 — Knowledge Foundation

- [ ] T030 Audit pipeline ingestion yang sudah ada.
- [ ] T031 Tetapkan schema metadata sumber.
- [ ] T032 Implementasikan provenance per chunk.
- [ ] T033 Implementasikan deduplication.
- [ ] T034 Implementasikan structured chunking.
- [ ] T035 Implementasikan hybrid retrieval.

## P4 — Islamic Knowledge Layer

- [ ] T040 Audit sumber Al-Qur'an yang digunakan.
- [ ] T041 Implementasikan validasi teks Arab Al-Qur'an.
- [ ] T042 Pisahkan teks Arab dan terjemahan.
- [ ] T043 Audit metadata hadits: kitab, nomor, matan, sanad bila tersedia, dan status kualitas.
- [ ] T044 Implementasikan metadata tafsir dan sumber ulama.
- [ ] T045 Implementasikan pemisahan ijma', ikhtilaf, dan pendapat ulama.
- [ ] T046 Implementasikan conflict detection antar sumber.

## P5 — Arabic Verification

- [ ] T050 Unicode/script normalization.
- [ ] T051 Exact Arabic text verification.
- [ ] T052 Tokenization.
- [ ] T053 Lemma/root analysis.
- [ ] T054 Morphology/sharf verification.
- [ ] T055 Syntax/nahwu verification.
- [ ] T056 Arabic dictionary lookup.
- [ ] T057 Contextual semantic verification.
- [ ] T058 Confidence + provenance result.

## P6 — Answer Verification

- [ ] T060 Intent classification.
- [ ] T061 Evidence retrieval.
- [ ] T062 Claim-to-source mapping.
- [ ] T063 Citation-first answer generation.
- [ ] T064 Distinguish dalil, scholarly opinion, analysis, and inference.
- [ ] T065 Uncertainty handling.
- [ ] T066 Safety review before answer.

## P7 — Production

- [ ] T070 Unit/integration/API/security test coverage audit.
- [ ] T071 Arabic verification regression suite.
- [ ] T072 Citation/provenance regression suite.
- [ ] T073 Observability and health dashboard.
- [ ] T074 Backup and recovery test.
- [ ] T075 End-to-end autonomous smoke test.

## Autonomous completion rule

Agent **tidak boleh** menandai task DONE hanya karena kode berhasil ditulis. Minimal harus ada:

1. perubahan terukur;
2. test/lint/type-check relevan;
3. diff review;
4. tidak melanggar `.agents/RULES.md`;
5. hasil dicatat pada task/audit log.
