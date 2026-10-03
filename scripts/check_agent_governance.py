#!/usr/bin/env python3
"""Verify that the agent governance contract is present and internally consistent.

This is a documentation guard, not an orchestrator. It does not schedule work,
does not lock files, and does not read secrets. It only checks that the
governance documents required by `tasks/TODO.md` still declare the contract
items that agents depend on.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent

CANONICAL_WORKSPACE = "/root/VitaNusa-AI"
READ_ONLY_SECONDARY = "/home/vita/VitaNusa-AI"

AGENT_FLOW = (
    "PLAN\n"
    "  ↓\n"
    "IMPLEMENT\n"
    "  ↓\n"
    "VALIDATE\n"
    "  ↓\n"
    "REVIEW\n"
    "  ↓\n"
    "COMMIT\n"
    "  ↓\n"
    "DONE"
)

STOP_CONDITIONS = (
    "Scope task tidak jelas",
    "Requirement bertentangan",
    "keluar dari scope",
    "tanpa otorisasi",
    "penyebab belum dipahami",
    "konflik arsitektur",
    "keputusan manusia",
)

TASK_CLASSES = (
    "Documentation-only",
    "Test-only",
    "Production-code",
    "Architecture decision",
)

REVIEW_CHECKLIST = (
    "**Scope**",
    "**Correctness**",
    "**Regression**",
    "**Architecture consistency**",
    "**Documentation consistency**",
    "**Git diff**",
)

PROTECTED_AREAS = (
    "chat UI Nusa AI",
    "logika VitaCheck",
    "Firestore rules",
    "service worker",
)

REQUIRED_FILES = (
    ".agents/AGENTS.md",
    ".agents/RULES.md",
    ".agents/WORKFLOW.md",
    ".agents/ARCHITECTURE.md",
    "tasks/TODO.md",
    "tasks/BACKLOG.md",
    "tasks/active",
)

REQUIRED_ANCHORS: dict[str, tuple[str, ...]] = {
    ".agents/AGENTS.md": (
        CANONICAL_WORKSPACE,
        READ_ONLY_SECONDARY,
        "Canonical workspace",
        "Read-only secondary copy",
        "Planner",
        "Implementer",
        "Reviewer",
        AGENT_FLOW,
        *STOP_CONDITIONS,
        *TASK_CLASSES,
        "Area terlindungi",
        *PROTECTED_AREAS,
    ),
    ".agents/RULES.md": (
        CANONICAL_WORKSPACE,
        READ_ONLY_SECONDARY,
        "Scope dan traceability",
        "Task class",
        "Production code",
        "Anti-tabrakan antar agent",
        "tidak menambah scope",
        *PROTECTED_AREAS,
    ),
    ".agents/WORKFLOW.md": (
        "BACKLOG → READY → ACTIVE → TESTING → REVIEW → DONE",
        "ACTIVE → BLOCKED",
        "TESTING → FAILED",
        "Claim dan anti-tabrakan",
        "**Claimed files:**",
        "Validasi per kelas task",
        *REVIEW_CHECKLIST,
    ),
    ".agents/ARCHITECTURE.md": (
        CANONICAL_WORKSPACE,
        READ_ONLY_SECONDARY,
        "Lapisan governance",
        "Proteksi production code",
        *PROTECTED_AREAS,
    ),
    "tasks/TODO.md": (
        "Autonomous completion rule",
        "READY → ACTIVE → TESTING → REVIEW → DONE",
    ),
}

TASK_LINE_PATTERN = re.compile(r"^-\s*\[[ xX]\]\s+(?P<body>.*)$")
TASK_ID_PATTERN = re.compile(r"^T\d{3}\b")
TASK_ID_CANDIDATE_PATTERN = re.compile(r"^T\d")


@dataclass(frozen=True)
class Finding:
    """One violated governance expectation."""

    location: str
    message: str

    def format(self) -> str:
        return f"{self.location}: {self.message}"


def read_text(relative_path: str) -> str | None:
    """Return file content, or None when it cannot be read as UTF-8 text."""

    path = REPO_ROOT / relative_path
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def check_required_files() -> list[Finding]:
    """Return findings for governance paths that are missing."""

    findings: list[Finding] = []
    for relative_path in REQUIRED_FILES:
        if not (REPO_ROOT / relative_path).exists():
            findings.append(Finding(relative_path, "required governance path is missing"))
    return findings


def check_anchors() -> list[Finding]:
    """Return findings for governance documents missing contract anchors."""

    findings: list[Finding] = []
    for relative_path, anchors in REQUIRED_ANCHORS.items():
        content = read_text(relative_path)
        if content is None:
            findings.append(Finding(relative_path, "cannot read as UTF-8 text"))
            continue
        for anchor in anchors:
            if anchor not in content:
                findings.append(
                    Finding(relative_path, f"missing required contract item: {anchor!r}")
                )
    return findings


def check_task_lines() -> list[Finding]:
    """Return findings for malformed task entries in the task queue."""

    findings: list[Finding] = []
    for relative_path in ("tasks/TODO.md", "tasks/BACKLOG.md"):
        content = read_text(relative_path)
        if content is None:
            continue
        for line_number, line in enumerate(content.splitlines(), start=1):
            if not line.lstrip().startswith("-") or "[" not in line:
                continue
            match = TASK_LINE_PATTERN.match(line)
            if match is None:
                findings.append(
                    Finding(
                        f"{relative_path}:{line_number}",
                        "task checkbox must be one of '- [ ]', '- [x]', or '- [X]'",
                    )
                )
                continue
            body = match.group("body")
            if TASK_ID_CANDIDATE_PATTERN.match(body) and not TASK_ID_PATTERN.match(body):
                findings.append(
                    Finding(
                        f"{relative_path}:{line_number}",
                        f"task id must use the TNNN form: {body!r}",
                    )
                )
    return findings


def main() -> int:
    """Run every governance check and return nonzero when one fails."""

    findings = [*check_required_files(), *check_anchors(), *check_task_lines()]

    if findings:
        for finding in findings:
            print(finding.format(), file=sys.stderr)
        print(
            f"Agent governance check failed: {len(findings)} violation(s) found.",
            file=sys.stderr,
        )
        return 1

    checked_files = len(REQUIRED_FILES)
    checked_anchors = sum(len(anchors) for anchors in REQUIRED_ANCHORS.values())
    print(
        "Agent governance check passed: "
        f"{checked_files} governance path(s) present, "
        f"{checked_anchors} contract item(s) declared."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
