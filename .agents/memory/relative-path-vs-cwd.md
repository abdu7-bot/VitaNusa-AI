---
name: Default relative file paths must anchor to __file__, not cwd
description: Why a "backend/data/x.jsonl"-style default path doubled into backend/backend/data/x.jsonl in this project.
---

A module-level default like `Path(os.getenv("SOME_PATH", "backend/data/x.jsonl"))`
looks safe when tested by running scripts from the repo root, but it silently
breaks the moment the process's cwd is not the repo root.

**Why:** this project's Backend workflow runs `cd backend && uvicorn ...`, so
the process cwd is already `backend/`. A default path string that itself
starts with `"backend/..."` resolves to `backend/backend/data/...` — a stray
nested directory that's easy to miss until you go looking for the file it
was supposed to write.

**How to apply:** for any file the app writes/reads with a relative default
path, anchor it explicitly instead of trusting cwd:
`Path(__file__).resolve().parent.parent / "data" / "x.jsonl"` (adjust `.parent`
count to the module's actual depth). Only rely on a plain relative string
default when you control and know the exact run-command cwd, or when the
value always comes from an env var with no relative-path default at all.
