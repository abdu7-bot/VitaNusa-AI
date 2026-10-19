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
