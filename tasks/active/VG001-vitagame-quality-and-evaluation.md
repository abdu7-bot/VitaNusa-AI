# VG001 — VitaGame Quality, Safety, and Evaluation

**Status:** READY — awaiting human approval before production-code implementation  
**Owner:** unassigned  
**Priority:** P1  
**Class:** DOC now; future implementation task must be CODE + TEST  
**Dependency:** inspect current VitaGame runtime and define benchmark baseline  
**Created:** 2026-10-19

## Objective

Make VitaGame a trustworthy, accessible, measurable educational game that teaches users to evaluate health-related claims. Do not claim to outperform any global AI system without independent, reproducible comparative evidence.

## Current verified baseline

- Entry page: `vitagame.html` on `main`.
- Current mode: “Mitos vs Fakta: Klaim Sehat”.
- Current in-page deck contains 12 hard-coded cards; each run selects 10.
- Answer classes: `fact`, `check`, and `claim`.
- Score and streak are client-side.
- Current explanatory feedback is rendered using `innerHTML`; although the current strings are hard-coded, any future dynamic content must not flow into HTML sinks.
- The repository’s `.agents/AGENTS.md` and `.agents/WORKFLOW.md` require explicit file scope, recorded human approval before production-code edits, relevant tests, a separate reviewer for CODE/TEST changes, and no unverified claims about test results.
- No VitaGame-specific open GitHub issue was found in the queried open issues.

## Proposed implementation scope — requires approval before the first runtime change

1. `vitagame.html` — replace unsafe HTML-string feedback rendering with DOM/text APIs; preserve existing game behavior.
2. `tests/vitagame.test.mjs` — add deterministic regression coverage for start/reset/answer/next/end-of-game behavior, duplicate clicks, score/streak, round/progress consistency, and feedback text safety.
3. `docs/visual/vitagame-quality-and-evaluation.md` — document game principles, content provenance, evaluation rubric, accessibility checks, and release gates.

Do not modify other production paths, backend, Firebase, dependency manifests, CI, deployment, authentication, VitaCheck, or the global app shell in this task.

## Acceptance criteria

- A round contains exactly 10 unique cards selected from the eligible deck, or the game fails clearly if the deck is too small.
- Scoring, streaks, progress, round count, and final result are deterministic under a test-controlled deck/shuffle.
- One card can be answered only once; navigation is impossible before answering and after completion.
- Start, restart, and reset leave no stale answer state, stale score, or incorrect disabled controls.
- Dynamic feedback is rendered using safe DOM/text APIs; no untrusted value is inserted through `innerHTML`, `insertAdjacentHTML`, or `document.write`.
- Keyboard-only use, visible focus, button labels, status announcements, reduced motion, and narrow mobile layout are checked.
- Each health claim has a documented source/provenance record or is explicitly labeled as general educational guidance; emergency claims are checked against authoritative guidance.
- Content never diagnoses a player or promotes products/treatments as guaranteed cures.
- Add a reproducible content evaluation rubric: factual correctness, clarity, source quality, uncertainty handling, safety, and reading level.
- Relevant tests pass locally and CI evidence is checked rather than assumed.
- An independent reviewer records PASS or BLOCKED; no auto-merge or deployment.

## Evaluation plan

Before claiming quality superiority, maintain a fixed, versioned test set and report:
- answer accuracy against expert-reviewed labels;
- source correctness and citation coverage;
- false confident claims and dangerous misses;
- calibration/uncertainty quality;
- Indonesian readability and accessibility;
- latency and resource cost where measured;
- regression rate across releases.

Comparisons must use the same prompts, test set, scoring rules, and date-stamped versions. Publish the limitations and sample size. Do not market “AI nomor 1 di dunia” as a verified fact without independent evidence.

## Required validations after implementation

- `node --test tests/vitagame.test.mjs`
- `npm run check`
- `python scripts/check_suspicious_unicode.py`
- `git diff --check`
- Inspect the full diff for scope, unsafe HTML sinks, accidental medical claims, and accessibility regressions.
- Check the actual GitHub Actions run before recording CI status.

## Human approval record

**Approval:** PENDING  
**Approver:** pending  
**Date/time:** pending  
**Approved files/objective:** pending

The repository governance contract forbids beginning the production-code portion until this section contains explicit human approval.

## Review checklist

- [ ] Scope matches exactly the three proposed paths above.
- [ ] Tests cover state transitions and safety regressions.
- [ ] No health claim is unsupported or overconfident.
- [ ] Accessibility and mobile checks are documented.
- [ ] All validation commands and actual results are recorded.
- [ ] Independent reviewer records PASS or BLOCKED.
- [ ] Commit SHA and review decision are recorded.

## Outcome log

Implementation has not started. No production-code change or test result is claimed by this task creation.
