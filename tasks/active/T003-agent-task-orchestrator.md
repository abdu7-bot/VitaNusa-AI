# T003 — Agent Task Orchestrator Foundation

Status: READY FOR IMPLEMENTATION
Priority: P1 — agent/data safety

## Objective
Build the smallest safe controller that can select and execute one bounded repository task, verify it, and stop at Draft PR/review.

## Required behavior

- read `ROADMAP.md` and the active work queue;
- inspect branch and Git status before execution;
- reject work when prerequisites are incomplete;
- claim exactly one task;
- isolate work on a feature branch;
- invoke one configured worker;
- run required tests and security checks;
- enforce changed-file scope;
- produce an execution evidence report;
- create or prepare a Draft PR;
- stop for review.

## Explicit non-goals

- automatic merge;
- deployment;
- destructive migrations;
- unrestricted multi-agent editing;
- silent paid model fallback;
- bypassing repository security policy.

## Acceptance criteria

1. Unit tests cover task eligibility and rejection.
2. Branch isolation is tested.
3. Duplicate task execution is rejected or safely resumed.
4. A failed required test produces BLOCKED state.
5. Unexpected file changes produce BLOCKED state.
6. Paid fallback without explicit authorization is rejected.
7. Evidence contains task ID and commit information.
8. Draft PR creation is limited to the selected task.
9. No secrets are written to logs or repository files.
10. Human approval remains required for protected transitions.

## Stop conditions

Stop immediately on security failure, scope expansion, unexpected repository state, secret detection, unavailable required evidence, destructive data operation, or unauthorized cost.

## Completion

Implementation is complete only after required tests pass, security checks pass, diff scope is verified, documentation is updated, and a Draft PR is available for review.