# VitaNusa AI — Autonomous Coding Roadmap

**Status:** Proposed roadmap  
**Related architecture:** [Autonomous Coding Master Architecture](../architecture/AUTONOMOUS-CODING-MASTER-PLAN.md)  
**Starting evidence:** Phase 8.13 report, which reports 137 agent tests passing and two real-subprocess concurrency tests. Those results have not been independently re-run as part of this document change.  
**Rule:** A phase is complete only when its exit criteria have reproducible evidence. Documentation alone never closes an implementation task.

## Strategic objective

Build a coding agent that performs strongly on measured repository tasks while remaining secure, economical, recoverable, and reviewable. “Unmatched” is an aspiration, not a verifiable milestone. The competitive target is measured against fixed benchmark tasks and equivalent validation.

## Phase map

| Phase | Theme | Status at roadmap creation | Exit gate |
|---|---|---|---|
| 8.14 | Adversarial security and recovery verification | Planned | Prompt-injection fixtures, broader secret-redaction coverage, crash/stale-lock tests |
| 9.0 | Reproducible coding benchmark | Planned | Frozen task set, baseline model/runtime metrics, repeatable evaluation |
| 9.1 | Agent loop reliability | Planned | Bounded plan-edit-test-repair loop with explicit stop conditions |
| 9.2 | Context and repository intelligence | Planned | Measured retrieval/context improvement without regressions |
| 9.3 | Runtime, sandbox, and workspace lifecycle | Planned | Isolated task workspaces, cancellation, cleanup, permission tests |
| 9.4 | Model routing and cost governance | Planned | Provider adapters, health/quota/cost policy, no silent paid fallback |
| 9.5 | Independent verification and review | Planned | Risk-aware validation gates and tested approval workflow |
| 9.6 | Controlled parallel workers | Planned | Multiple isolated workers, conflict detection, safe integration |
| 9.7 | Supervised pilot | Blocked until gates pass | Held-out benchmark results, security sign-off, human-approved pilot |
| 10.0 | Continuous evaluation and optimization | Future | Regression-aware evaluation and evidence-based model/runtime improvements |

Phases may overlap only where dependencies are satisfied. Phase numbers describe roadmap sequencing, not proof of implementation.

## Phase 8.14 — Adversarial security and recovery

### Work
- Add prompt-injection fixtures for repository content, issue text, tool output, and indirect instructions.
- Test real enforcement boundaries: filesystem escape, unauthorized commands, credential exfiltration attempts, protected branch and deployment actions.
- Extend redaction coverage to journal, checkpoint, subprocess output, exceptions, and persisted failure reports.
- Add subprocess tests for more than two competing workers, crash-after-claim, stale-lock behavior if supported, timeout, and recovery.
- Preserve safe defaults and approval gates.

### Acceptance criteria
- Each fixture records expected and observed outcomes.
- Unauthorized actions are blocked at the execution/policy boundary, not only flagged by a classifier.
- Synthetic secrets are absent from all covered persisted outputs.
- Crash/recovery tests are deterministic, bounded, and repeatable.
- Unsupported recovery behavior is documented as a design gap rather than hidden by test assumptions.
- CI runs focused tests and the relevant full suites.

### Blockers
No live worker, production credentials, production data, merge, or deployment is needed or authorized for this phase.

## Phase 9.0 — Benchmark before optimization

### Work
- Define 30–50 representative initial tasks, then expand to at least 100 as the harness matures.
- Include bug fixes, multi-file features, refactoring, test repairs, build/dependency failures, and adversarial tasks.
- Freeze baseline commits and acceptance criteria.
- Compare candidate model/runtime configurations on the same tasks and budgets.
- Keep a held-out set that is not used to tune prompts.

### Acceptance criteria
- Every task has an objective verification method.
- Report task success, regression rate, first-pass success, repair attempts, cost per verified success, and median/p95 time.
- Failed and inconclusive runs are counted transparently.
- Results are reproducible from recorded configuration and task artifacts.
- A baseline report identifies the highest-value bottlenecks before major redesign.

## Phase 9.1 — Reliable agent loop

### Work
- Implement explicit states: inspect, plan, edit, validate, diagnose, repair, review, stop.
- Add bounded retries, cancellation, timeouts, and loop detection.
- Keep a structured task state and record why each iteration continues or stops.
- Require acceptance criteria and test evidence before declaring completion.

### Acceptance criteria
- Repeated identical failures trigger a stop or escalation rather than unbounded retries.
- Cancellation terminates child processes and leaves the repository recoverable.
- Every completion links to validation evidence.
- Benchmark results improve without increasing regressions beyond the agreed threshold.

## Phase 9.2 — Repository context intelligence

### Work
- Build repository maps and language-aware symbol/reference search.
- Retrieve related tests, callers, dependencies, instructions, and architecture decisions.
- Summarize context with provenance and preserve task decisions across restarts.
- Compare lexical/symbol search against optional semantic retrieval.

### Acceptance criteria
- Context selection is traceable to task relevance.
- Held-out tasks demonstrate measurable improvement or the additional retrieval layer is not adopted.
- Stale or untrusted memory cannot override current repository policy.
- No vector database or embedding infrastructure is added without evidence of benefit.

## Phase 9.3 — Runtime and workspace isolation

### Work
- Establish one disposable workspace per task/worker.
- Enforce path containment, symlink safety, environment filtering, output caps, network policy, process-tree cleanup, and timeout handling.
- Add checkpoints and deterministic cleanup after success, failure, cancellation, and crash.
- Keep Git push, merge, and deployment outside the default worker permission set.

### Acceptance criteria
- Parallel workers never share a mutable checkout.
- Integration tests prove workspace boundaries and cleanup.
- Unauthorized filesystem and network actions are denied by deterministic controls.
- Recovery procedures are documented and tested.

## Phase 9.4 — Model routing and cost governance

### Work
- Introduce provider adapters and a model capability registry.
- Track availability, rate limits, quota, latency, cost, context capacity, and data-use constraints.
- Add bounded retry/backoff, circuit breakers, and explicit fallback order.
- Provide per-task and monthly budget ceilings.

### Acceptance criteria
- Routing decisions are logged without secrets.
- Paid fallback is never enabled silently.
- Quota exhaustion and provider outage lead to a controlled stop or authorized fallback.
- Model selection is justified by benchmark results, not brand assumptions.

## Phase 9.5 — Independent verification and review

### Work
- Use task-class-specific test requirements.
- Review diffs, changed-path scope, dependency changes, test coverage, and security implications.
- Keep implementer and reviewer roles logically separated for meaningful independent review.
- Test human approval requirements for high-risk changes.

### Acceptance criteria
- Missing, failed, skipped, or inconclusive required checks cannot produce a false PASS.
- High-risk changes require the configured approval record.
- Review feedback and remediation are auditable.
- Passing tests are not represented as proof of domain-specific scholarly or professional authority.

## Phase 9.6 — Controlled parallel workers

### Work
- Begin with independent, low-risk tasks only.
- Give each worker an isolated workspace, explicit task contract, and budget.
- Detect overlapping file ownership and merge conflicts.
- Integrate only after per-task validation and an integration-level test pass.

### Acceptance criteria
- Contention, worker crashes, duplicate claims, cancellation, and conflict recovery are covered by integration tests.
- Parallel execution improves throughput or cost on the benchmark without worsening correctness or security.
- If concurrency has no measured benefit, keep the simpler sequential design.

## Phase 9.7 — Supervised pilot

### Preconditions
- Prior phase exit gates pass.
- Security and operational review completed.
- Held-out benchmark results and limitations documented.
- Explicit human approval for pilot scope, credentials, budget, and environment.

### Pilot boundaries
- Non-production repositories or disposable forks.
- Least-privilege credentials, preferably none for initial tests.
- No autonomous production deploy or protected-branch merge.
- Hard limits on runtime, cost, tool calls, and repair attempts.
- Immediate cancellation and rollback procedure.

### Exit criteria
- Agreed reliability thresholds are met on a held-out task set.
- No unresolved critical security findings.
- Incident and rollback drills succeed.
- Human reviewers can reconstruct each task from redacted evidence.

## Phase 10.0 — Evidence-based optimization

Optimize one bottleneck at a time:
1. classify failure causes;
2. choose the smallest intervention;
3. run a controlled benchmark comparison;
4. inspect regressions and cost;
5. keep, revert, or revise based on evidence.

Candidate improvements include better task specifications, retrieval, test selection, model routing, repair strategies, caching, and specialized agents. Multi-agent debate, fine-tuning, and foundation-model training are not defaults; they require evidence that expected benefits exceed added cost and complexity.

## Global stop conditions

Stop and mark the task `BLOCKED` or `NEEDS_HUMAN` when:
- credentials or approval are missing;
- acceptance criteria are ambiguous;
- required validation cannot run;
- a security boundary is uncertain or violated;
- budget or retry limits are reached;
- the working tree or task ownership cannot be established;
- evidence contradicts the claimed result.

## Progress tracking template

For every phase, record:
- Status: `planned | in_progress | partial | blocked | completed`
- Owner and task ID
- Baseline and final commit SHA
- Scope and non-goals
- Tests and exact commands
- CI run and platform
- Measured results
- Known limitations
- Reviewer/approval record where required

## Current next action

Start Phase 8.14 on a dedicated branch. Verify repository provenance first, then implement adversarial tests and recovery evidence. Do not run a live worker or grant production authorization as part of Phase 8.14.
