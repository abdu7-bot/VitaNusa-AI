# VitaNusa-AI — Agent Governance Validation

> Baseline governance contract for autonomous development. This document records what the repository requires from agents; it is not proof that a local runtime or every test has passed.

## 1. Governance contract

Agents must:

1. read `ROADMAP.md` and the applicable agent instructions before starting work;
2. inspect the current repository state before selecting a task;
3. work from a dedicated feature branch rather than directly on `main`;
4. keep one focused objective per branch/PR;
5. implement, test, security-check, and report before requesting merge;
6. avoid changing unrelated files;
7. protect user data and never downgrade persistence guarantees;
8. keep secrets out of source, logs, prompts, commits, and generated reports;
9. treat review as a separate control from implementation;
10. stop when a blocker or safety condition prevents a trustworthy continuation.

## 2. Agent roles

### Implementer

The implementation agent may modify code on its own feature branch. It owns the task execution and test evidence but does not self-authorize merge into `main`.

### Reviewer

The reviewer should be read-only with respect to the implementation branch until a review decision is made. It checks scope, tests, security, regressions, and roadmap compliance.

### Human approval

Changes involving secrets, destructive data operations, deployment, policy/fatwa decisions, or other explicitly protected actions require human authorization even when an agent can technically execute the command.

## 3. Required autonomous loop

```text
ROADMAP
  -> STATUS CHECK
  -> SELECT HIGHEST-PRIORITY ELIGIBLE TASK
  -> CREATE/USE FEATURE BRANCH
  -> IMPLEMENT
  -> TEST
  -> SECURITY CHECK
  -> REVIEW
  -> REPORT
  -> MERGE ONLY WHEN POLICY ALLOWS
  -> REFRESH STATUS
  -> SELECT NEXT TASK
```

The loop must not infer completion merely from a file existing or a command being available. Completion requires evidence appropriate to the task.

## 4. Stop conditions

An autonomous worker must stop and report when:

- the working tree contains unexpected user changes;
- the task scope conflicts with the roadmap or repository rules;
- required tests fail and the failure is not safely repairable within scope;
- a security regression is detected;
- a secret or sensitive value is exposed;
- a destructive migration or data-loss risk is discovered;
- the required reviewer/approval is unavailable;
- a provider quota or privacy rule would be violated;
- the next action would require guessing missing requirements.

## 5. Provider routing boundary

Model/provider routing is subordinate to repository governance. Free/paid status, quota, availability, and privacy must be checked before selecting a provider. No autonomous path may silently upgrade to a paid endpoint or send sensitive data to an unapproved cloud provider.

## 6. Current validation status

| Area | Repository evidence | Runtime evidence | Status |
|---|---|---|---|
| Master roadmap | `ROADMAP.md` | Not established here | Defined |
| Agent instructions | `.agents/` and repository agent docs | Not established here | Defined |
| Task queue | `tasks/` | Not established here | Defined |
| Branch/PR workflow | documented by repository governance | PR workflow exists | Defined |
| Automated test contract | `package.json` scripts | Must be run in target environment | Defined, not proof of pass |
| Autonomous loop | governance contract above | Not yet implemented as an unattended controller | **NOT IMPLEMENTED** |

## 7. T002 conclusion

The governance contract is sufficiently explicit to serve as the policy layer for the next automation work. The autonomous controller itself must remain a separate implementation task.

**Important:** this document does not claim that all repository tests are green, that local Android/Termux execution is verified, or that autonomous development is already operational.
