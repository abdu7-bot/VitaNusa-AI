# VitaNusa AI — Autonomous Coding Engine: Master Architecture

**Status:** Proposed target architecture  
**Baseline:** Phase 8.13 report; reported commit `638c354b4fa1d0402c6a152b4f5014e7f3e46886`  
**Implementation status:** This document is a plan, not evidence that the target system already exists.  
**Release posture:** No production authorization is implied.

## 1. Vision

Build a dependable software-engineering agent platform that can take a well-scoped issue, understand an unfamiliar repository, plan a minimal change, edit code, execute tools in a controlled environment, diagnose failures, iterate within explicit limits, and deliver a verifiable patch with evidence.

The ambition is to compete on measured task success, reliability, cost per successful task, recoverability, and trustworthiness—not on unsupported claims of being “unbeatable.” The system may use leading external coding models; it does not need to train a foundation model to deliver strong engineering outcomes.

## 2. Product principles

1. **Evidence over confidence:** a claim of completion requires reproducible validation evidence.
2. **Policy before model:** deterministic authorization and safety controls must not depend on model obedience.
3. **Least privilege:** each task receives only the repository, tools, credentials, network access, and time it needs.
4. **Isolation by default:** workers use disposable, isolated workspaces once the workspace lifecycle is implemented and verified.
5. **Human approval for irreversible or high-impact actions:** production deploys, protected-branch merges, secret access, paid-resource activation, and sensitive data operations remain gated.
6. **Model-agnostic interfaces:** provider adapters can change without rewriting task lifecycle or policy.
7. **Failure is a first-class state:** timeouts, partial writes, worker crashes, quota exhaustion, and inconclusive tests are recorded explicitly.
8. **No silent scope expansion:** an agent must stop and request approval when requirements or permissions are insufficient.
9. **Auditable provenance:** task, model/provider, prompt/config version, tool calls, changed files, test commands, results, and approval decisions are linked without logging secrets.
10. **Separate software correctness from domain authority:** passing tests does not validate medical, legal, or Islamic scholarly conclusions.

## 3. Target architecture

```text
Issue / Human Request
        |
        v
Task Intake + Specification
  - acceptance criteria
  - risk classification
  - budget / time / tool limits
        |
        v
Policy & Authorization Gate  <---- deterministic rules / approval records
        |
        v
Planner + Task Decomposer
        |
        v
Context Engine
  - repo map / symbol search / dependency graph
  - relevant docs / tests / prior task summaries
        |
        v
Model Router <---- Provider Registry / Health / Quota / Cost / Capability
        |
        v
Agent Runtime / Tool Broker
  - read / patch / terminal / tests / git
  - bounded retries / cancellation / checkpoints
        |
        v
Disposable Task Workspace
        |
        v
Validation Gate
  - focused tests / full required suites
  - lint / typecheck / build / security
  - diff / scope / secret checks
        |
        v
Independent Reviewer
        |
        +---- FAIL ----> bounded repair loop or BLOCKED
        |
        v
Human Approval Gate (risk-dependent)
        |
        v
Patch / Draft PR + Evidence Bundle
        |
        v
Audit Trail + Metrics + Benchmark Store
```

This diagram is a target state. Components must be marked implemented only after code inspection and tests confirm them.

## 4. Core subsystems

### 4.1 Task contract

Every task must contain:
- immutable task ID and source;
- objective and non-goals;
- acceptance criteria;
- allowed and prohibited paths/actions;
- risk tier and approval requirements;
- validation commands and expected evidence;
- budget, wall-clock timeout, retry/repair limit;
- dependencies and workspace identity;
- terminal status and reason.

Suggested lifecycle:

`BACKLOG -> READY -> CLAIMED -> PLANNING -> IMPLEMENTING -> VALIDATING -> REVIEWING -> APPROVAL_REQUIRED -> COMPLETE`

Failure transitions must be explicit: `BLOCKED`, `FAILED`, `CANCELLED`, or `NEEDS_HUMAN`. Terminal state changes must be auditable and concurrency-safe.

### 4.2 Model router

Use adapters behind a stable interface. Route using measured capability by task class, context capacity, provider health, latency, quota, cost, data-handling policy, and explicit user constraints. Use bounded retries, exponential backoff with jitter, circuit breakers, and a deterministic fallback order.

Never assume a provider is free, available, or permitted. Never silently fall back to a paid provider. Do not send sensitive source code or secrets to a provider unless policy and authorization explicitly permit it.

### 4.3 Context engine

Build context incrementally:
1. inspect repository instructions and working-tree state;
2. identify task-relevant files through lexical and symbol search;
3. map callers, tests, dependencies, and public interfaces;
4. retrieve relevant architecture decisions and prior failures;
5. summarize only when context pressure requires it;
6. preserve a compact, structured task state across restarts.

Retrieval quality should be measured. Embeddings or a vector database are optional, not automatic prerequisites; begin with existing search tools and add complexity only when benchmark evidence shows a need.

### 4.4 Tool broker and runtime

All tool execution must pass through a broker that enforces:
- command and filesystem permissions;
- workspace containment;
- timeouts, output caps, and cancellation;
- environment-variable filtering;
- network egress policy;
- process-tree termination;
- safe handling of untrusted tool output;
- complete but redacted audit events.

Treat repository files, issue descriptions, web pages, test output, and model-generated content as untrusted data. They cannot override trusted policy or grant themselves new permissions.

### 4.5 Workspace and Git lifecycle

Target behavior:
- one disposable workspace per worker/task;
- explicit base commit and clean starting state;
- no shared mutable checkout among parallel workers;
- path traversal and symlink escape checks;
- checkpoint before risky operations;
- isolated branch per task;
- diff and changed-path allowlist validation;
- no automatic push, merge, or deploy unless a separate policy explicitly authorizes it;
- deterministic cleanup and recoverable crash handling.

Do not enable parallel execution until workspace isolation and lock/recovery behavior have integration-test evidence.

### 4.6 Validation and review

Validation is task-specific and layered:
1. formatting and static checks;
2. focused regression tests;
3. affected subsystem tests;
4. full repository gates when required;
5. security and policy tests;
6. diff and scope review;
7. independent review for non-trivial changes.

A green test suite is necessary but not sufficient. Reviewers must inspect test quality, missing coverage, dangerous side effects, dependency changes, and whether the change actually satisfies the acceptance criteria.

### 4.7 Memory and learning

Persist reusable engineering knowledge as versioned artifacts:
- repository architecture map;
- known build/test commands;
- validated coding conventions;
- failure signatures and successful fixes;
- benchmark results by model/configuration;
- decisions and their evidence.

Do not turn unverified model claims into trusted memory. Memory updates require provenance and should be reversible.

### 4.8 Observability and cost controls

Track:
- success rate by task class and difficulty;
- first-pass success and repair count;
- regressions and revert rate;
- human intervention rate;
- latency and token/provider spend;
- tool failures, timeout rates, and recovery outcomes;
- policy denials and security-test outcomes.

Set hard per-task and monthly budgets. Stop rather than loop indefinitely. Log secret-safe metadata, not raw credentials or unnecessarily sensitive source content.

## 5. Risk tiers

| Tier | Examples | Required control |
|---|---|---|
| R0 — Read-only | Repository exploration, documentation analysis | Read-only tools; no secrets |
| R1 — Reversible patch | Tests, docs, isolated bug fix | Disposable workspace, tests, review |
| R2 — Broad code change | Multi-module refactor, dependency update | Expanded validation, independent review, approval as configured |
| R3 — High impact | Auth/security changes, data migrations, protected workflows | Explicit human approval, security review, rollback plan |
| R4 — External/irreversible | Production deployment, production data mutation, secret rotation | Separate explicit authorization and operational runbook; never inferred from task completion |

Risk tiers are policy inputs, not labels the model can assign to bypass restrictions.

## 6. Evaluation strategy

Create a versioned benchmark set with:
- bug fixes;
- multi-file feature work;
- test repairs;
- refactoring with behavior preservation;
- dependency and build failures;
- security regressions;
- ambiguous tasks requiring clarification;
- prompt injection and permission-boundary attempts;
- crash/recovery and concurrent-claim cases.

Each benchmark task needs a frozen starting commit, task prompt, acceptance criteria, hidden or independent checks where practical, resource limits, and expected risk tier.

Report at least:
- verified task success rate;
- regression rate;
- first-pass success;
- cost per verified successful task;
- median and p95 completion time;
- human intervention rate;
- security policy violation rate;
- reproducibility across repeated runs.

Do not compare models using different task sets or validation rules. Do not tune only against the public benchmark set; retain held-out tasks.

## 7. Delivery strategy

Prefer the smallest proven system:
- reuse an established coding-agent runtime where it materially reduces risk;
- build VitaNusa-specific orchestration, policy, evaluation, context, and audit capabilities around it;
- avoid multi-agent complexity until a single-agent baseline is measured;
- add parallel workers only when independent tasks and workspace isolation justify them;
- avoid fine-tuning or foundation-model training until evaluation demonstrates a specific capability gap that simpler approaches cannot close.

## 8. Non-goals

This plan does not promise parity with Codex or DeepSeek, unrestricted autonomous operation, guaranteed bug-free code, or a self-improving system that can safely change its own governance. Those claims require evidence and, in some cases, are not realistic engineering guarantees.

## 9. Definition of done for the platform

The platform may be considered ready for a limited supervised pilot only when:
- task lifecycle and permissions are enforced in code;
- workspace isolation and process cleanup are verified;
- prompt injection, secret redaction, and crash recovery have adversarial integration tests;
- model routing and cost limits are observable and enforceable;
- benchmark performance is measured on held-out tasks;
- failed/inconclusive validation blocks completion;
- human approval gates are tested;
- audit evidence can reconstruct what happened without exposing secrets;
- a documented rollback and incident response process exists.

Production authorization remains a separate decision and is not granted by this document.
