# VitaNusa-AI — Master Architecture & Development Map (2026)

> Status: Living architecture document
> Repository: abdu7-bot/VitaNusa-AI
> Purpose: peta induk agar pengembangan tidak kehilangan arah ketika dikerjakan manusia maupun AI agent.

## 0. Aturan Utama
1. Audit sebelum perubahan besar.
2. Jangan menghapus, mereset, atau menimpa perubahan pengguna.
3. Jangan membuat ulang modul yang sudah ada tanpa alasan.
4. Pertahankan backward compatibility bila memungkinkan.
5. Setiap fitur besar wajib punya acceptance criteria dan test.
6. Policy keselamatan tidak boleh digantikan oleh LLM.
7. Agent bekerja dalam batas repository, policy, test, dan Git workflow.
8. Target AI provider: MAX_SPEND = Rp0; tidak ada automatic paid fallback.
9. Perubahan sensitif pada safety, privacy, Firebase rules, auth, produk, dan deployment wajib direview.
10. Jika tidak yakin, agent berhenti dan mendokumentasikan ketidakpastian.

## 1. Visi
VitaNusa-AI adalah platform edukasi kesehatan dan kehidupan yang menggabungkan edukasi kesehatan umum, refleksi Islami, Nusa AI, VitaCheck, Health Navigator, artikel, knowledge base, evidence/search, katalog produk/reseller amanah, VitaStory, Mandiri, POS, learning, AI agents, dan automation.

VitaNusa-AI bukan dokter, alat diagnosis, pemberi resep, pengganti tenaga kesehatan, mufti, pemberi fatwa final, atau mesin klaim halal otomatis.

## 2. Arsitektur Tingkat Tinggi
USER → FRONTEND/PWA → API/BRAIN → INTENT & SAFETY → POLICY ENGINE → KNOWLEDGE + SEARCH/EVIDENCE + MEMORY → LLM GUARD/ROUTER → RESPONSE BUILDER → AUDIT/FEEDBACK → USER.

## 3. Layer
### A — Experience
Frontend, PWA, Admin, Articles, Komik, Mandiri, VitaCheck, Account, Settings, Assets.
Tanggung jawab: UI, accessibility, navigation, interaction, rendering, offline, auth presentation.
Frontend tidak boleh mengambil alih keputusan policy keselamatan backend.

### B — API/Application
Lokasi utama: backend/app.
Tanggung jawab: HTTP API, validation, orchestration, rate limiting, identity integration, response contracts.

### C — Intelligence
Pipeline: Input → Normalize → Intent → Safety/Risk → Policy → Knowledge → Search/Evidence bila perlu → Memory → LLM Guard → LLM Router → Response Builder → Audit.

## 4. Policy Architecture
Policy adalah otoritas pembatas tindakan.
Lokasi utama: backend/app/policies dan backend/app/policy_engine.py.
Prinsip: satu rule satu pemilik teknis; intent mendeteksi maksud; policy menentukan batas; beberapa policy boleh aktif; emergency prioritas tertinggi; warning tidak otomatis blocker; LLM bukan satu-satunya penentu policy.

## 5. Nusa AI Brain
Komponen: intent router, safety, policy, knowledge, search, memory, LLM guard, LLM router, response builder, Quranic reflection, feedback, audit log.
Target: Understand → Classify risk → Apply policy → Retrieve knowledge → Retrieve memory → Search evidence → Generate → Validate → Respond → Audit.

## 6. Knowledge
Pisahkan Static Knowledge, Curated Content, Trusted Sources, Live Evidence, dan User/Conversation Memory.
Aturan: knowledge ≠ memory ≠ search result.

## 7. Search & Evidence
Provider yang sudah ada: Brave, DuckDuckGo, SearXNG.
Strategi: priority, fallback, aggregate.
Pipeline: Query → Normalize → Select Providers → Provider Calls → Validate → Normalize → Deduplicate → Rank → Evidence Selection → Answer.
Target lanjutan: Source Classification → Freshness → Claim Extraction → Claim/Evidence Mapping → Confidence/Limitations.
Search result tidak otomatis berarti evidence yang cukup.

## 8. Memory
Pisahkan: Conversation Memory, User Memory, dan Project/Agent Memory.
Agent tidak boleh mencampurkan ketiganya.

## 9. AI Provider Router
Target kebijakan: MAX_SPEND = Rp0.
Alur: Task Classification → Kilo Auto Free → Kilo Free Models → Copilot Free Quota → Codex Free Quota → Gemini/approved free quota → PAUSE bila semua habis.
Aturan: jangan bypass rate limit; jangan otomatis billing; simpan status quota bila tersedia; pause saat semua jalur gratis habis; resume saat quota tersedia.
Provider gratis dapat berubah; jangan hard-code asumsi ketersediaan.

## 10. Agent Architecture
MANAGER → PLANNER → CODER → TESTER → REVIEWER → COMMIT/PR.
Manager memilih task dan menghentikan pekerjaan berisiko.
Planner membaca arsitektur dan menentukan file relevan.
Coder melakukan perubahan minimal.
Tester menjalankan test dan regression test.
Reviewer memeriksa diff, safety, architecture, dan backward compatibility.

## 11. Autonomous Development Workflow
ROADMAP → TASK → PLAN → IMPLEMENT → TEST → FIX LOOP → REVIEW → COMMIT → PULL REQUEST → HUMAN REVIEW / APPROVED AUTOMATION.
Jangan gunakan pola AI → langsung main branch → ubah banyak hal → selesai.

## 12. Task Architecture
EPIC → FEATURE → TASK → SUBTASK.
Setiap task minimal berisi: Objective, Current State, Requirements, Files/Modules, Dependencies, Acceptance Criteria, Tests, Risk, Rollback, Status.

## 13. Git Architecture
GitHub adalah source of truth.
Gunakan main, feature branches, dan pull requests.
Agent tidak boleh memakai git reset --hard, git clean -fd, atau force-push tanpa izin eksplisit.
Agent wajib membaca status dan diff sebelum commit.

## 14. Testing
Testing pyramid: Unit → API → Integration → E2E.
Tambahkan juga Firebase rules, security, AI behavior, regression, dan autonomous-agent tests.
Fitur AI wajib punya behavior test, bukan hanya HTTP 200.

## 15. Security
Minimal: authentication, authorization, rate limiting, CORS, security middleware, secret management, Firestore rules, sensitive access logging, input validation, output safety, prompt-injection resistance, tool permission boundaries, audit trail.
Agent permission harus dapat dibatasi per task.

## 16. Content
Pertahankan metadata artikel seperti userQuestions, answerSnippet, problemTags, audience, doNotUseFor, whenToSeekHelp, sources, intentTarget, riskLevel, sensitive flags, relatedArticles, contentDepth, primaryAction, reviewerNote.
Status konten: draft, published, archived.

## 17. Product/Reseller
Product → Evidence → Education → Transparent Claim → User Decision.
Jangan mengarang klaim medis, sertifikasi, status halal, izin, harga, stok, atau menjadikan produk sebagai solusi utama tanpa bukti.

## 18. Mandiri / POS / Learning
Mandiri adalah subsystem dengan domain, storage, repositories, services, shell/UI, backup, recovery, security, learning, offline, dan POS.
Jaga batas modul. Jangan mencampurkan domain Mandiri ke Nusa AI hanya karena berada di repository yang sama.

## 19. Deployment
GitHub → CI → frontend build + backend tests + security + rules + regression → Deploy → Production.
Deployment wajib memiliki rollback path.

## 20. Observability
Target: request logs, error logs, latency, provider status, search failures, LLM failures, agent task status, test status, deployment status, audit trail.
Jangan menyimpan secret atau data sensitif secara sembarangan.

## 21. Master Development Phases
### Phase 0 — Baseline & Architecture Freeze
Audit Git, module inventory, dependency map, test baseline, architecture inventory, source-of-truth docs. Estimasi 2–5 hari.

### Phase 1 — Core Stabilization
API contracts, policy contracts, safety, response contracts, error handling, tests. Estimasi 1–2 minggu.

### Phase 2 — Search & Evidence
Provider reliability, dedup, ranking, freshness, evidence extraction, claim/evidence mapping. Estimasi 1–3 minggu.

### Phase 3 — Knowledge & Memory
Knowledge retrieval, trusted sources, conversation memory, user-memory boundaries, project memory. Estimasi 2–4 minggu.

### Phase 4 — AI Brain
LLM router, guard, prompt architecture, structured response, tool orchestration. Estimasi 2–4 minggu.

### Phase 5 — Agent System
Manager, planner, coder, tester, reviewer, task state, recovery. Estimasi 3–6 minggu.

### Phase 6 — Free Provider Router
Provider abstraction, quota, fallback, cooldown, Rp0 hard limit, pause/resume. Estimasi 1–3 minggu.

### Phase 7 — Autonomous GitHub Workflow
Roadmap → task, task execution, branch, test, PR, review, merge gate. Estimasi 1–3 minggu.

### Phase 8 — Production Hardening
Security, performance, observability, recovery, deployment, regression. Estimasi 2–4 minggu.

## 22. Dependency Graph
Foundation → Core API → Policy/Safety.
Foundation → Search → Evidence.
Foundation → Knowledge → Memory.
Core + Search + Knowledge → LLM.
LLM + tools → Agent.
Agent → Provider Router → Autonomous GitHub.
Jangan menjadikan autonomous layer sebagai prioritas pertama.

## 23. Definition of Done
Task selesai hanya jika implementasi selesai, acceptance criteria terpenuhi, test relevan lulus, tidak ada regression penting, dokumentasi diperbarui bila perlu, Git diff diperiksa, risiko dicatat, dan status task diperbarui.
Kode berhasil dibuat bukan berarti task selesai.

## 24. Current Baseline
Repository sudah memiliki backend, frontend, admin, articles, komik, Mandiri, PWA, Firebase, tests, search, LLM, policy, health navigator, knowledge, memory, feedback, security, dan CI.
Workspace lokal dapat memiliki perubahan yang berbeda dari GitHub main. Agent wajib memeriksa git status dan git diff sebelum bekerja.

## 25. Source-of-Truth Hierarchy
1. Current code + tests
2. Dokumen master architecture ini
3. AGENTS.md
4. Domain-specific documentation
5. Roadmap/tasks
6. Agent assumptions
Jika konflik, agent tidak boleh menganggap asumsi lebih kuat daripada kode dan test aktual.

## 26. Prinsip Akhir
Jangan membuat AI sebebas mungkin. Buat AI sekuat mungkin di dalam batas yang jelas.
AI boleh bekerja mandiri untuk pekerjaan yang telah didefinisikan, tetapi safety, evidence, auditability, testing, Git history, batas biaya, dan keputusan penting tetap memiliki gate.

## 27. Next Execution Order
1. Audit lokal /root/VitaNusa-AI.
2. Bandingkan dengan GitHub main.
3. Buat baseline test report.
4. Inventaris modul aktif.
5. Tandai DONE / PARTIAL / MISSING / RISK.
6. Pecah Phase 0–8 menjadi TASK-001 dan seterusnya.
7. Kerjakan dependency paling bawah terlebih dahulu.
8. Setiap task: plan → code → test → review → commit.
9. Setelah core stabil, baru autonomous agent diperluas.
10. Jangan menganggap fitur selesai hanya karena file sudah dibuat.