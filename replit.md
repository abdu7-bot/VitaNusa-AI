# VitaNusa AI

## Project overview
VitaNusa AI is an Indonesian health-education platform: a static multi-page frontend (Vite) with a Firebase backend for content/admin, plus a separate rule-based FastAPI backend ("Nusa AI Brain") that powers the `/ask` chat endpoint through an intent → medical-risk → policy-engine → response pipeline. See `README.md`, `AGENTS.md`, and `docs/` for the full domain model and content rules.

Original repo is deployed as: frontend on GitHub Pages, backend on Render (see `render.yaml`).

## Running on Replit
Two workflows run side by side:

- **Frontend** — `VITE_NUSA_BACKEND_ASK_URL=/ask npm run dev`, Vite dev server on port 5000 (webview). `vite.config.js` binds to `0.0.0.0`, sets `allowedHosts: true` for the Replit proxy, and proxies `/ask` and `/health` to the backend so the browser never needs to know the backend's real port.
- **Backend** — `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`, FastAPI app on port 8000 (console output). No secrets are required to run it: `backend/app` operates in `LOCAL_LLM_MODE=mock` by default (see `backend/.env.example`), so it works fully offline/rule-based.

To reproduce locally: `npm install` for the frontend, `pip install -r backend/requirements.txt` for the backend (already set up here via the Python module + `pyproject.toml`).

## Secrets
None are required for the app to run as imported. `backend/.env.example` shows an optional `OPENAI_API_KEY` for a future LLM integration, but it is unused while `LOCAL_LLM_MODE=mock` (the default) — do not set it unless you're wiring up a real LLM provider.

## Hybrid rule + local-LLM architecture
The rule-based intent → risk → policy engine is still the safety authority and runs on every `/ask` call. On top of it, `backend/app/main.py`'s `_generate_llm_answer` can optionally rephrase the rule-based answer through a local LLM (Ollama / LM Studio / LocalAI) for more natural wording — see `docs/ml-architecture.md` for the full design, env vars, and how to turn it on. By default (`LOCAL_LLM_ASK_ENABLED` unset/false) `/ask` behaves exactly as the original pure rule-based app. Feedback (`/feedback`) and the audit log never change app behavior automatically — an admin must review and apply changes manually.

## User preferences
- Preserve the existing project structure and content; do not redesign or add features without being asked.
- Frontend and backend run as two separate services (matching the original GitHub Pages + Render split), not merged into one process.
