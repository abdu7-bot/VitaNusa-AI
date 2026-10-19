# VitaGame Quality Track — Review Note

Date: 2026-10-19

## Scope registered

The repository now has a bounded work item for VitaGame quality, safety, accessibility, and evaluation. Production implementation is not authorized by this note; VG001 requires recorded human approval before runtime edits.

## Verified baseline

- Entry: `vitagame.html`
- Current mode: `Mitos vs Fakta: Klaim Sehat`
- Static source deck: 12 items; each game starts with a shuffled selection of 10.
- Answer categories: `Fakta`, `Perlu Dicek`, and `Klaim Berlebihan`.
- Feedback currently uses `innerHTML` with hard-coded strings. Dynamic/external content must not be placed into HTML sinks; implementation should use safe DOM/text APIs.
- The global task policy requires scope, prior written approval for production-code changes, relevant tests, and reviewer separation for code changes.

## What should be measured

- Expert-reviewed correctness of each answer label and explanation.
- Evidence/source provenance and date for health claims.
- Unsafe-confidence rate, including dangerous false negatives.
- State-machine correctness: start, one answer per card, next, finish, and reset.
- Keyboard accessibility, live announcements, mobile behavior, and reduced-motion preferences.
- Reproducible performance/cost data where measured.

## Claim discipline

“Competes with the world's leading AI” is a long-term ambition, not a verified result. Any comparative ranking must use a fixed versioned test set, common rules, independent labels, reported sample size, and disclosed limitations.

## Validation state

This is a review note, not a code validation report. No runtime tests or browser smoke checks are claimed here.


## Focused code audit findings (read-only review)

These findings are based on the current `main` version of `vitagame.html`; they are not test results.

1. **Randomization bias:** `shuffle(items)` uses `items.sort(() => Math.random() - 0.5)`. This is not a uniform shuffle. Replace it with Fisher–Yates and inject a seeded/random source for deterministic tests.
2. **Feedback HTML sink:** `renderCard()`, `answerQuestion()`, `finishGame()`, and `resetGame()` assign feedback through `innerHTML`. The current explanatory copy is hard-coded in the card deck, so this is not evidence of an active exploit. It is a risky extension point if content later comes from an API, CMS, or user input. Build feedback with DOM nodes and `textContent`.
3. **Progress timing:** the progress bar is based on `state.index / total`, so it stays at 90% while the tenth card is being answered and reaches 100% only after the player presses “Kartu Berikutnya”. Confirm the intended UX; if progress means answered cards, derive it from `state.answered`.
4. **Accessibility announcement:** the card has `aria-live="polite"`, but feedback itself has no dedicated live region. Test screen-reader announcements after an answer and when the game ends; avoid making the entire card excessively verbose.
5. **Input and lifecycle states:** `answerQuestion()` correctly guards against answers before start and duplicate answers, and `nextCard()` guards against advancing before answering. Regression tests should lock these invariants, plus reset during an active round and replay after completion.
6. **Testability:** `shuffle()` depends directly on `Math.random()`, which makes deterministic selection awkward. Extract a pure shuffle/deck-selection function with an injectable random source in the approved implementation task.
7. **Dependency-free baseline:** the game logic is inline in `vitagame.html`; no dedicated `tests/vitagame.test.mjs` was found by the repository search. Confirm the test runner conventions before creating the test file.

## Recommended implementation order

1. Add a CODE + TEST task with explicit approval record and these exact runtime/test paths: `vitagame.html`, `tests/vitagame.test.mjs`, and `docs/visual/vitagame-quality-and-evaluation.md`.
2. Implement a safe feedback renderer and deterministic shuffle.
3. Add state-transition tests for start, one-answer-only, next, finish, reset, and replay.
4. Validate with the repository's actual test commands; record results and CI run IDs rather than assuming success.
5. Review health claims separately against authoritative sources before expanding the card deck.

## Review boundary

No runtime files were changed during this audit. The items above are code-review observations, not proof of a live exploit, a passing test suite, or a benchmark result.
