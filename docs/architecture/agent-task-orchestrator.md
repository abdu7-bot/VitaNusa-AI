# VitaNusa-AI — Agent Task Orchestrator Foundation

## Purpose

This document defines the first safe foundation for unattended agent work. It is a specification, not a claim that autonomous execution is already implemented.

## Control loop

```text
ROADMAP.md
  ↓
WORK QUEUE
  ↓
STATUS / REPOSITORY CHECK
  ↓
ELIGIBILITY CHECK
  ↓
TASK SELECTION
  ↓
CREATE FEATURE BRANCH
  ↓
WORKER EXECUTION
  ↓
TEST
  ↓
SECURITY CHECK
  ↓
DIFF / SCOPE CHECK
  ↓
DRAFT PR
  ↓
REVIEW
  ↓
HUMAN APPROVAL
  ↓
MERGE
  ↓
UPDATE STATUS
  ↓
NEXT ELIGIBLE TASK
```

## Task contract

Every unattended task must have:

- unique task ID;
- priority;
- source document;
- explicit scope;
- allowed paths;
- forbidden paths when applicable;
- required tests;
- security checks;
- completion criteria;
- reviewer requirement;
- merge requirement;
- stop conditions.

A task without a complete contract is **not eligible** for autonomous execution.

## Eligibility rules

The orchestrator may select a task only when:

1. the repository is in a known state;
2. the required base branch is available;
3. there is no conflicting active editor for the same branch/scope;
4. prerequisite tasks are complete;
5. the task does not violate P0/P1 safety priorities;
6. required credentials are available without exposing secrets;
7. the task has bounded scope;
8. required tests are known;
9. the task can end in a Draft PR or an explicit stop state.

## Worker roles

### Implementer

Performs the actual code or documentation changes for one task.

### Reviewer

Performs read-only review. It must not silently edit the implementer's branch.

### Human approver

Owns the final merge decision for changes that require human approval.

## Stop conditions

The orchestrator MUST stop and report when:

- a security test fails;
- required tests fail unexpectedly;
- a blocker/high/medium issue is discovered;
- the requested scope expands beyond the task contract;
- unrelated files require modification;
- a secret or sensitive data is detected;
- a paid endpoint would be required without explicit authorization;
- provider quota/rate limit prevents safe continuation;
- repository state differs unexpectedly from the expected base;
- a migration or destructive data operation is required without explicit approval;
- the agent cannot establish sufficient evidence for completion.

Stopping is a successful safety outcome, not a failure.

## Idempotency

The orchestrator must be safe to retry.

A retry must not:

- create duplicate branches for the same active task;
- create duplicate PRs for the same task;
- repeat destructive migrations;
- create duplicate application records;
- overwrite user data without an approved migration strategy.

Task execution should persist a task identifier and execution state before side effects where practical.

## Model routing boundary

The orchestrator may request a worker through the configured routing layer:

```text
PRIMARY
  Kilo Auto Free

SECONDARY
  Kilo profiles/models

DAILY FREE
  Copilot profiles/models

MONTHLY FREE
  Codex profiles/models
  Aider profiles/models
```

Routing must be quota-aware and privacy-aware. It must never silently fall back to a paid endpoint.

Sensitive repository data must not be sent to an external free-tier provider unless the repository policy explicitly permits it.

## Evidence requirements

A completed task should produce an evidence bundle containing, where applicable:

- selected task ID;
- base commit;
- head commit;
- changed paths;
- test commands and results;
- security-check results;
- diff-scope result;
- reviewer result;
- PR number;
- explicit stop reason if incomplete.

Repository evidence and runtime evidence must remain separate. A clean Git diff does not prove runtime correctness.

## State machine

```text
QUEUED
  ↓
ELIGIBLE
  ↓
CLAIMED
  ↓
IMPLEMENTING
  ↓
VERIFYING
  ├── FAIL → BLOCKED
  └── PASS → DRAFT_PR
                 ↓
              REVIEW
                 ├── CHANGES → IMPLEMENTING
                 ├── BLOCKED → BLOCKED
                 └── APPROVED → HUMAN_APPROVAL
                                      ↓
                                    MERGED
                                      ↓
                                  COMPLETED
```

No state transition may skip verification.

## First implementation boundary

The first production implementation should remain intentionally small:

1. parse task metadata;
2. inspect Git status and branch;
3. select one eligible task;
4. create or reuse a feature branch;
5. invoke exactly one worker;
6. collect test results;
7. verify changed-file scope;
8. create a Draft PR;
9. write an execution report;
10. stop for review.

Automatic merge, automatic destructive migrations, automatic deployment, and unrestricted multi-agent editing are explicitly out of scope for this foundation.

## Definition of done

This foundation is complete when the orchestrator contract is implemented as a bounded workflow with tests proving:

- task selection is deterministic;
- ineligible tasks are rejected;
- branch isolation is enforced;
- duplicate execution is prevented;
- failures stop the workflow;
- paid fallback is rejected unless explicitly authorized;
- evidence is persisted;
- Draft PR creation is bounded to one task;
- human approval remains required for the defined protected transitions.
