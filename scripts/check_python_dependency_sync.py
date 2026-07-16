from __future__ import annotations

import re
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PYPROJECT_PATH = REPOSITORY_ROOT / "pyproject.toml"
REQUIREMENTS_PATH = REPOSITORY_ROOT / "backend" / "requirements.txt"

_NAME_PATTERN = re.compile(
    r"^(?P<name>[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)"
    r"\s*(?:\[\s*(?P<extras>[^\]]+)\s*\])?\s*(?P<remainder>.*)$"
)
_EXTRA_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$")
_SPECIFIER_PATTERN = re.compile(
    r"^(?P<operator>===|~=|==|!=|<=|>=|<|>)\s*(?P<version>[^\s,;]+)$"
)
_UNSUPPORTED_PREFIXES = (
    "-",
    "git+",
    "http://",
    "https://",
    "ftp://",
    "file:",
)


class ManifestError(ValueError):
    """Raised when a dependency manifest cannot be compared safely."""


@dataclass(frozen=True)
class Requirement:
    name: str
    extras: tuple[str, ...]
    specifiers: tuple[str, ...]
    marker: str | None

    @property
    def normalized(self) -> str:
        extras = f"[{','.join(self.extras)}]" if self.extras else ""
        specifiers = ",".join(self.specifiers)
        marker = f"; {self.marker}" if self.marker else ""
        return f"{self.name}{extras}{specifiers}{marker}"


@dataclass(frozen=True)
class Comparison:
    missing: tuple[Requirement, ...]
    additional: tuple[Requirement, ...]
    mismatches: tuple[tuple[str, Requirement, Requirement], ...]

    @property
    def in_sync(self) -> bool:
        return not (self.missing or self.additional or self.mismatches)


def _canonicalize_component(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def _strip_inline_comment(line: str) -> str:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return ""

    comment = re.search(r"\s+#", line)
    if comment:
        line = line[: comment.start()]
    return line.strip()


def parse_requirement(raw_requirement: str, *, source: str) -> Requirement:
    requirement = _strip_inline_comment(raw_requirement)
    if not requirement:
        raise ManifestError(f"Empty dependency entry in {source}.")

    lowered = requirement.lower()
    if lowered.startswith(_UNSUPPORTED_PREFIXES) or re.search(r"\s@\s", requirement):
        raise ManifestError(
            f"Unsupported requirement directive or URL in {source}: {requirement}"
        )

    match = _NAME_PATTERN.fullmatch(requirement)
    if not match:
        raise ManifestError(f"Invalid requirement in {source}: {requirement}")

    name = _canonicalize_component(match.group("name"))
    extras: tuple[str, ...] = ()
    raw_extras = match.group("extras")
    if raw_extras:
        parsed_extras = []
        for raw_extra in raw_extras.split(","):
            extra = raw_extra.strip()
            if not _EXTRA_PATTERN.fullmatch(extra):
                raise ManifestError(f"Invalid extra in {source}: {requirement}")
            parsed_extras.append(_canonicalize_component(extra))
        extras = tuple(sorted(set(parsed_extras)))

    remainder = match.group("remainder").strip()
    raw_specifiers, separator, raw_marker = remainder.partition(";")
    marker = None
    if separator:
        marker = re.sub(r"\s+", " ", raw_marker.strip()).lower()
        if not marker:
            raise ManifestError(f"Empty environment marker in {source}: {requirement}")

    specifiers = []
    if raw_specifiers.strip():
        for raw_specifier in raw_specifiers.split(","):
            specifier_match = _SPECIFIER_PATTERN.fullmatch(raw_specifier.strip())
            if not specifier_match:
                raise ManifestError(f"Invalid version specifier in {source}: {requirement}")
            operator = specifier_match.group("operator")
            version = specifier_match.group("version").lower()
            specifiers.append(f"{operator}{version}")

    return Requirement(
        name=name,
        extras=extras,
        specifiers=tuple(sorted(specifiers)),
        marker=marker,
    )


def _build_requirement_map(
    entries: list[str],
    *,
    source: str,
) -> dict[str, Requirement]:
    requirements: dict[str, Requirement] = {}
    for entry in entries:
        requirement = parse_requirement(entry, source=source)
        if requirement.name in requirements:
            raise ManifestError(
                f"Duplicate dependency '{requirement.name}' in {source}."
            )
        requirements[requirement.name] = requirement
    return requirements


def read_pyproject_dependencies(path: Path) -> dict[str, Requirement]:
    if not path.is_file():
        raise ManifestError(f"pyproject.toml not found: {path}")

    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        raise ManifestError(f"Invalid TOML in {path}: {exc}") from exc

    project = data.get("project")
    dependencies = project.get("dependencies") if isinstance(project, dict) else None
    if not isinstance(dependencies, list):
        raise ManifestError(f"[project].dependencies is missing or invalid in {path}.")
    if not all(isinstance(entry, str) for entry in dependencies):
        raise ManifestError(f"Every [project].dependencies entry must be a string in {path}.")

    return _build_requirement_map(dependencies, source=str(path))


def read_requirements(path: Path) -> dict[str, Requirement]:
    if not path.is_file():
        raise ManifestError(f"backend/requirements.txt not found: {path}")

    entries = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        entry = _strip_inline_comment(line)
        if not entry:
            continue
        if entry.lower().startswith(_UNSUPPORTED_PREFIXES) or re.search(r"\s@\s", entry):
            raise ManifestError(
                f"Unsupported requirement directive or URL in {path}:{line_number}: {entry}"
            )
        entries.append(entry)

    return _build_requirement_map(entries, source=str(path))


def compare_requirements(
    primary: dict[str, Requirement],
    mirror: dict[str, Requirement],
) -> Comparison:
    missing_names = sorted(primary.keys() - mirror.keys())
    additional_names = sorted(mirror.keys() - primary.keys())
    shared_names = sorted(primary.keys() & mirror.keys())

    mismatches = tuple(
        (name, primary[name], mirror[name])
        for name in shared_names
        if primary[name].normalized != mirror[name].normalized
    )
    return Comparison(
        missing=tuple(primary[name] for name in missing_names),
        additional=tuple(mirror[name] for name in additional_names),
        mismatches=mismatches,
    )


def format_failure(comparison: Comparison) -> str:
    lines = ["Python dependency manifests are out of sync."]
    if comparison.missing:
        lines.extend(
            ["", "Missing from backend/requirements.txt:"]
            + [f"- {item.normalized}" for item in comparison.missing]
        )
    if comparison.additional:
        lines.extend(
            ["", "Additional in backend/requirements.txt:"]
            + [f"- {item.normalized}" for item in comparison.additional]
        )
    if comparison.mismatches:
        lines.extend(["", "Specifier or extras mismatch:"])
        for name, primary, mirror in comparison.mismatches:
            lines.extend(
                [
                    f"- {name}",
                    f"  pyproject.toml: {primary.normalized}",
                    f"  requirements.txt: {mirror.normalized}",
                ]
            )
    return "\n".join(lines)


def main() -> int:
    try:
        primary = read_pyproject_dependencies(PYPROJECT_PATH)
        mirror = read_requirements(REQUIREMENTS_PATH)
        comparison = compare_requirements(primary, mirror)
    except (ManifestError, OSError, UnicodeError) as exc:
        print(f"Python dependency manifest check failed: {exc}", file=sys.stderr)
        return 2

    if not comparison.in_sync:
        print(format_failure(comparison), file=sys.stderr)
        return 1

    print("Python dependency manifests are in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
