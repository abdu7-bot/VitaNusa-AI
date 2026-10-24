# T008 — Autonomous Coding Platform Roadmap Execution

**Status:** READY FOR IMPLEMENTATION  
**Priority:** P0  
**Type:** Security / architecture verification / benchmark foundation  
**Target branch for this planning package:** `codex/autonomous-coding-master-plan`

## Objective

Use the approved master architecture and phased roadmap to evolve VitaNusa AI into a reliable, measurable coding-agent platform. The immediate implementation target is Phase 8.14, not an unrestricted autonomous coding loop.

## Required reading

1. `docs/architecture/AUTONOMOUS-CODING-MASTER-PLAN.md`
2. `docs/roadmaps/AUTONOMOUS-CODING-ROADMAP.md`
3. `.agents/AGENTS.md`
4. `.agents/ARCHITECTURE.md`
5. `.agents/RULES.md`
6. `.agents/WORKFLOW.md`
7. `docs/orchestration/README.md`
8. Existing Phase 8.13 implementation and tests.

## First execution steps

1. Verify the actual repository, branch, HEAD, working tree, and baseline ancestry. The Phase 8.13 SHA reported in its final report is `638c354b4fa1d0402c6a152b4f5014e7f3e46886`; do not assume it is the current branch head.
2. Inspect current code and task records before changing architecture.
3. Create a dedicated implementation branch from the verified baseline.
4. Build a gap matrix mapping each Phase 8.14 acceptance criterion to code paths and tests.
5. Implement prompt-injection fixtures and enforcement-boundary tests.
6. Expand secret-redaction integration tests for journal, checkpoint, subprocess output, and persisted errors.
7. Expand real-subprocess claim tests for contention, crash recovery, and stale-lock behavior only where the existing contract supports it.
8. Run focused tests, the complete relevant agent suite, backend/frontend suites, repository safety checks, and applicable security scans.
9. Produce a report with exact commands, exit codes, test counts, commit SHA, CI URL, and limitations.

## Safety constraints

- Do not run a live worker or use Kilo Gateway credentials.
- Do not access production services or data.
- Do not merge into `main` or deploy.
- Preserve `enabled=false` and `mode=AUDIT`.
- Do not run `npm audit fix --force`.
- Do not upgrade major dependencies without explicit human approval.
- Do not mark Islamic scholarly review complete without qualified, documented review.
- Do not treat documentation-only changes as implementation completion.
- Do not weaken security policy to make tests pass.

## Definition of done

- All acceptance criteria have reproducible evidence or are explicitly marked open.
- Security controls are tested at enforcement boundaries, not only through prompt wording.
- Required validation failures prevent a PASS verdict.
- The final report distinguishes implementation, unit tests, integration tests, and real-world validation.
- The branch remains unmerged and production authorization remains withheld.
