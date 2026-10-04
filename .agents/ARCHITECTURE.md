# VitaNusa-AI Architecture

Dokumen ini menjelaskan lapisan sistem dan posisi governance di dalamnya.

## 1. Workspace

```text
/root/VitaNusa-AI   canonical workspace   -> satu-satunya lokasi baca/tulis agent
/home/vita/VitaNusa-AI  read-only secondary -> tidak ditulis, tidak menjadi asal perubahan
```

## 2. Lapisan utama

1. **Frontend** — UI, chat, knowledge explorer, monitoring.
2. **Backend/API** — authentication, business logic, API contracts.
3. **Knowledge Engine** — ingestion, normalization, metadata, retrieval, provenance.
4. **Islamic Knowledge Layer** — Qur'an, hadits, tafsir, ijma'/ikhtilaf dengan sumber dan status.
5. **Arabic Verification Layer** — teks Arab, token, lemma/root, morphology, syntax, dictionary, context.
6. **Reasoning & Answer Verification** — evidence comparison, citation, uncertainty, answer policy.
7. **Agent Orchestrator** — planner, implementer, reviewer, integrator, provider routing.
8. **Task Queue** — TODO, active tasks, backlog, completion state.
9. **Audit & Observability** — logs, health checks, provenance, agent actions.
10. **Persistence** — database, knowledge store, configuration, memory, audit history.

## 3. Lapisan governance

Governance berada di luar lapisan aplikasi dan mengikat lapisan 7 dan 8.
Governance tidak ganti lapisan 1–6; ia mengatur siapa yang boleh mengubahnya dan
dengan gate apa.

| Artefak | Fungsi |
|---|---|
| `.agents/AGENTS.md` | Kontrak: workspace, peran, alur, kelas task, stop condition |
| `.agents/RULES.md` | Aturan mutlak: scope, traceability, production protection, anti-tabrakan |
| `.agents/WORKFLOW.md` | Prosedur: state machine, gate, validasi, checklist review, commit |
| `.agents/ARCHITECTURE.md` | Peta lapisan dan hubungan governance dengan sistem |
| `tasks/TODO.md` | Antrean kerja dan status |
| `tasks/active/T*.md` | Task record: objective, scope, class, acceptance, hasil |
| `docs/orchestration/README.md` | Indeks fondasi orchestration multi-agent: isolation, registry, locking, assignment, review, validation, audit |
| `scripts/check_agent_governance.py` | Anchor guard dan smoke guard untuk kontrak governance |

Governance berlaku pada semua agent apa pun providernya: Kilo, Copilot, Codex,
atau agent lain. Provider dapat diganti; governance tidak.

Lapisan 7 dan 8 dikonfigurasi oleh kontrak di `docs/orchestration/`, yang berstatus
FOUNDATION: model isolation, task registry, locking, assignment, review,
validation contract, dan audit trail contract. Kontrak itu merinci aturan di
dokumen ini; ia tidak menambah aturan baru dan tidak menambah state machine.

### 3.1 Status `scripts/check_agent_governance.py`

Skrip ini adalah **anchor guard**, bukan validator governance yang otoritatif.

Yang diperiksa skrip:

1. Path governance yang wajib ada benar-benar ada.
2. String anchor tertentu masih tertulis di dokumen governance.
3. Bentuk baris task di `tasks/TODO.md` dan `tasks/BACKLOG.md` valid.

Yang tidak diperiksa skrip:

- Makna dan konsistensi antardokumen. Anchor yang masih ada tidak menjamin
  definisi role, approval, area terlindungi, kelas task, dan workflow tidak
  saling bertentangan.
- Kepatuhan agent terhadap kontrak. Skrip tidak mengaudit diff atau perilaku.
- Cakupan anchor untuk tabel peran dan kelas task pada `.agents/AGENTS.md`
  §2 dan §5; tabel itu belum diawasi secara otomatis.

Batas lain yang harus diketahui:

- Skrip tidak dijalankan di `.github/workflows/ci.yml`; setiap pemeriksaan
  governance masih manual dan lokal.
- Skrip memakai standard library saja, tidak menjadwalkan pekerjaan, tidak
  mengunci file, dan tidak membaca secret.
- Perluasan cakupan anchor atau integrasi CI adalah pekerjaan terpisah yang
  memerlukan approval manusia; statusnya tidak boleh diklaim sebagai bagian
  task governance.

Konsekuensi: PASS dari skrip adalah bukti keberadaan anchor, bukan bukti
kebenaran kontrak. Keputusan PASS tetap milik reviewer terhadap checklist
`.agents/WORKFLOW.md` §7.

## 4. Prinsip dependency

Frontend tidak menjadi sumber kebenaran. Model AI tidak menjadi sumber kebenaran. Memory percakapan tidak menjadi sumber kebenaran agama. Evidence dan provenance harus berada di bawah knowledge/verification layer.

Urutan sumber kebenaran secara lengkap ada di `.agents/AGENTS.md` §1.

## 5. Alur jawaban

`Question → Intent → Retrieval → Evidence → Verification → Reasoning → Citation → Safety Check → Answer`

Untuk ayat/hadits:

`Question → Arabic/Text Identification → Exact Source → Arabic Verification → Scholarly Context → Evidence Comparison → Answer`

## 6. Alur coding agent

```text
Roadmap → Task Queue → Planner → Implementer → Validate → Reviewer → Commit → Next Task
```

Saat beberapa task yang sudah PASS digabungkan, tahap penggabungan itu
dikerjakan Integrator, sesuai `.agents/AGENTS.md` §2 dan `ROADMAP.md` §5 Tier 4.
Integrator tidak menambah langkah approval dan tidak menggantikan approval
manusia.

Detail state, gate, dan reviewer checklist ada di `.agents/WORKFLOW.md`.

### 6.1 Pemetaan istilah peran

Dokumen lain memakai nama peran yang berbeda. Pemetaan ini adalah penyesuaian
istilah di dalam governance; `docs/vitanusa-master-architecture-2026.md` tetap
berdiri sendiri dan tidak diubah oleh task governance.

| Istilah lain | Peran governance | Catatan |
|---|---|---|
| `MANAGER`, `Manager` | Planner | Memilih task dan menghentikan pekerjaan berisiko |
| `PLANNER`, `Planner` | Planner | Menentukan scope dan urutan |
| `CODER`, `Coder` | Implementer | Perubahan minimal |
| `TESTER`, `Tester` | Implementer, tahap VALIDATE | Menjalankan test dan regression test |
| `REVIEWER`, `Reviewer` | Reviewer | Memeriksa diff dan safety |
| `COMMIT`/`PR` | Commit oleh Implementer setelah reviewer PASS, penggabungan oleh Integrator | Lihat §6 dan `.agents/WORKFLOW.md` §8 |
| Tier 1 sampai Tier 4 | Planner, Implementer, Reviewer, Integrator | `ROADMAP.md` §5 |

Perbedaan nama tetap relevan: dokumen lain tidak boleh dibaca sebagai aturan
governance tambahan. `.agents/AGENTS.md` dan `.agents/RULES.md` yang mengikat.

## 7. Proteksi production code

Proteksi bersifat default: perubahan pada area di bawah memerlukan scope
eksplisit per file dan approval manusia tertulis. Daftar yang sama ada di
`.agents/AGENTS.md` §6 dan `.agents/RULES.md`.

| Area | Path utama | Kategori perubahan |
|---|---|---|
| Halaman publik dan layout | `index.html`, `style.css`, halaman HTML root | Production code |
| chat UI Nusa AI | aset UI dan halaman chat | Production code |
| logika VitaCheck | `vitacheck.html` dan modul VitaCheck | Production code |
| Halaman produk dan kontak | `products/`, `contact.html` | Production code |
| Backend aplikasi | `backend/app/` | Production code |
| Firebase config, Firestore rules, dan storage rules | `firebase.json`, `firestore.rules`, `storage.rules`, `.firebaserc` | Production code |
| service worker | `service-worker.js` | Production code |
| WhatsApp/email dan asset path | konfigurasi kanal dan path aset | Production code |
| Workflow CI | `.github/workflows/` | CI; kategori `CI` |
| Konfigurasi deployment | `render.yaml`, `.replit`, hosting config | Deployment; kategori `DEPLOY` |
| Manifest dependency runtime | `backend/requirements*.txt`, `pyproject.toml`, `package.json` | Configuration; kategori `CONFIG` |
| Pemeriksa repository | `scripts/` non-runtime | Tooling; kategori `TOOL` |
| Kontrak governance | `.agents/`, `tasks/`, `AGENTS.md` | Documentation; kategori `DOC` |
| Test aplikasi | `backend/tests/`, `tests/` | Test; kategori `TEST` |

Kategori `TEST` dan `TOOL` tidak dilindungi pada makna "butuh approval
manusia"; keduanya dilindungi pada makna "tidak boleh berubah menjadi
perubahan production tanpa task class dan scope yang sesuai". Lihat
`.agents/RULES.md`.

## 8. Batas repository

Agent bekerja di dalam repository canonical. Perubahan di luar repository,
termasuk pada read-only secondary copy, di luar batas dan tidak dilakukan agent
tanpa instruksi manusia eksplisit.
