#!/usr/bin/env python3
"""Reject suspicious bidirectional and zero-width controls in tracked text files."""

from __future__ import annotations

import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path


TEXT_SUFFIXES = frozenset(
    {
        ".yml",
        ".yaml",
        ".json",
        ".js",
        ".mjs",
        ".cjs",
        ".py",
        ".html",
        ".css",
        ".md",
    }
)

ZERO_WIDTH_CODE_POINTS = frozenset(
    {
        0x200B,  # ZERO WIDTH SPACE
        0x200C,  # ZERO WIDTH NON-JOINER
        0x200D,  # ZERO WIDTH JOINER
        0x2060,  # WORD JOINER
        0xFEFF,  # ZERO WIDTH NO-BREAK SPACE / byte-order mark
    }
)


@dataclass(frozen=True)
class Finding:
    """Location and identity of one suspicious Unicode control."""

    path: Path
    line: int
    column: int
    code_point: int
    name: str

    def format(self) -> str:
        """Return a concise report without exposing surrounding file content."""

        return (
            f"{self.path}:{self.line}:{self.column}: "
            f"U+{self.code_point:04X} {self.name}"
        )


def get_tracked_files() -> list[Path]:
    """Return tracked repository files whose suffix indicates supported text."""

    result = subprocess.run(
        ["git", "ls-files", "-z"],
        check=True,
        capture_output=True,
    )
    paths: list[Path] = []

    for raw_path in result.stdout.split(b"\0"):
        if not raw_path:
            continue

        path = Path(raw_path.decode("utf-8", errors="surrogateescape"))
        if path.suffix.lower() in TEXT_SUFFIXES:
            paths.append(path)

    return paths


def is_suspicious(code_point: int) -> bool:
    """Return whether a code point can conceal or reorder source text."""

    return (
        code_point in ZERO_WIDTH_CODE_POINTS
        or 0x202A <= code_point <= 0x202E
        or 0x2066 <= code_point <= 0x2069
    )


def find_suspicious_characters(path: Path) -> list[Finding]:
    """Inspect one tracked UTF-8 text file and return suspicious controls."""

    if path.is_symlink():
        return []

    try:
        raw_content = path.read_bytes()
    except OSError:
        return []

    if b"\0" in raw_content:
        return []

    try:
        text = raw_content.decode("utf-8")
    except UnicodeDecodeError:
        return []

    findings: list[Finding] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for column, character in enumerate(line, start=1):
            code_point = ord(character)
            if not is_suspicious(code_point):
                continue

            findings.append(
                Finding(
                    path=path,
                    line=line_number,
                    column=column,
                    code_point=code_point,
                    name=unicodedata.name(character, "UNKNOWN"),
                )
            )

    return findings


def main() -> int:
    """Scan tracked text files and return nonzero when controls are found."""

    try:
        tracked_files = get_tracked_files()
    except (OSError, subprocess.CalledProcessError) as error:
        print(
            f"Unable to list tracked files with Git: {error}",
            file=sys.stderr,
        )
        return 2

    findings = [
        finding
        for path in tracked_files
        for finding in find_suspicious_characters(path)
    ]

    if findings:
        for finding in findings:
            print(finding.format(), file=sys.stderr)
        print(
            f"Suspicious Unicode check failed: {len(findings)} control(s) found. "
            "Review and remove or explicitly replace them before merging.",
            file=sys.stderr,
        )
        return 1

    print(
        "Suspicious Unicode check passed: "
        f"{len(tracked_files)} tracked text file(s) inspected."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
