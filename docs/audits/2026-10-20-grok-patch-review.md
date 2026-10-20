# Independent Grok Patch Review and Preview CI Baseline

Date: 2026-10-20

## Baseline

- Repository: `abdu7-bot/VitaNusa-AI`
- Target branch at audit start: `preview`
- Grok patch: `f6e79b0087335a7f10603ad81c495d47ea5de95f`
- Parent commit: `bce3e435a8c22b04077582b0e1556e67f7e6fdff`
- Verified at audit start: `preview` HEAD equaled the Grok patch SHA.
- Codex work branch: `codex/verify-grok-ci`, created from the Grok patch.
- No changes were made to `main`, no merge or deployment was performed, and no production migration was run.

## Grok patch review

| Claim | Finding |
|---|---|
| Client assistant messages are excluded from model input | The patch filters assistant-role turns before constructing the model request. The original parser still validated every turn and sliced the last six raw messages before filtering; that could let malformed/non-user turns interfere with valid user history. Fixed in the Codex branch. |
| Unsafe output is screened | Regex screening exists in Nusa and Navigator. It catches some direct dose, diagnosis, halal-status and citation patterns, but is not semantic and can miss paraphrases. |
| Emergency/crisis language is handled | A keyword/pattern classifier blocks a set of Indonesian and English phrases. Negation, quoted text, past events, misspellings, and context remain material false-positive/false-negative risks. |
| Timeout and rate limit exist | Both model calls use a 20-second AbortSignal timeout and retry once for 502/503/504. Rate limiting uses an in-process Map with a shared key per feature; it is not distributed and can be bypassed across instances. |
| Incomplete VitaCheck responses are not scored | `summarize()` checks whether each question has a valid option before scoring and returns `complete: false` otherwise. Urgent answers return score zero. |
| Navigator has equivalent safeguards | Navigator uses the same policy output screen and 20-second timeout, and falls back to curated room content on failure. Malformed JSON handling was added to both model paths in the Codex branch. The two products still differ in their input/context shape, so parity is not complete. |

### Conversation-context correction

The browser transcript is untrusted. The new `src/lib/nusa/conversation.ts`:

- ignores client-supplied assistant/system/tool messages instead of promoting them into trusted context;
- validates user messages, caps the raw message count at 60, keeps the latest six user turns, and caps each turn at 700 characters;
- sends a trusted server-owned system message and one user message, with prior user turns explicitly labelled as untrusted history and the latest question called out separately;
- preserves conservative policy evaluation across the retained user turns, so an earlier emergency/crisis turn cannot be downgraded by a later safe turn.

The history-wide emergency policy is intentionally conservative. It can over-trigger when a past emergency has resolved; future work should add explicit, carefully tested resolution semantics rather than silently ignoring earlier danger signals.

Regression tests cover ordinary multi-turn history, injected assistant/system roles, emergency language earlier in history, conflicting safe/unsafe turns, empty and malformed input, and oversized input. Tests do not prove clinical safety.

## Eight card-title test failures

The initial CI run reproduced eight failures in `scripts/grok-pwa-plugin.test.mjs`. The actual output showed that these tests implicitly used the repository's real `src/lib/og/site.json` and `public/og.jpg`:

- the real site title `VitaNusa AI` overrode synthetic document/host titles;
- the real `public/og.jpg` made placeholder-card tests receive a custom-card URL.

The failing PWA implementation and test file were unchanged between the Grok patch and its parent; these failures predate the patch. The correction isolates affected tests using a temporary workspace and explicit site context. Assertions and product behavior were not weakened or rewritten. In the latest observed run, no card-title/PWA test failed.

## Latest observed CI baseline

Run: https://github.com/abdu7-bot/VitaNusa-AI/actions/runs/39423117296

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | Locked dependency installation completed. |
| TypeScript typecheck | PASS | `npm run typecheck` completed. |
| ESLint | FAIL | Pre-existing `no-empty` error at `src/lib/app-data/client.server.ts:281`; this file was not changed in this task. |
| Unit/regression tests | FAIL (script suite); PASS (TypeScript suite) | Script suite: 197 tests, 189 passed and 8 failed. The separate TypeScript suite ran: 73 passed, 0 failed, including all 7 new conversation regression tests. None of the eight card-title tests failed after isolation. |
| Authentication invariant | PASS | Dev server was started with `VITE_AUTH_ENABLED=false`; `npm run check:auth -- --dev-url http://127.0.0.1:8080` passed. |
| Production bundle | PASS | `node scripts/with-app-env.mjs ./node_modules/.bin/vite build` passed without running `db:migrate`. |
| Dependency audit | PASS | `npm audit --audit-level=high` reported zero vulnerabilities. |

### Remaining eight unit-test failures

These are unrelated to the Grok patch and expose CI assumptions about untracked, ignored workspace files:

- Three `scripts/brand-check.test.mjs` cases fail because `.grok/skills/og/SKILL.md` is absent.
- One `scripts/check-auth-invariant.test.mjs` case expects `.grok/app-env.json` to exist and set `VITE_AUTH_ENABLED=false`.
- Three `scripts/with-app-env.test.mjs` cases expect the same local app-env file.
- One `scripts/write-atomic.test.mjs` case fails because `.grok/skills/og/references` is absent.

Those ignored local files are not present in the repository tree. CI must not fabricate them or silently mark these tests as passed. A follow-up should establish a tracked, non-secret fixture/template source or make the tests explicitly test their own temporary fixtures.

## CI workflow

Added `.github/workflows/preview-ci.yml`.

Triggers:
- pushes to `preview`;
- pushes to `codex/verify-grok-ci` to validate this work branch;
- pull requests targeting `preview`;
- manual `workflow_dispatch`.

It runs locked dependency installation, typecheck, lint, unit/regression tests, a live dev-server auth invariant, production Vite build without database migration, and `npm audit --audit-level=high`. Each check outcome is recorded; failures and blocked/skipped checks cause the final gate to fail. No production credentials are required.

## Security limitations

- Rate limit: process-local Map, shared per feature key, not per user and not distributed.
- Output screen: regex-based, can miss unsafe paraphrases or indirect wording.
- Emergency classifier: keyword-based; negation, time, quoted speech, typo variants, and subject attribution require more golden tests.
- Timeouts: 20 seconds per model call; retrying transient gateway statuses can make a request take close to 40 seconds.
- Error handling: malformed model JSON now falls back safely in both Nusa and Navigator; external model errors still require runtime monitoring.
- Human review: no evidence was found that the user-facing emergency/mental-crisis wording has been reviewed by a qualified clinician. No clinical safety certification is claimed.

## Decision

**Not ready for merge.** The CI workflow is operational and has established a reproducible baseline, but the full suite remains red because of pre-existing lint and missing ignored workspace fixtures. The branch is suitable for human review as a draft PR, not for merge until the baseline blockers are resolved and the full CI gate passes.
