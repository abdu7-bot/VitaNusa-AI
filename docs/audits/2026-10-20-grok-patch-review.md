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
| Incomplete VitaCheck responses are not scored | `summarize()` checks whether each question has a valid option before scoring and returns `complete: false` otherwise. Urgent answers return score zero. An urgent flag is no longer hidden when other answers are still missing; the score stays zero. |
| Navigator has equivalent safeguards | Navigator uses the same policy output screen, the same upstream timeout/retry helper, and falls back to curated room content on failure. Malformed JSON handling was added to both model paths in the Codex branch. The two products still differ in their input/context shape, so parity is not complete. |

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

Superseded by the repair proof below. Kept as the red baseline.

Run: https://github.com/abdu7-bot/VitaNusa-AI/actions/runs/39423234203
HEAD: `1425af3906ef17436a5e3a83dbb359a155bf99fd`

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | Locked dependency installation completed. |
| TypeScript typecheck | PASS | `npm run typecheck` completed. |
| ESLint | FAIL | Pre-existing `no-empty` at `src/lib/app-data/client.server.ts:281`. Step `conclusion` is success only because the workflow sets `continue-on-error`; `outcome` is failure and the gate uses `outcome`. |
| Unit/regression tests | FAIL | Script suite: 197 tests, 189 passed, 8 failed, 0 skipped. TypeScript suite: 73 passed, 0 failed. The eight card-title tests were already isolated and did not fail. |
| Authentication invariant | PASS | Dev server started with `VITE_AUTH_ENABLED=false`; `npm run check:auth -- --dev-url http://127.0.0.1:8080` printed `sign-in off`. |
| Production bundle | PASS | `node scripts/with-app-env.mjs ./node_modules/.bin/vite build` passed without `db:migrate`. |
| Dependency audit | PASS | `npm audit --audit-level=high` reported zero vulnerabilities. |
| Gate | FAIL | "Summarize check outcomes and enforce gate" exited 1. |

Earlier run https://github.com/abdu7-bot/VitaNusa-AI/actions/runs/39422547917 (`91e8521`) is the 16-failure baseline: the same eight fixture failures plus eight PWA card-title failures, `spawn vite ENOENT`, and auth invariant exit 2 because that workflow revision did not start the dev server.

### Remaining eight unit-test failures on that baseline

These were unrelated to the Grok patch. They failed because a clean checkout does not contain gitignored local files:

- Three `scripts/brand-check.test.mjs` cases: `.grok/skills/og/SKILL.md` and `AGENTS.md` absent (`ENOENT`).
- One `scripts/check-auth-invariant.test.mjs` case: expected shipped `VITE_AUTH_ENABLED=false`, got auth-on because `.grok/app-env.json` was absent. Missing flag stays fail-closed.
- Three `scripts/with-app-env.test.mjs` cases: same missing app-env file (`{}` / `undefined` instead of `"false"`).
- One `scripts/write-atomic.test.mjs` case: `.grok/skills/og/references` absent (`ENOENT`).

## Repair proof

Repair commit: `c03e8650e274819f88099f473888f1d24d00dc3f` on `codex/verify-grok-ci`.
`main` was not modified. Nothing was merged or deployed.

| Failure class | Repair | What was not done |
|---|---|---|
| Eight PWA card tests | Already isolated in `a4bed7a` by passing an empty cwd and explicit `site`. Product `site.json` title and `public/og.jpg` were not changed. A regression now proves the product card is used only for the process cwd, and an isolated cwd does not inherit it. | Assertions were not weakened. |
| Auth-off template tests | `.gitignore` ignores `.grok/*` but tracks `.grok/app-env.json`. The file only sets `VITE_AUTH_ENABLED` to `"false"` and `deploy.database` to false. No secret. | The fail-closed predicate (`undefined` means sign-in on) was not changed. |
| `spawn vite ENOENT` | Package scripts and CI call `./node_modules/.bin/vite`. `with-app-env` also resolves a bare command from `node_modules/.bin` because `spawn` does not use a shell. | Database migration is still not part of the CI bundle step. |
| ESLint `no-empty` | The empty `catch` in `tokenIdentityKey` now has a comment. Malformed JWT payloads still fall through to hashing the raw token. | No control-flow change. |
| Builder-prompt tests | Assertions are unchanged and run when `AGENTS.md` and `.grok/skills/og/**` are present. On a product checkout those gitignored files are absent, so the four tests skip instead of `ENOENT`. They are not marked passed. | The builder prompts were not committed. |

Green proof, both on `c03e865`:

- Push: https://github.com/abdu7-bot/VitaNusa-AI/actions/runs/39429229851
- Pull request: https://github.com/abdu7-bot/VitaNusa-AI/actions/runs/39429241603

| Check | Result |
|---|---|
| `npm ci` | PASS |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Script tests | 202 total, 198 passed, 0 failed, 4 skipped (builder prompts absent) |
| TypeScript tests | 85 passed, 0 failed, 0 skipped |
| Authentication invariant | PASS — `sign-in off` |
| Production bundle, no migration | PASS |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| Gate | PASS |

Locally, with the builder prompts present, the same script suite is 202 passed, 0 failed, 0 skipped. That is the difference between this sandbox and GitHub: the four skip lines are not executed assertions in CI.

## CI workflow

Added `.github/workflows/preview-ci.yml`.

Triggers:

- pushes to `preview`;
- pushes to `codex/verify-grok-ci` to validate this work branch;
- pull requests targeting `preview`;
- manual `workflow_dispatch`.

It runs locked dependency installation, typecheck, lint, unit/regression tests, a live dev-server auth invariant, production Vite build without database migration, and `npm audit --audit-level=high`. Each check outcome is recorded; failures and blocked/skipped checks cause the final gate to fail. `continue-on-error` on individual steps does not hide a failure from the gate, because the gate reads `outcome`, not `conclusion`. No production credentials are required.

## Security limitations

- Rate limit: process-local Map, shared per feature key, not per user and not distributed.
- Output screen: regex-based, can miss unsafe paraphrases or indirect wording.
- Emergency classifier: keyword-based; negation, time, quoted speech, typo variants, and subject attribution require more golden tests.
- Timeouts: 20 seconds per model call; retrying transient gateway statuses can make a request take close to 40 seconds.
- Error handling: malformed model JSON now falls back safely in both Nusa and Navigator; external model errors still require runtime monitoring.
- Human review: no evidence was found that the user-facing emergency/mental-crisis wording has been reviewed by a qualified clinician. No clinical safety certification is claimed.
- The four skipped builder-prompt tests do not run in GitHub. Their assertions still run only where those gitignored files exist.

## Decision

**CI gate is green for controlled preview review. Not production-ready. Not a merge into `main`.**

`preview` and `main` have no common ancestor. Draft PR https://github.com/abdu7-bot/VitaNusa-AI/pull/113 is the review vehicle. A green bundle and a green workflow do not certify clinical safety, and the process-local rate limit plus keyword gate remain the stated limits.
