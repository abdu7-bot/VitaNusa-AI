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
| `scripts/check_agent_governance.py` | Pemeriksaan bahwa kontrak governance masih utuh |

Governance berlaku pada semua agent apa pun providernya: Kilo, Copilot, Codex,
atau agent lain. Provider dapat diganti; governance tidak.

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

Detail state, gate, dan reviewer checklist ada di `.agents/WORKFLOW.md`.

## 7. Proteksi production code

Area terlindungi pada repository:

| Area | Path utama |
|---|---|
| Halaman publik dan layout | `index.html`, `style.css`, halaman HTML root |
| chat UI Nusa AI | aset UI dan halaman chat |
| logika VitaCheck | `vitacheck.html` dan modul VitaCheck |
| Halaman produk dan kontak | `products/`, `contact.html` |
| Firebase config dan Firestore rules | `firebase.json`, `firestore.rules`, `storage.rules`, `.firebaserc` |
| service worker dan deployment config | `service-worker.js`, `render.yaml`, `.replit`, `.github/workflows/` |
| Backend aplikasi | `backend/app/` |

Proteksi bersifat default: perubahan pada area ini memerlukan task class `CODE`
dengan scope eksplisit dan approval manusia. Lihat `.agents/RULES.md`.

## 8. Batas repository

Agent bekerja di dalam repository canonical. Perubahan di luar repository,
termasuk pada read-only secondary copy, di luar batas dan tidak dilakukan agent
tanpa instruksi manusia eksplisit.
