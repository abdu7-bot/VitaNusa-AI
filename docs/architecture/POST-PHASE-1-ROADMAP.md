# VitaNusa-AI — Post-Phase-1 Development Roadmap

> **Execution gate:** Dokumen ini adalah roadmap perencanaan. Tidak ada task di bawah yang boleh mulai dikerjakan sebelum **Phase 1 / T001 Repository Baseline** dinyatakan DONE melalui workflow repository, acceptance criteria T001 terpenuhi, dan baseline disetujui.
>
> Dokumen ini **tidak menggantikan** `ROADMAP.md` atau `tasks/TODO.md`. Ia menerjemahkan roadmap induk menjadi urutan pengembangan setelah baseline selesai.

## 0. Relationship dengan Roadmap yang Sudah Ada

### Existing sources of truth

1. `ROADMAP.md` — roadmap induk dan visi jangka panjang.
2. `tasks/TODO.md` — antrean task executable.
3. `tasks/active/` — task yang sedang dikerjakan.
4. `.agents/WORKFLOW.md` — mekanisme kerja agent.
5. `.agents/RULES.md` — batasan keselamatan dan kualitas.

### Overlap assessment

Roadmap ini **tidak membuat roadmap kedua yang berdiri sendiri**. Ia memetakan dan mengurutkan pekerjaan yang sudah tercantum di roadmap induk/TODO.

| Roadmap baru | Existing TODO | Status hubungan |
|---|---|---|
| Phase 2 — Governance hardening | T002–T005 | Melanjutkan, bukan duplikasi |
| Phase 3 — Task Orchestrator | T010–T014 | Melanjutkan, bukan duplikasi |
| Phase 4 — Provider Router | T020–T026 | Melanjutkan, bukan duplikasi |
| Phase 5 — Knowledge Foundation | T030–T035 | Melanjutkan, bukan duplikasi |
| Phase 6 — Islamic Knowledge Layer | T040–T046 | Melanjutkan, bukan duplikasi |
| Phase 7 — Arabic Verification | T050–T058 | Melanjutkan, bukan duplikasi |
| Phase 8 — Answer Verification | T060–T066 | Melanjutkan, bukan duplikasi |
| Phase 9 — Production Hardening | T070–T075 | Melanjutkan, bukan duplikasi |

Jika terjadi konflik antara dokumen ini dengan `ROADMAP.md` atau `tasks/TODO.md`, **dokumen induk dan task queue tetap menjadi sumber kebenaran**.

---

# 1. Gate — Phase 1 Must Be Closed First

Tidak ada Phase 2+ yang boleh ACTIVE sebelum seluruh kondisi berikut terpenuhi:

- [ ] T001 acceptance criteria terpenuhi.
- [ ] `docs/architecture/BASELINE.md` sudah direkonsiliasi berdasarkan audit/review.
- [ ] Canonical workspace ditetapkan.
- [ ] Workspace kedua `/home/vita/VitaNusa-AI` sudah di-snapshot dan tidak disentuh destruktif.
- [ ] Status T001 dipindahkan dari `READY` menuju workflow selesai sesuai `.agents/WORKFLOW.md`.
- [ ] Baseline review disetujui.

**Catatan:** Menulis roadmap ini tidak berarti Phase 2+ dimulai. Roadmap hanya menjadi rencana eksekusi setelah gate di atas terbuka.

---

# 2. Phase 2 — Governance Hardening

**Tujuan:** membuat aturan agent benar-benar dapat ditegakkan.

Task utama: **T002–T005**.

### Deliverables

- Validasi empat dokumen `.agents/*` terhadap repository aktual.
- Task locking.
- Checkpoint dan rollback.
- Audit log autonomous task.
- Definisi ownership dan scope file/task.
- Penanganan stale lock dan recovery.
- Aturan lintas-workspace agar agent tidak bekerja pada clone yang salah.

### Exit criteria

- Dua agent tidak dapat mengambil task/file yang sama secara bersamaan.
- Setiap perubahan autonomous memiliki checkpoint.
- Task gagal dapat dikembalikan secara aman.
- Aktivitas agent dapat diaudit.
- Human approval boundary terdokumentasi dan dapat ditegakkan.

---

# 3. Phase 3 — Task Orchestrator

**Tujuan:** mengubah task queue dari dokumen pasif menjadi antrean yang dapat diproses mesin.

Task utama: **T010–T014**.

### Deliverables

- Parser `TODO.md`, `BACKLOG.md`, dan `tasks/active/`.
- Dependency checking.
- State machine: `BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE`.
- `BLOCKED` dan `FAILED` handling.
- Test gate.
- Stop condition untuk kegagalan berulang.

### Exit criteria

Agent tidak lagi memilih pekerjaan berdasarkan teks bebas semata; task dipilih berdasarkan state, dependency, policy, dan availability.

---

# 4. Phase 4 — Provider Router

**Tujuan:** membuat factory tidak bergantung pada satu provider.

Task utama: **T020–T026**.

### Deliverables

- Provider registry.
- Health check.
- Quota tracking.
- Retry/backoff.
- Ordered fallback.
- Circuit breaker.
- Adapter provider sesuai availability dan policy.

### Prinsip

Provider dipilih berdasarkan capability, availability, quota, error rate, dan policy. Jangan mengasumsikan layanan gratis selalu tersedia.

### Exit criteria

Task dapat berpindah provider secara terkontrol tanpa kehilangan state atau melanggar task ownership.

---

# 5. Phase 5 — Knowledge Foundation

**Tujuan:** membangun fondasi knowledge engineering yang dapat diaudit.

Task utama: **T030–T035**.

### Deliverables

- Audit ingestion yang sudah ada.
- Source metadata schema.
- Provenance per chunk.
- Deduplication.
- Structure-aware chunking.
- Hybrid retrieval.

### Exit criteria

Setiap evidence penting dapat ditelusuri kembali ke sumber, versi, dan metadata asalnya.

---

# 6. Phase 6 — Islamic Knowledge Layer

**Tujuan:** membangun lapisan pengetahuan Islam dengan pemisahan sumber dan status epistemik.

Task utama: **T040–T046**.

### Deliverables

- Validasi teks Al-Qur'an.
- Pemisahan teks Arab dan terjemahan.
- Metadata hadits.
- Metadata tafsir dan ulama.
- Pemisahan ijma', ikhtilaf, dan pendapat ulama.
- Conflict detection antar sumber.

### Prinsip

Sistem tidak boleh mengubah pendapat menjadi ijma', tidak boleh mengarang dalil, dan harus mempertahankan provenance.

### Exit criteria

Jawaban yang menggunakan Islamic knowledge layer dapat menunjukkan sumber, status, dan konteks pernyataannya.

---

# 7. Phase 7 — Arabic Verification

**Tujuan:** memastikan analisis bahasa Arab dapat diperiksa sebelum dipakai untuk klaim.

Task utama: **T050–T058**.

### Pipeline

`Normalization → Exact Text → Tokenization → Lemma/Root → Morphology → Syntax → Dictionary → Context → Confidence/Provenance`

### Exit criteria

Analisis bahasa Arab menghasilkan artefak yang dapat diaudit dan tidak otomatis berubah menjadi klaim agama tanpa sumber pendukung.

---

# 8. Phase 8 — Answer Verification

**Tujuan:** menghubungkan pertanyaan, evidence, reasoning, dan citation secara terukur.

Task utama: **T060–T066**.

### Pipeline umum

`Question → Intent → Evidence → Claim Mapping → Reasoning → Citation → Safety → Answer`

### Untuk Qur'an/Hadits

`Question → Text Identification → Source Verification → Arabic Verification → Scholarly Context → Evidence Comparison → Answer → Citation → Uncertainty Check`

### Exit criteria

Sistem mampu membedakan:

- dalil;
- pendapat ulama;
- analisis rasional;
- inferensi/dugaan;
- ketidakpastian.

---

# 9. Phase 9 — Production Hardening

**Tujuan:** membuat factory cukup stabil untuk operasi berkelanjutan.

Task utama: **T070–T075**.

### Deliverables

- Unit/integration/API/security coverage audit.
- Arabic regression suite.
- Citation/provenance regression suite.
- Observability dan health dashboard.
- Backup/recovery test.
- End-to-end autonomous smoke test.

### Exit criteria

Factory dapat menjalankan task secara berulang tanpa mengorbankan correctness, security, provenance, atau recoverability.

---

# 10. Setelah T075 — Coding Factory Expansion

Tahap ini **belum masuk `tasks/TODO.md` sebagai pekerjaan executable** sampai Phase 2–9 selesai atau roadmap induk diperbarui secara eksplisit.

Potensi pengembangan berikutnya:

1. Multi-project orchestration.
2. Isolated worktree per task.
3. Agent specialization.
4. Evaluation harness untuk kualitas agent.
5. Long-running task recovery.
6. Knowledge graph.
7. Semantic/graph-aware retrieval.
8. Automated maintenance.
9. Cost/latency optimization.
10. Controlled autonomous daily operation.

Tahap ini harus dibuat sebagai task baru dengan acceptance criteria sebelum implementasi.

---

# 11. Urutan Eksekusi Resmi

```text
T001 Baseline
   │
   ├── RECONCILE + REVIEW
   │
   ▼
T002 Governance validation
   ↓
T003 Task locking
   ↓
T004 Checkpoint / rollback
   ↓
T005 Audit log
   ↓
T010–T014 Task orchestrator
   ↓
T020–T026 Provider router
   ↓
T030–T035 Knowledge foundation
   ↓
T040–T046 Islamic knowledge
   ↓
T050–T058 Arabic verification
   ↓
T060–T066 Answer verification
   ↓
T070–T075 Production hardening
   ↓
[NEW ROADMAP REVIEW]
   ↓
Coding Factory Expansion
```

## Non-negotiable rule

> **Jangan melompati gate hanya karena agent mampu mengerjakan tahap berikutnya.**
>
> Kemampuan agent bukan bukti bahwa governance tahap sebelumnya sudah aman.

---

# 12. Definition of Success

Roadmap pasca-Phase-1 dianggap berhasil bila VitaNusa-AI memiliki:

- satu sumber kebenaran repository;
- task lifecycle yang executable;
- task locking yang aman lintas proses/workspace sesuai scope;
- checkpoint dan rollback;
- audit trail;
- provider routing;
- test/security gates;
- knowledge provenance;
- citation-first verification;
- Arabic verification pipeline;
- human approval boundary;
- dan kemampuan menghentikan autonomous execution secara aman.
