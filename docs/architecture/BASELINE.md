# Repository Baseline (T001)

**Audit snapshot:** `2026-10-02T18:09:10Z`
**Workspace canonical untuk T001:** `/root/VitaNusa-AI`, sesuai instruksi pemilik task.
**Batas audit:** pemeriksaan ini dilakukan pada checkout canonical saja. Workspace lain tidak diakses atau diubah; kondisi terkini workspace lain tidak dinilai.

Laporan ini mencatat kondisi source pada HEAD yang diaudit dan membedakan fakta yang diperiksa langsung dari keterbatasan verifikasi. Versi runtime lokal bukan pengganti status CI di GitHub; status run jarak jauh tidak diperiksa.

## 1. Identitas dan status Git

| Item | Hasil | Bukti |
|---|---|---|
| HEAD sebelum finalisasi T001 | `f8b61e1d8147027da65cd8509172783221366b14` (`test: stabilize backend smoke tests`) | `git rev-parse HEAD`, `git log -1` |
| Branch/tracking | `main`, `main...origin/main` tanpa ahead/behind yang dilaporkan | `git status -sb` |
| Remote | `origin https://github.com/abdu7-bot/VitaNusa-AI.git` (`blob:none`) | `git remote -v` |
| Tracked files | 637 sebelum laporan ini ditambahkan | `git ls-files \| wc -l` |
| Status awal audit | Tracked tree bersih; satu artefak audit T001 untracked (`docs/architecture/BASELINE.md`) | `git status --short --untracked-files=all` |
| Source produksi | Tidak ada perubahan di `backend/app/`; tidak ada perubahan pada file test aplikasi atau manifest dependency | `git diff -- backend/app backend/tests package.json package-lock.json` kosong pada awal finalisasi |

Seluruh perubahan T001 yang disiapkan terbatas pada laporan baseline dan catatan state/acceptance T001. Tidak ada source produksi yang diubah.

## 2. Struktur dan entry points

- Repository berisi 637 file tracked sebelum penambahan laporan ini; `git ls-files` adalah sumber hitungannya. Direktori tracked utama mencakup `backend/`, `assets/`, `admin/`, `tests/`, `docs/`, `food-ai/`, `mandiri/`, dan `tasks/`.
- `backend/app/` berisi 56 file Python dengan total 7.081 baris. Aplikasi FastAPI diekspor dari `backend/app/main.py` sebagai `app`.
- `backend/app/main.py` mendeklarasikan 10 route: `/`, `/health`, `/navigator/topics`, `/navigator/sources`, `/navigator/check`, `/llm/preview`, `/search/preview`, `/ask`, `/feedback`, dan `/admin/feedback`.
- Frontend memakai Vite (`vite.config.js`, `package.json`) dan halaman publik statis seperti `index.html`; Firebase Hosting dikonfigurasi di `firebase.json`, backend Render di `render.yaml`, serta ada konfigurasi Replit di `.replit`.
- Root `main.py` bukan entry point FastAPI; entry point backend yang digunakan CI/deployment adalah `app.main:app` dari direktori `backend/`.
- `docs/` memiliki 105 file Markdown tracked sebelum laporan ini. Laporan T001 ini menambah satu file Markdown pada path yang ditetapkan task.

**Roadmap §1 path checklist (17 item; klasifikasi berdasarkan keberadaan path/file, bukan kelengkapan isinya):**

| Status | Item |
|---|---|
| EXISTS | `ROADMAP.md`, `.agents/AGENTS.md`, `.agents/ARCHITECTURE.md`, `.agents/RULES.md`, `.agents/WORKFLOW.md`, `tasks/TODO.md`, `tasks/BACKLOG.md`, `tasks/active/`, `docs/architecture/` |
| MISSING | `tasks/completed/`, `docs/api/`, `docs/database/`, `docs/visual/`, `prompts/nano-banana/MASTER_PROMPT.md`, `prompts/nano-banana/CHARACTER.md`, `prompts/nano-banana/ENVIRONMENT.md`, `prompts/nano-banana/STYLE.md` |

Path `docs/architecture/` ada karena direktori dan laporan T001 ini. Roadmap hanya menyebut direktori tersebut; status keberadaan path adalah **EXISTS**, bukan klaim bahwa semua dokumen arsitektur yang mungkin dibutuhkan sudah tersedia.

## 3. Runtime dan dependency

### Runtime pada checkout audit

| Komponen | Lokal | Runtime yang dideklarasikan CI | Bukti |
|---|---|---|---|
| OS/arsitektur | Ubuntu 24.04.4 LTS, Linux `aarch64`, kernel `6.17.0-PRoot-Distro` | Ubuntu runner (`ubuntu-latest`) | `/etc/os-release`, `uname -smr`, `.github/workflows/ci.yml` |
| Python | 3.12.3 dari `/root/VitaNusa-AI/.venv/bin/python` | 3.12 | `python --version`, workflow CI |
| Node.js | v22.23.1 | 20 | `node --version`, workflow CI |
| npm | 12.0.1 | tidak dipin terpisah di workflow | `npm --version` |
| Java | OpenJDK 21.0.12 (Temurin) | Temurin 21 pada job frontend | `java -version`, workflow CI |
| Git | 2.43.0 | tidak dipin di workflow | `git --version` |
| Firebase CLI | 15.30.2 | disediakan oleh dependency project untuk test emulator | `npx --no-install firebase --version` |
| `uv` | tidak tersedia | CI tidak menggunakan `uv` | `command -v uv`; workflow CI |

### Manifest dan versi terpasang

| Manifest | Fakta yang diperiksa |
|---|---|
| `pyproject.toml` | Python `>=3.12`; direct dependencies: FastAPI, httpx, uvicorn; project name `repl-nix-workspace` |
| `backend/requirements.txt` | Memuat tiga dependency langsung yang sama; `scripts/check_python_dependency_sync.py` lulus |
| `uv.lock` | Ada dan mengunci Starlette `1.3.1` |
| `package.json` / `package-lock.json` | Project `vitanusa-ai`; runtime dependencies tidak dideklarasikan, lima `devDependencies` tercatat; lockfile tracked |

Versi paket Python yang terpasang pada environment audit: FastAPI `0.141.1`, httpx `0.28.1`, uvicorn `0.54.0`, Starlette `1.7.0`, dan Pydantic `2.13.5`. Perbedaan Starlette `uv.lock` vs environment ini adalah **perbedaan versi yang teramati**, bukan bukti kegagalan runtime: CI menginstal dari `backend/requirements.txt`, bukan `uv.lock`.

Nama konfigurasi yang terdokumentasi di `.env.example` dan `backend/.env.example`:

```text
VITE_NUSA_BACKEND_ASK_URL
APP_ENV, APP_NAME, VITANUSA_ADMIN_TOKEN,
VITANUSA_FEEDBACK_MAX_RECORDS, VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS,
VITANUSA_FEEDBACK_RATE_LIMIT_WINDOW_SECONDS, VITANUSA_FEEDBACK_RATE_LIMIT_STORE_PATH,
VITANUSA_TRUSTED_PROXY_IPS, OPENAI_API_KEY,
WEB_SEARCH_MODE, WEB_SEARCH_STRATEGY, WEB_SEARCH_PROVIDERS, WEB_SEARCH_PROVIDER,
WEB_SEARCH_MAX_RESULTS, WEB_SEARCH_TIMEOUT_SECONDS, WEB_SEARCH_MAX_RESPONSE_BYTES,
WEB_SEARCH_LANGUAGE, WEB_SEARCH_COUNTRY, WEB_SEARCH_SAFE_SEARCH,
WEB_SEARCH_PREVIEW_ENABLED, WEB_SEARCH_MOCK_SCENARIO,
BRAVE_SEARCH_ENABLED, BRAVE_SEARCH_API_KEY,
DUCKDUCKGO_SEARCH_ENABLED, DUCKDUCKGO_BASE_URL,
SEARXNG_SEARCH_ENABLED, SEARXNG_BASE_URL, SEARXNG_API_KEY,
LOCAL_LLM_MODE, LOCAL_LLM_STRATEGY, LOCAL_LLM_PROVIDERS, LOCAL_LLM_PROVIDER,
LOCAL_LLM_MODEL, LOCAL_LLM_TIMEOUT_SECONDS, LOCAL_LLM_MAX_TOKENS,
LOCAL_LLM_TEMPERATURE, LOCAL_LLM_PREVIEW_ENABLED, LOCAL_LLM_ASK_ENABLED,
LOCAL_LLM_MOCK_SCENARIO, OLLAMA_ENABLED, OLLAMA_BASE_URL,
LM_STUDIO_ENABLED, LM_STUDIO_BASE_URL, LOCALAI_ENABLED, LOCALAI_BASE_URL
```

Nama saja yang dicatat; nilai credential/secret tidak disalin. Variabel Vite yang ditemukan pada akses kode meliputi `VITE_NUSABELAJAR_STATE`, `VITE_NUSAKASIR_STATE`, dan `VITE_VITANUSA_MANDIRI_STATE`.

## 4. Test dan hasil baseline

Perintah yang ditetapkan di workflow proyek:

```bash
cd backend
python -m unittest discover -s tests -p 'test_*.py' -v
python -m compileall app tests
python tests/ci_smoke_test.py
python tests/policy_http_smoke_test.py
```

Hasil yang dijalankan ulang pada finalisasi T001:

| Pemeriksaan | Hasil |
|---|---|
| Backend `unittest discover` | **330 test lulus**, 0 gagal |
| `backend/tests/ci_smoke_test.py` | **9 kasus lulus** |
| `backend/tests/policy_http_smoke_test.py` | **3 kasus lulus** |
| `python -m compileall -q app tests` dan import `app.main` | Lulus; app title `VitaNusa AI Brain` |
| `python scripts/check_python_dependency_sync.py` | Lulus |
| `python scripts/check_suspicious_unicode.py` | Lulus; 555 tracked text files diperiksa |

Kedua smoke script saat ini menggunakan FastAPI `TestClient` dan berjalan tanpa server Uvicorn. **CI sendiri tetap menjalankan Uvicorn** sebelum memanggil dua smoke script tersebut; invocation lokal dan CI berbeda pada cara menyediakan HTTP server.

Pemeriksaan frontend dijalankan dengan Node lokal:

| Perintah/suite | Hasil |
|---|---|
| `npm run check` | Build Vite lulus; 6 test lulus |
| `npm run test:admin-auth` / `test:admin-management` | 30 / 29 test lulus |
| `npm run test:user-auth` / `test:vitacheck-history` | 9 / 19 test lulus |
| `npm run test:android-pwa` / `test:content-security` | 50 / 10 test lulus |
| 15 suite VitaNusa Mandiri (`test:mandiri:*`, termasuk `offline` dan `phase-2-exit`) | 793 test lulus; verifier konten juga lulus untuk `money-basics-id-v1` |

Tidak ada jumlah total lintas semua tabel yang disajikan karena beberapa selector berkelompok dapat mencakup file/test yang juga dihitung oleh selector lain. `npm run test:firestore-rules` tidak dijalankan pada baseline lokal ini karena perintahnya menyalakan Firebase Emulator. Langkah `node --check` yang ada di workflow CI juga tidak dieksekusi ulang terpisah pada finalisasi ini. Status GitHub Actions jarak jauh tidak diperiksa.

Peringatan saat test backend: Starlette memberi `DeprecationWarning` bahwa penggunaan httpx lewat `starlette.testclient` deprecated; seluruh test tetap lulus.

## 5. CI dan batas verifikasi

`.github/workflows/ci.yml` mendefinisikan workflow `VitaNusa CI` untuk pull request/push ke `main` dan `workflow_dispatch`, dengan tiga job: `repository-safety`, `frontend`, dan `backend`. Job backend memeriksa sinkronisasi dependency, compile/import, menjalankan 330 unittest, lalu memulai Uvicorn untuk dua smoke test. Job frontend memakai Node 20 dan Java 21; ia menjalankan build, unit test yang tercantum satu per satu, Firebase rules emulator test, dan pemeriksaan sintaks JavaScript.

Yang diperiksa pada baseline ini tidak membuktikan status branch protection atau hasil CI remote. `npm run test:mandiri:offline` dan `npm run test:mandiri:phase-2-exit` lulus lokal, tetapi tidak tercantum sebagai step tersendiri pada workflow CI yang diperiksa.

## 6. EXISTS / PARTIAL / MISSING pada capability yang relevan

Klasifikasi berikut merujuk ke bukti implementasi yang ditemukan di checkout ini, bukan target roadmap secara keseluruhan:

| Area | Status | Bukti dan batas klaim |
|---|---|---|
| Backend HTTP API | **EXISTS** | FastAPI app dan 10 route pada `backend/app/main.py`; test API smoke mencakup sejumlah perilaku, bukan semua route |
| Knowledge/evidence kesehatan | **PARTIAL** | `backend/app/knowledge_base.py` memiliki entri terkurasi dan pencarian tag; `backend/app/trusted_sources.py` memetakan sumber/evidence. Ini bukan bukti pipeline ingestion atau hybrid vector retrieval |
| Web search | **EXISTS** | Implementasi router/provider ada di `backend/app/search/`; test router, provider, guard, dan SSRF ada di `backend/tests/` |
| Agent governance | **PARTIAL** | Dokumen peran dan workflow ada di `.agents/`; keberadaan dokumen tidak membuktikan adanya autonomous orchestrator executable |
| Arabic verification sesuai roadmap | **MISSING pada implementasi yang diperiksa** | Tidak ditemukan modul/test verifikasi teks Arab pada area backend/test yang diaudit; ini bukan klaim bahwa seluruh diskusi terkait agama tidak ada |
| Task locking agent | **MISSING pada implementasi yang diperiksa** | Workflow menyebut konflik/lock, tetapi tidak ada task-lock implementation yang teridentifikasi; file-lock lain tidak dianggap sebagai task locking |

## 7. Temuan faktual dan rekomendasi

- Dependency manifest Python sinkron menurut skrip repository. `uv.lock` tetap ada, tetapi CI memasang requirement dari `backend/requirements.txt`; putuskan pemakaian lockfile pada pekerjaan governance terpisah.
- Node lokal `22.23.1` berbeda dari Node 20 di CI. Test frontend yang dijalankan pada Node lokal lulus, tetapi hasil itu bukan validasi runtime Node 20.
- Workflow CI tidak mencantumkan dua suite Mandiri `offline` dan `phase-2-exit`; keduanya lulus ketika dijalankan lokal pada baseline ini.
- Workspace canonical T001 adalah `/root/VitaNusa-AI` atas instruksi pemilik task. Workspace lain tidak diperiksa ulang pada finalisasi ini agar mematuhi batasan untuk tidak mengaksesnya; status/isinya saat ini tidak dinyatakan sebagai fakta.
- Untuk T002, baseline ini dapat dipakai sebagai titik pemeriksaan factual bagi dokumen governance. T003 tetap perlu menetapkan scope locking pada task tersendiri; T001 tidak merancang atau mengimplementasikan mekanisme locking.

## 8. Acceptance T001

Task ini menghasilkan laporan pada path yang diminta, memeriksa klaim terhadap checkout canonical, tidak mencatat nilai secret, menjalankan backend tests dan smoke tests yang tersedia, serta meninjau diff. `git diff --check` dijalankan sebagai gate sebelum commit. Perubahan final T001 tidak menyentuh production code. File task T001 tetap di `tasks/active/` karena `.agents/WORKFLOW.md` menetapkan lifecycle status tetapi tidak mewajibkan pemindahan file ke `tasks/completed/`.
