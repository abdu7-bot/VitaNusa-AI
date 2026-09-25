# VitaNusa-AI — MASTER ROADMAP

> Dokumen induk pengembangan VitaNusa-AI. Semua agent wajib membaca roadmap ini sebelum mengambil pekerjaan baru.

## 0. Prinsip Utama

VitaNusa-AI dibangun sebagai sistem AI yang **terverifikasi, modular, dapat diaudit, dan dapat bekerja secara mandiri berdasarkan roadmap**, bukan sebagai agent yang bebas mengubah sistem tanpa batas.

Prioritas prinsip:

1. **Amanah & auditability** — setiap perubahan kode dapat dilacak.
2. **Kebenaran sumber** — klaim penting harus memiliki sumber yang dapat diverifikasi.
3. **Pemisahan fakta, tafsir, pendapat, dan inferensi.**
4. **Islamic knowledge layer** — Al-Qur'an, hadits shahih, ijma' yang terdokumentasi, serta penjelasan ulama harus diperlakukan sebagai lapisan pengetahuan dengan status dan sumber yang jelas.
5. **Verifikasi bahasa Arab** — teks Arab, akar kata, morfologi, sintaksis, makna leksikal, dan konteks harus dapat diperiksa sebelum digunakan untuk menjelaskan ayat/hadits.
6. **Tidak mengarang dalil** — sistem harus menandai ketidakpastian dan menolak membuat referensi yang tidak ditemukan.
7. **Human-in-the-loop untuk perkara sensitif** — terutama fatwa, hukum, keamanan, tindakan berisiko, dan perubahan arsitektur besar.

---

# 1. Fondasi Repository

- [ ] ROADMAP.md
- [ ] `.agents/AGENTS.md`
- [ ] `.agents/ARCHITECTURE.md`
- [ ] `.agents/RULES.md`
- [ ] `.agents/WORKFLOW.md`
- [ ] `tasks/TODO.md`
- [ ] `tasks/BACKLOG.md`
- [ ] `tasks/active/`
- [ ] `tasks/completed/`
- [ ] `docs/architecture/`
- [ ] `docs/api/`
- [ ] `docs/database/`
- [ ] `docs/visual/`
- [ ] `prompts/nano-banana/MASTER_PROMPT.md`
- [ ] `prompts/nano-banana/CHARACTER.md`
- [ ] `prompts/nano-banana/ENVIRONMENT.md`
- [ ] `prompts/nano-banana/STYLE.md`

# 2. Core Architecture

- [ ] Tetapkan batas frontend/backend/agent/data layer.
- [ ] Tetapkan kontrak API.
- [ ] Tetapkan model data dan migration strategy.
- [ ] Tetapkan logging dan audit trail.
- [ ] Tetapkan configuration/secrets policy.
- [ ] Tetapkan test strategy.
- [ ] Tetapkan observability dan health checks.

# 3. VitaNusa Knowledge Engine

## 3.1 Knowledge ingestion

- [ ] Pipeline download/import sumber pengetahuan.
- [ ] Metadata sumber: judul, penulis/lembaga, tanggal, URL, versi, bahasa, status verifikasi.
- [ ] Deduplication.
- [ ] Normalisasi dokumen.
- [ ] Chunking berbasis struktur, bukan sekadar jumlah karakter.
- [ ] Citation/provenance untuk setiap potongan pengetahuan.

## 3.2 Islamic knowledge layer

- [ ] Al-Qur'an dengan teks Arab yang tervalidasi.
- [ ] Terjemahan sebagai data terpisah dari teks Arab.
- [ ] Tafsir dengan metadata ulama/karya/sumber.
- [ ] Hadits dengan kitab, nomor/rujukan, matan, sanad jika tersedia, dan status kualitas.
- [ ] Ijma' hanya dari sumber ulama/rujukan yang jelas; jangan menganggap kesepakatan hanya karena satu sumber menyatakan demikian.
- [ ] Pendapat ulama/mazhab disimpan sebagai pendapat yang dapat berbeda, bukan otomatis sebagai ijma'.
- [ ] Mekanisme konflik sumber dan perbedaan pendapat.

## 3.3 Arabic verification layer

Sebelum sistem menggunakan analisis bahasa Arab untuk menjelaskan ayat/hadits, jalankan verifikasi:

1. Unicode/script normalization.
2. Exact text verification.
3. Tokenization.
4. Lemma/root analysis bila tersedia.
5. Morphology/sharf.
6. Syntax/nahwu.
7. Lexical dictionary lookup.
8. Contextual meaning.
9. Cross-source comparison.
10. Confidence + provenance.

Hasil verifikasi harus dapat diaudit dan tidak boleh berubah menjadi klaim agama tanpa sumber.

# 4. Retrieval & Reasoning

- [ ] Hybrid search: lexical + semantic.
- [ ] Arabic-aware retrieval.
- [ ] Metadata filtering.
- [ ] Reranking.
- [ ] Citation-first answer generation.
- [ ] Claim-to-source mapping.
- [ ] Contradiction/conflict detection.
- [ ] Uncertainty handling.
- [ ] Answer policy berdasarkan jenis pertanyaan.

# 5. Agent System

Agent tidak boleh berjalan sebagai satu proses tanpa pagar.

## Tier 1 — Planner
- Membaca roadmap.
- Memecah pekerjaan menjadi task kecil.
- Tidak mengubah kode tanpa task.

## Tier 2 — Worker
- Mengerjakan satu task.
- Menjalankan test.
- Menghasilkan perubahan terukur.

## Tier 3 — Reviewer
- Memeriksa diff.
- Memeriksa test.
- Memeriksa security/rules.
- Menolak perubahan yang melanggar aturan.

## Tier 4 — Integrator
- Menggabungkan perubahan yang lolos.
- Menjaga build/test tetap hijau.

# 6. Autonomous Coding Orchestrator

Target konfigurasi model/agent:

### Auto / free fallback
- Kilo utama
- Kilo alternatif 1/2/3

### Gratisan harian
- Copilot 1/2/3/4

### Gratisan bulanan
- Codex 1/2/3/4
- Agy 1/2/3/4

Orchestrator harus memilih provider berdasarkan **availability, quota, error rate, capability, dan policy**, bukan berdasarkan asumsi bahwa semua provider selalu gratis atau selalu tersedia.

Fitur wajib:

- [ ] Provider registry.
- [ ] Health check.
- [ ] Quota tracking.
- [ ] Retry dengan backoff.
- [ ] Fallback berurutan.
- [ ] Circuit breaker.
- [ ] Task locking agar dua agent tidak mengedit file yang sama.
- [ ] Git checkpoint sebelum pekerjaan berisiko.
- [ ] Test gate setelah perubahan.
- [ ] Rollback.
- [ ] Audit log.
- [ ] Stop condition jika agent berulang kali gagal.
- [ ] Human approval untuk perubahan berisiko tinggi.

# 7. Task Queue

Sumber pekerjaan utama:

1. `tasks/TODO.md`
2. `tasks/active/`
3. `tasks/BACKLOG.md`
4. issue/PR GitHub bila digunakan sebagai sumber task.

Agent mengambil task tertinggi yang memenuhi dependency dan policy.

State minimum:

`BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE`

Jika gagal:

`ACTIVE → BLOCKED` atau `TESTING → FAILED`

# 8. Git Safety

Setiap autonomous task harus:

1. Membaca status repository.
2. Membaca task.
3. Membuat checkpoint/commit sesuai workflow.
4. Mengubah kode.
5. Menjalankan test/lint/type-check yang relevan.
6. Meninjau diff.
7. Commit hanya jika memenuhi gate.
8. Mencatat hasil.

Jangan melakukan destructive operation tanpa approval.

# 9. Security

- [ ] Secrets tidak masuk Git.
- [ ] `.env` tidak di-commit.
- [ ] Input agent divalidasi.
- [ ] Tool permissions dibatasi.
- [ ] Shell execution dibatasi sesuai policy.
- [ ] Network access dicatat.
- [ ] File scope agent dibatasi.
- [ ] Prompt injection dari dokumen eksternal diperlakukan sebagai data, bukan instruksi.
- [ ] Audit log untuk aksi sensitif.
- [ ] Backup/rollback.

# 10. Testing

Minimal:

- Unit tests.
- Integration tests.
- API tests.
- Security tests.
- Retrieval tests.
- Citation/provenance tests.
- Arabic verification tests.
- Regression tests.
- End-to-end smoke test.

Target jangka panjang: setiap fitur pengetahuan baru memiliki test provenance dan citation.

# 11. Memory

VitaNusa-AI harus memisahkan:

- user memory
- conversation memory
- knowledge base
- system configuration
- audit history

Memory tidak boleh menjadi sumber kebenaran agama hanya karena pernah dikatakan model.

# 12. Answer Verification Pipeline

Untuk pertanyaan umum:

`Question → Intent → Retrieval → Evidence → Reasoning → Citation → Answer → Safety check`

Untuk pertanyaan Al-Qur'an/hadits:

`Question → Arabic/text identification → Source verification → Arabic analysis → Hadith/Qur'an metadata → Scholarly context → Evidence comparison → Answer → Citation → Uncertainty check`

Jika verifikasi gagal, sistem harus mengatakan bahwa data belum cukup terverifikasi.

# 13. Web / External Knowledge

- [ ] Sumber resmi/prioritas ditentukan per domain.
- [ ] Crawling/download memiliki rate limit.
- [ ] Lisensi/copyright diperhatikan.
- [ ] Source snapshot + timestamp.
- [ ] Hash/version untuk dokumen.
- [ ] Jangan menganggap hasil web sebagai kebenaran otomatis.

# 14. UI / User Experience

- [ ] Chat interface.
- [ ] Source/citation panel.
- [ ] Confidence/verification state.
- [ ] Knowledge explorer.
- [ ] Arabic analysis view.
- [ ] Agent/task monitor.
- [ ] System health dashboard.
- [ ] Audit viewer.

# 15. Autonomous Daily Operation

Target akhir:

`Roadmap → Task Queue → Planner → Agent → Test → Reviewer → Commit → Next Task`

Sistem boleh melanjutkan pekerjaan secara otomatis hanya selama:

- task tersedia;
- dependency terpenuhi;
- quota/provider tersedia;
- test gate lolos;
- security policy lolos;
- tidak ada konflik;
- tidak masuk zona human approval.

Jika salah satu syarat gagal, agent berhenti dan mencatat alasan.

# 16. Tahapan Besar

### Phase 0 — Baseline
- Dokumentasi arsitektur.
- Backup/checkpoint.
- Audit repository.
- Audit environment.

### Phase 1 — Agent governance
- `.agents/*`.
- Task system.
- Git workflow.
- Safety rules.

### Phase 2 — Knowledge foundation
- Ingestion.
- Source metadata.
- Provenance.
- Search.

### Phase 3 — Islamic knowledge
- Qur'an.
- Hadits.
- Tafsir.
- Ijma'/ikhtilaf metadata.

### Phase 4 — Arabic intelligence
- Dictionary.
- Root/morphology.
- Syntax.
- Semantic/context verification.

### Phase 5 — Reasoning & citations
- Evidence graph.
- Claim verification.
- Conflict handling.
- Citation-first answers.

### Phase 6 — Autonomous agents
- Planner.
- Worker.
- Reviewer.
- Provider router.
- Quota/fallback.

### Phase 7 — Production hardening
- Security.
- Monitoring.
- Regression suite.
- Backup/rollback.
- Performance.

### Phase 8 — Continuous learning
- New sources.
- Source refresh.
- Evaluation.
- Human review.
- Controlled autonomous maintenance.

---

# 17. Definisi Selesai

VitaNusa-AI dianggap mencapai milestone utama bila sistem dapat:

1. menerima pertanyaan;
2. menemukan sumber yang relevan;
3. memverifikasi sumber;
4. memeriksa teks Arab jika berkaitan dengan ayat/hadits;
5. membedakan dalil, pendapat ulama, analisis, dan dugaan;
6. memberikan citation/provenance;
7. mengukur ketidakpastian;
8. menjalankan task coding secara terkontrol;
9. berpindah provider ketika provider utama gagal/kuota habis;
10. menjalankan test dan review otomatis;
11. menghentikan dirinya sendiri ketika policy atau evidence tidak memenuhi syarat;
12. menyimpan seluruh keputusan penting dalam audit trail.

> **Catatan:** Roadmap ini adalah peta besar. Implementasi dilakukan bertahap. Jangan mengaktifkan autonomous coding penuh sebelum governance, task queue, Git safety, testing, dan rollback tersedia.