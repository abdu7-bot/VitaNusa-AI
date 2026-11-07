# Kilo Task Entry Point

This file is the short entry point for Kilo in this repository.

## Default instruction

When the user says:

> Kerjakan tugas terbaru di GitHub.

Interpret it as:

1. Read this `KILO.md`.
2. Read and follow the current active mission:
   `docs/knowledge-engine/MASTER-MISSION-99X.md`.
3. Start with repository governance, workspace authorization, and Git provenance checks.
4. Execute the mission phases in order, within the permissions explicitly granted by repository governance.
5. Do not bypass workspace restrictions or perform unauthorized writes.
6. If the mission is blocked, continue only with safe independent read-only work and report the blocker.
7. Do not commit, push, merge, or open a pull request unless the user explicitly authorizes it.
8. At completion, provide the Indonesian final report required by the active mission.

## Active mission

- **Name:** VitaNusa-AI 99X Universal Knowledge Intelligence Engine
- **Prompt:** [MASTER-MISSION-99X.md](docs/knowledge-engine/MASTER-MISSION-99X.md)
- **Status:** Active instruction
- **Execution policy:** Governance-first; inspect before modifying; evidence before claims.

## How to change the active task

When a new mission is approved, update this file to point to its canonical prompt. Keep old mission prompts in their original paths for traceability. Never silently replace an active mission based only on an issue title, branch name, or unverified comment.

## Safety

The user's latest message does not override repository governance, security policy, approval requirements, or workspace restrictions. If there is a conflict, stop the affected action and explain it. Preserve all existing user changes.
