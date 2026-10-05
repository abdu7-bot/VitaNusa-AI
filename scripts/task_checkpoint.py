#!/usr/bin/env python3
"""Checkpoint and rollback for autonomous coding tasks (T004).

This is repository tooling, not runtime application code. Nothing in the
application imports it and CI never runs it. It is invoked explicitly by an
agent that is about to make a risky change, per `.agents/RULES.md` Git rules.

Design constraints that come from governance, not from preference:

1. **Content snapshot, not history manipulation.** Checkpoints copy the bytes of
   the explicitly scoped paths into a store outside the working tree and restore
   those bytes back. The tool never runs `git reset --hard`, `git clean`,
   `git checkout --`, force-push, or any other destructive Git command. The only
   Git commands used are read-only: `rev-parse HEAD`, `branch --show-current`,
   and `status --porcelain`.
2. **Explicit scope.** Only paths named on the command line are snapshotted and
   only paths recorded in the manifest are restored. Paths outside the
   repository, directories, and secret-bearing files are refused.
3. **The store is never inside the repository.** Checkpoint artefacts must not
   appear in `git status` and must not be able to be committed by accident.
4. **Rollback failure is never hidden.** A rollback that cannot finish raises
   `RollbackError` with `status` `failed` or `partial`, the failed paths, and
   `manual_intervention_required: true`. The CLI turns that into a dedicated
   non-zero exit code. There is no path in this module where a failed rollback
   is reported as success.
5. **BLOCKED must not leave uncontrolled changes.** `blocked_check` reports
   scoped paths that still differ from their checkpoint, from HEAD, or from the
   committed tree, and exits non-zero. Resolving that is either restoring the
   checkpoint or recording an explicit acknowledgement. This is enforcement of
   the existing governance rules, not a new approval gate.

Usage:

    python3 scripts/task_checkpoint.py create --task T004 --path docs/a.md
    python3 scripts/task_checkpoint.py list
    python3 scripts/task_checkpoint.py verify --id CP-...
    python3 scripts/task_checkpoint.py restore --id CP-... --reason manual
    python3 scripts/task_checkpoint.py run-validation --id CP-... -- python3 -m unittest
    python3 scripts/task_checkpoint.py rollback --id CP-... --cause worker-failure
    python3 scripts/task_checkpoint.py blocked-check --task T004 --path docs/a.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable, Sequence

SCHEMA = "vitanusa.checkpoint.v1"
DEFAULT_STORE = Path.home() / ".local" / "state" / "vitanusa-agent" / "checkpoints"
ID_PREFIX = "CP"

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2
EXIT_ROLLBACK_FAILED = 3
EXIT_BLOCKED = 4
EXIT_DRIFT = 5

SENSITIVE_NAMES = {".env", ".env.local", ".env.production"}
SENSITIVE_SUFFIXES = {".pem", ".key"}

RESTORE_REASONS = ("manual", "worker-failure", "validation-failure", "blocked")
ROLLBACK_CAUSES = ("worker-failure", "validation-failure", "blocked")


class CheckpointError(Exception):
    """A checkpoint or restore request cannot be honoured as asked."""


class RollbackError(CheckpointError):
    """A rollback started but did not fully succeed.

    This exception is the mechanism that keeps rollback failure visible. It
    carries a machine-readable report and is never swallowed by this module.
    """

    def __init__(self, report: "RollbackReport") -> None:
        super().__init__(report.summary())
        self.report = report


@dataclass(frozen=True)
class FileSnapshot:
    """State of one scoped path at checkpoint time."""

    path: str
    kind: str
    mode: str
    digest: str | None
    blob: str | None
    size: int | None
    link_target: str | None = None


@dataclass(frozen=True)
class GitState:
    """Read-only view of the repository at checkpoint time."""

    head: str | None
    branch: str | None
    status_porcelain: tuple[str, ...]


@dataclass(frozen=True)
class Checkpoint:
    """Manifest of one checkpoint."""

    checkpoint_id: str
    task_id: str
    created_at: str
    store: str
    repo_root: str
    note: str
    git: GitState
    entries: tuple[FileSnapshot, ...]

    def to_json(self) -> str:
        payload = asdict(self)
        payload["schema"] = SCHEMA
        payload["git"] = {
            "head": self.git.head,
            "branch": self.git.branch,
            "status_porcelain": list(self.git.status_porcelain),
        }
        payload["entries"] = [asdict(entry) for entry in self.entries]
        return json.dumps(payload, indent=2, sort_keys=True) + "\n"


@dataclass(frozen=True)
class RestoreReport:
    """Outcome of a restore or rollback attempt."""

    checkpoint_id: str
    task_id: str
    reason: str
    status: str
    restored: tuple[str, ...] = ()
    removed: tuple[str, ...] = ()
    unchanged: tuple[str, ...] = ()
    failed: tuple[str, ...] = ()
    failures: tuple[str, ...] = ()
    manual_intervention_required: bool = False
    notes: tuple[str, ...] = ()

    def summary(self) -> str:
        return (
            f"rollback {self.checkpoint_id} status={self.status} "
            f"reason={self.reason} restored={len(self.restored)} "
            f"removed={len(self.removed)} failed={list(self.failed)}"
        )

    def to_json(self) -> str:
        payload = {
            "schema": "vitanusa.restore-report.v1",
            "checkpoint_id": self.checkpoint_id,
            "task_id": self.task_id,
            "reason": self.reason,
            "status": self.status,
            "restored": list(self.restored),
            "removed": list(self.removed),
            "unchanged": list(self.unchanged),
            "failed": list(self.failed),
            "failures": list(self.failures),
            "manual_intervention_required": self.manual_intervention_required,
            "notes": list(self.notes),
        }
        return json.dumps(payload, indent=2, sort_keys=True) + "\n"


@dataclass(frozen=True)
class BlockedReport:
    """Outcome of a BLOCKED-state cleanliness check."""

    task_id: str
    status: str
    uncontrolled: tuple[str, ...] = ()
    checkpointed: tuple[str, ...] = ()
    clean: tuple[str, ...] = ()
    head_clean: tuple[str, ...] = ()
    acknowledgement: str | None = None
    notes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def has_uncontrolled_changes(self) -> bool:
        return bool(self.uncontrolled)

    def to_json(self) -> str:
        payload = {
            "schema": "vitanusa.blocked-report.v1",
            "task_id": self.task_id,
            "status": self.status,
            "uncontrolled": list(self.uncontrolled),
            "checkpointed": list(self.checkpointed),
            "clean": list(self.clean),
            "head_clean": list(self.head_clean),
            "acknowledgement": self.acknowledgement,
            "notes": list(self.notes),
        }
        return json.dumps(payload, indent=2, sort_keys=True) + "\n"


@dataclass(frozen=True)
class ValidationOutcome:
    """Outcome of running a validation command under rollback protection."""

    checkpoint_id: str
    task_id: str
    command: tuple[str, ...]
    exit_code: int
    status: str
    restore: RestoreReport | None = None

    def to_json(self) -> str:
        payload = {
            "schema": "vitanusa.validation-outcome.v1",
            "checkpoint_id": self.checkpoint_id,
            "task_id": self.task_id,
            "command": list(self.command),
            "exit_code": self.exit_code,
            "status": self.status,
            "restore": json.loads(self.restore.to_json()) if self.restore else None,
        }
        return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def _is_sensitive(relative: Path) -> bool:
    name = relative.name
    if name in SENSITIVE_NAMES or name.startswith(".env."):
        return True
    return relative.suffix.lower() in SENSITIVE_SUFFIXES


def _run_git(repo_root: Path, arguments: Sequence[str]) -> str | None:
    """Run a read-only Git command and return stdout, or None when unavailable."""

    try:
        completed = subprocess.run(
            ["git", *arguments],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout


def read_git_state(repo_root: Path) -> GitState:
    """Collect the read-only Git facts recorded with every checkpoint."""

    head = (_run_git(repo_root, ["rev-parse", "HEAD"]) or "").strip() or None
    branch = (_run_git(repo_root, ["branch", "--show-current"]) or "").strip() or None
    status_text = _run_git(repo_root, ["status", "--porcelain"]) or ""
    return GitState(
        head=head,
        branch=branch,
        status_porcelain=tuple(line for line in status_text.splitlines() if line.strip()),
    )


def _validate_repo_root(repo_root: Path) -> Path:
    root = repo_root.resolve()
    if not root.is_dir():
        raise CheckpointError(f"repository root does not exist: {root}")
    return root


def _validate_store(store: Path, root: Path) -> Path:
    resolved = store.expanduser()
    try:
        resolved = resolved.resolve()
    except OSError as error:  # pragma: no cover - unusual filesystem failure
        raise CheckpointError(f"cannot resolve checkpoint store {store}: {error}") from error
    if _is_within(resolved, root):
        raise CheckpointError(
            "checkpoint store must live outside the repository working tree so "
            f"checkpoint artefacts never appear in git status: {resolved}"
        )
    return resolved


def resolve_repo_for_checkpoint(
    checkpoint: Checkpoint,
    repo_root: Path | str | None = None,
    *,
    allow_repo_mismatch: bool = False,
) -> Path:
    """Resolve the repository a checkpoint may be applied to.

    A checkpoint is bound to the repository it was recorded from. Applying it
    somewhere else would write recorded content into an unrelated working tree,
    so a mismatch is refused unless the caller opts in explicitly.
    """

    recorded = Path(checkpoint.repo_root).resolve()
    if repo_root is None:
        if not recorded.is_dir():
            raise CheckpointError(
                f"checkpoint {checkpoint.checkpoint_id} was recorded for {recorded}, "
                "which no longer exists"
            )
        return recorded

    requested = _validate_repo_root(Path(repo_root))
    if requested == recorded:
        return requested
    if not allow_repo_mismatch:
        raise CheckpointError(
            f"checkpoint {checkpoint.checkpoint_id} belongs to {recorded}, not {requested}; "
            "run the command from the recorded repository or pass "
            "allow_repo_mismatch=True deliberately"
        )
    return requested


def resolve_scoped_path(root: Path, raw_path: str) -> Path:
    """Resolve one scoped path and refuse anything unsafe or out of scope.

    The parent directory chain is resolved so a symlinked directory cannot
    escape the repository, while the final component is kept unresolved so a
    symlink stays a symlink instead of silently becoming its target.
    """

    root_resolved = root.resolve()
    candidate = Path(raw_path)
    raw = candidate if candidate.is_absolute() else root / candidate
    normalised = Path(os.path.normpath(str(raw)))

    parent = normalised.parent.resolve()
    absolute = parent / normalised.name

    if not _is_within(absolute, root_resolved):
        raise CheckpointError(f"path is outside the repository: {raw_path}")
    if absolute == root_resolved:
        raise CheckpointError("the repository root itself cannot be scoped")

    relative = absolute.relative_to(root_resolved)
    if _is_sensitive(relative):
        raise CheckpointError(
            f"refusing to snapshot a secret-bearing path: {relative.as_posix()}"
        )
    if absolute.is_dir():
        raise CheckpointError(
            f"scoped path is a directory, name each file explicitly: {relative.as_posix()}"
        )
    return absolute


def _write_file(target: Path, data: bytes, mode: int | None) -> None:
    """Write bytes to target, replacing the file atomically where possible."""

    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(dir=str(target.parent), prefix=".task-checkpoint-")
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        if mode is not None:
            os.chmod(temporary_path, mode)
        os.replace(temporary_path, target)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def _snapshot_one(root: Path, absolute: Path, blob_dir: Path) -> FileSnapshot:
    relative = absolute.relative_to(root.resolve()).as_posix()
    if not absolute.exists() and not absolute.is_symlink():
        return FileSnapshot(
            path=relative,
            kind="absent",
            mode="",
            digest=None,
            blob=None,
            size=None,
        )

    if absolute.is_symlink():
        link_target = os.readlink(absolute)
        payload = link_target.encode("utf-8")
        return FileSnapshot(
            path=relative,
            kind="symlink",
            mode="",
            digest=_sha256(payload),
            blob=None,
            size=len(payload),
            link_target=link_target,
        )

    data = absolute.read_bytes()
    digest = _sha256(data)
    blob_dir.mkdir(parents=True, exist_ok=True)
    blob_path = blob_dir / digest
    if not blob_path.exists():
        blob_path.write_bytes(data)
    return FileSnapshot(
        path=relative,
        kind="file",
        mode=oct(absolute.stat().st_mode & 0o777),
        digest=digest,
        blob=digest,
        size=len(data),
    )


def create_checkpoint(
    repo_root: Path | str,
    store: Path | str | None = None,
    *,
    task_id: str,
    paths: Iterable[str],
    note: str = "",
) -> Checkpoint:
    """Snapshot the scoped paths and return the stored checkpoint manifest."""

    root = _validate_repo_root(Path(repo_root))
    store_root = _validate_store(Path(store) if store is not None else DEFAULT_STORE, root)

    task = task_id.strip()
    if not task:
        raise CheckpointError("task id is required")

    scoped = [resolve_scoped_path(root, raw) for raw in paths]
    if not scoped:
        raise CheckpointError("at least one --path is required to create a checkpoint")

    checkpoint_id = _next_checkpoint_id(store_root, task)
    blob_dir = store_root / checkpoint_id / "blobs"
    blob_dir.mkdir(parents=True, exist_ok=True)

    entries = tuple(_snapshot_one(root, absolute, blob_dir) for absolute in scoped)

    checkpoint = Checkpoint(
        checkpoint_id=checkpoint_id,
        task_id=task,
        created_at=_utc_now(),
        store=str(store_root),
        repo_root=str(root),
        note=note,
        git=read_git_state(root),
        entries=entries,
    )
    manifest_path = store_root / checkpoint_id / "manifest.json"
    manifest_path.write_text(checkpoint.to_json(), encoding="utf-8")
    return checkpoint


def _next_checkpoint_id(store_root: Path, task_id: str) -> str:
    prefix = f"{ID_PREFIX}-{task_id}-"
    highest = 0
    if store_root.is_dir():
        for child in store_root.iterdir():
            name = child.name
            if not name.startswith(prefix) or not child.is_dir():
                continue
            suffix = name[len(prefix) :]
            if suffix.isdigit():
                highest = max(highest, int(suffix))
    return f"{prefix}{highest + 1:03d}"


def list_checkpoints(store: Path | str | None = None) -> list[Checkpoint]:
    """Return every readable checkpoint in the store, newest identifier last."""

    store_root = Path(store).expanduser() if store is not None else DEFAULT_STORE
    if not store_root.is_dir():
        return []
    checkpoints = []
    for child in sorted(store_root.iterdir()):
        manifest = child / "manifest.json"
        if not manifest.is_file():
            continue
        try:
            checkpoints.append(load_checkpoint(manifest.read_text(encoding="utf-8")))
        except CheckpointError:
            continue
    return checkpoints


def load_checkpoint(raw: str) -> Checkpoint:
    """Parse a manifest document into a `Checkpoint`."""

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise CheckpointError(f"checkpoint manifest is not valid JSON: {error}") from error
    if not isinstance(payload, dict) or payload.get("schema") != SCHEMA:
        raise CheckpointError(f"checkpoint manifest schema must be {SCHEMA}")

    git_payload = payload.get("git") or {}
    entries_payload = payload.get("entries") or []
    try:
        entries = tuple(
            FileSnapshot(
                path=str(entry["path"]),
                kind=str(entry["kind"]),
                mode=str(entry.get("mode") or ""),
                digest=entry.get("digest"),
                blob=entry.get("blob"),
                size=entry.get("size"),
                link_target=entry.get("link_target"),
            )
            for entry in entries_payload
        )
    except (KeyError, TypeError) as error:
        raise CheckpointError(f"checkpoint manifest entry is malformed: {error}") from error

    return Checkpoint(
        checkpoint_id=str(payload.get("checkpoint_id") or ""),
        task_id=str(payload.get("task_id") or ""),
        created_at=str(payload.get("created_at") or ""),
        store=str(payload.get("store") or ""),
        repo_root=str(payload.get("repo_root") or ""),
        note=str(payload.get("note") or ""),
        git=GitState(
            head=git_payload.get("head"),
            branch=git_payload.get("branch"),
            status_porcelain=tuple(git_payload.get("status_porcelain") or []),
        ),
        entries=entries,
    )


def find_checkpoint(checkpoint_id: str, store: Path | str | None = None) -> Checkpoint:
    """Load one checkpoint by identifier."""

    store_root = Path(store).expanduser() if store is not None else DEFAULT_STORE
    manifest = store_root / checkpoint_id / "manifest.json"
    if not manifest.is_file():
        raise CheckpointError(f"unknown checkpoint: {checkpoint_id}")
    return load_checkpoint(manifest.read_text(encoding="utf-8"))


def _read_blob(checkpoint: Checkpoint, entry: FileSnapshot) -> bytes:
    if entry.kind == "symlink":
        return (entry.link_target or "").encode("utf-8")
    if not entry.blob:
        raise CheckpointError(f"checkpoint {checkpoint.checkpoint_id} has no blob for {entry.path}")
    blob_path = Path(checkpoint.store) / checkpoint.checkpoint_id / "blobs" / entry.blob
    try:
        return blob_path.read_bytes()
    except OSError as error:
        raise CheckpointError(f"cannot read stored content for {entry.path}: {error}") from error


def restore_checkpoint(
    checkpoint: Checkpoint,
    repo_root: Path | str | None = None,
    *,
    reason: str = "manual",
    purge_new: bool = False,
    allow_repo_mismatch: bool = False,
    allow_root_scope_purge: bool = False,
) -> RestoreReport:
    """Restore every scoped path of a checkpoint back to its recorded state.

    Raises `RollbackError` when any path could not be restored or failed
    verification. A partially applied restore is reported as `partial`, never
    as success. `purge_new` additionally removes untracked paths that appeared
    inside the checkpoint scope after it was taken; it is off by default so a
    manual restore never deletes work that was not listed in the manifest.
    Purging is skipped, and the skip is reported, when the scope covers the
    repository root unless `allow_root_scope_purge` is set.
    """

    if reason not in RESTORE_REASONS:
        raise CheckpointError(
            f"unknown restore reason {reason!r}; expected one of {list(RESTORE_REASONS)}"
        )

    root = resolve_repo_for_checkpoint(checkpoint, repo_root, allow_repo_mismatch=allow_repo_mismatch)

    restored: list[str] = []
    removed: list[str] = []
    unchanged: list[str] = []
    failed: list[str] = []
    failures: list[str] = []
    notes: list[str] = []

    for entry in checkpoint.entries:
        target = resolve_scoped_path(root, entry.path)
        try:
            outcome = _restore_one(checkpoint, entry, target)
        except CheckpointError as error:
            failed.append(entry.path)
            failures.append(f"{entry.path}: {error}")
            continue
        except OSError as error:
            failed.append(entry.path)
            failures.append(f"{entry.path}: {error}")
            continue

        if outcome == "restored":
            restored.append(entry.path)
        elif outcome == "removed":
            removed.append(entry.path)
        else:
            unchanged.append(entry.path)

    if purge_new:
        directories = _scope_directories(checkpoint)
        if "." in directories and not allow_root_scope_purge:
            notes.append(
                "purge of newly created paths skipped: the checkpoint scope covers "
                "the repository root, so removing untracked files tree-wide is not "
                "inside an explicit scope; pass allow_root_scope_purge=True to opt in"
            )
        else:
            for relative in discover_new_paths(checkpoint, root):
                try:
                    target = resolve_scoped_path(root, relative)
                except CheckpointError as error:
                    failed.append(relative)
                    failures.append(f"{relative}: {error}")
                    continue
                try:
                    if target.is_dir() and not target.is_symlink():
                        raise CheckpointError("refusing to remove a directory recursively")
                    target.unlink()
                    if target.exists() or target.is_symlink():
                        raise CheckpointError("path still exists after removal")
                except (CheckpointError, OSError) as error:
                    failed.append(relative)
                    failures.append(f"{relative}: {error}")
                    continue
                removed.append(relative)

    status = "restored"
    if failed:
        status = "failed" if not (restored or removed) else "partial"

    report = RestoreReport(
        checkpoint_id=checkpoint.checkpoint_id,
        task_id=checkpoint.task_id,
        reason=reason,
        status=status,
        restored=tuple(restored),
        removed=tuple(removed),
        unchanged=tuple(unchanged),
        failed=tuple(failed),
        failures=tuple(failures),
        manual_intervention_required=bool(failed),
        notes=tuple(notes),
    )
    if failed:
        raise RollbackError(report)
    return report


def _restore_one(checkpoint: Checkpoint, entry: FileSnapshot, target: Path) -> str:
    """Restore a single path and verify the result. Returns the action taken."""

    if entry.kind == "absent":
        if not target.exists() and not target.is_symlink():
            return "unchanged"
        if target.is_dir() and not target.is_symlink():
            raise CheckpointError("target became a directory; refusing to remove it")
        target.unlink()
        if target.exists() or target.is_symlink():
            raise CheckpointError("path still exists after removal")
        return "removed"

    if entry.kind == "symlink":
        if target.is_symlink() and os.readlink(target) == entry.link_target:
            return "unchanged"
        if target.is_dir() and not target.is_symlink():
            raise CheckpointError("target became a directory; refusing to replace it")
        if target.exists() or target.is_symlink():
            target.unlink()
        target.parent.mkdir(parents=True, exist_ok=True)
        os.symlink(entry.link_target or "", target)
        if os.readlink(target) != entry.link_target:
            raise CheckpointError("symlink verification failed after write")
        return "restored"

    expected = _read_blob(checkpoint, entry)
    if entry.digest is not None and _sha256(expected) != entry.digest:
        raise CheckpointError("stored content digest does not match the manifest")

    current: bytes | None
    if target.is_symlink() or not target.is_file():
        current = None
    else:
        current = target.read_bytes()

    if current == expected:
        if entry.mode:
            os.chmod(target, int(entry.mode, 8))
        return "unchanged"

    mode = int(entry.mode, 8) if entry.mode else None
    _write_file(target, expected, mode)

    written = target.read_bytes()
    if _sha256(written) != entry.digest:
        raise CheckpointError("restored content failed digest verification after write")
    return "restored"


def verify_checkpoint(
    checkpoint: Checkpoint,
    repo_root: Path | str | None = None,
    *,
    allow_repo_mismatch: bool = False,
) -> list[str]:
    """Return the scoped paths that no longer match the checkpoint.

    Two kinds of difference count as drift: a recorded path whose content
    changed, and a path that appeared inside a recorded scope directory after
    the checkpoint was taken.
    """

    root = resolve_repo_for_checkpoint(checkpoint, repo_root, allow_repo_mismatch=allow_repo_mismatch)
    drifted = []
    for entry in checkpoint.entries:
        target = resolve_scoped_path(root, entry.path)
        try:
            if entry.kind == "absent":
                matches = not target.exists() and not target.is_symlink()
            elif entry.kind == "symlink":
                matches = target.is_symlink() and os.readlink(target) == entry.link_target
            else:
                matches = target.is_file() and _sha256(target.read_bytes()) == entry.digest
        except OSError:
            matches = False
        if not matches:
            drifted.append(entry.path)
    return drifted + discover_new_paths(checkpoint, root)


def _scope_directories(checkpoint: Checkpoint) -> list[str]:
    """Directories covered by the checkpoint, derived from its entries."""

    directories = {PurePosixPath(entry.path).parent.as_posix() for entry in checkpoint.entries}
    return sorted(directories or {"."})


def _untracked_in_directories(root: Path, directories: Sequence[str]) -> list[str]:
    """List untracked, non-ignored files inside the given directories."""

    status = _run_git(
        root,
        ["status", "--porcelain", "--untracked-files=all", "--", *directories],
    )
    if not status:
        return []
    untracked = []
    for line in status.splitlines():
        if not line.startswith("?? "):
            continue
        candidate = line[3:].strip().strip('"')
        if candidate:
            untracked.append(PurePosixPath(candidate).as_posix())
    return untracked


def _untracked_at_checkpoint(checkpoint: Checkpoint) -> set[str]:
    """Untracked paths Git already reported when the checkpoint was created."""

    return {
        PurePosixPath(line[3:].strip().strip('"')).as_posix()
        for line in checkpoint.git.status_porcelain
        if line.startswith("?? ")
    }


def discover_new_paths(
    checkpoint: Checkpoint,
    repo_root: Path | str | None = None,
    *,
    allow_repo_mismatch: bool = False,
) -> list[str]:
    """Return untracked paths that appeared in the scope after the checkpoint.

    Ignored files are never reported because Git does not list them, and paths
    that were already untracked at checkpoint time are excluded, so nothing that
    existed before the checkpoint can be mistaken for worker output.
    """

    root = resolve_repo_for_checkpoint(checkpoint, repo_root, allow_repo_mismatch=allow_repo_mismatch)
    recorded = {entry.path for entry in checkpoint.entries}
    already_untracked = _untracked_at_checkpoint(checkpoint)
    candidates = _untracked_in_directories(root, _scope_directories(checkpoint))
    return sorted(
        candidate
        for candidate in candidates
        if candidate not in recorded and candidate not in already_untracked
    )


def rollback(
    checkpoint: Checkpoint,
    cause: str,
    repo_root: Path | str | None = None,
    *,
    detail: str = "",
    purge_new: bool = True,
    allow_repo_mismatch: bool = False,
    allow_root_scope_purge: bool = False,
) -> RestoreReport:
    """Roll a checkpoint back after a worker, validation, or BLOCKED failure.

    Rollback means returning to the recorded state, so it removes paths that
    appeared inside the checkpoint scope after it was taken. Files that were
    already untracked at checkpoint time are never removed, and a scope that
    covers the repository root is never purged without an explicit opt-in.
    """

    if cause not in ROLLBACK_CAUSES:
        raise CheckpointError(
            f"unknown rollback cause {cause!r}; expected one of {list(ROLLBACK_CAUSES)}"
        )
    report = restore_checkpoint(
        checkpoint,
        repo_root,
        reason=cause,
        purge_new=purge_new,
        allow_repo_mismatch=allow_repo_mismatch,
        allow_root_scope_purge=allow_root_scope_purge,
    )
    if detail:
        report = RestoreReport(
            checkpoint_id=report.checkpoint_id,
            task_id=report.task_id,
            reason=f"{report.reason}: {detail}",
            status=report.status,
            restored=report.restored,
            removed=report.removed,
            unchanged=report.unchanged,
            failed=report.failed,
            failures=report.failures,
            manual_intervention_required=report.manual_intervention_required,
            notes=report.notes,
        )
    return report


def run_guarded_validation(
    checkpoint: Checkpoint,
    command: Sequence[str],
    repo_root: Path | str | None = None,
    *,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    allow_repo_mismatch: bool = False,
    allow_root_scope_purge: bool = False,
) -> ValidationOutcome:
    """Run a validation command and roll back when it fails.

    A zero exit code means the validation passed and nothing was restored. Any
    non-zero exit code triggers a rollback whose reason is `validation-failure`.
    A rollback that itself fails raises `RollbackError` so the caller cannot
    mistake a failed validation for a clean rollback.
    """

    if not command:
        raise CheckpointError("a validation command is required")

    root = resolve_repo_for_checkpoint(checkpoint, repo_root, allow_repo_mismatch=allow_repo_mismatch)
    completed = runner(list(command), cwd=str(root), check=False, capture_output=True, text=True)

    if completed.returncode == 0:
        return ValidationOutcome(
            checkpoint_id=checkpoint.checkpoint_id,
            task_id=checkpoint.task_id,
            command=tuple(command),
            exit_code=0,
            status="passed",
        )

    report = restore_checkpoint(
        checkpoint,
        root,
        reason="validation-failure",
        purge_new=True,
        allow_root_scope_purge=allow_root_scope_purge,
    )
    return ValidationOutcome(
        checkpoint_id=checkpoint.checkpoint_id,
        task_id=checkpoint.task_id,
        command=tuple(command),
        exit_code=completed.returncode,
        status="rolled-back",
        restore=report,
    )


def find_latest_checkpoint(
    task_id: str,
    store: Path | str | None = None,
    *,
    paths: Iterable[str] | None = None,
) -> Checkpoint | None:
    """Return the newest checkpoint of a task, optionally covering `paths`."""

    wanted = {Path(raw).as_posix() for raw in paths} if paths is not None else None
    candidates = [
        checkpoint
        for checkpoint in list_checkpoints(store)
        if checkpoint.task_id == task_id
    ]
    if wanted is not None:
        candidates = [
            checkpoint
            for checkpoint in candidates
            if wanted.issubset({entry.path for entry in checkpoint.entries})
        ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda checkpoint: checkpoint.checkpoint_id)[-1]


def blocked_check(
    repo_root: Path | str,
    store: Path | str | None = None,
    *,
    task_id: str,
    paths: Iterable[str],
    acknowledgement: str | None = None,
) -> BlockedReport:
    """Report whether BLOCKED would leave scoped changes uncontrolled.

    A scoped path counts as controlled when it matches a checkpoint of the same
    task, when it has no uncommitted difference against HEAD, or when the caller
    records an explicit acknowledgement naming that path set.
    """

    root = _validate_repo_root(Path(repo_root))
    store_root = Path(store).expanduser() if store is not None else DEFAULT_STORE

    scoped = [resolve_scoped_path(root, raw) for raw in paths]
    if not scoped:
        raise CheckpointError("at least one --path is required for a BLOCKED check")

    latest = find_latest_checkpoint(task_id, store_root)
    if latest is not None:
        latest_root = resolve_repo_for_checkpoint(latest)
        if latest_root != root:
            raise CheckpointError(
                f"checkpoint {latest.checkpoint_id} belongs to {latest_root}, not {root}; "
                "run the BLOCKED check for the repository that recorded it"
            )
    relative_paths = [absolute.relative_to(root.resolve()).as_posix() for absolute in scoped]
    drifted = set(verify_checkpoint(latest)) if latest is not None else set()

    controlled_by_checkpoint: list[str] = []
    clean: list[str] = []
    uncommitted: list[str] = []
    uncontrolled: list[str] = []

    for relative in relative_paths:
        if latest is not None and relative not in drifted:
            controlled_by_checkpoint.append(relative)
            continue
        if not _has_uncommitted_difference(root, relative):
            clean.append(relative)
            continue
        uncommitted.append(relative)
        uncontrolled.append(relative)

    acknowledged = bool(acknowledgement and acknowledgement.strip())
    if acknowledged:
        status = "acknowledged"
    elif uncontrolled:
        status = "uncontrolled-changes"
    else:
        status = "clear"

    notes: list[str] = []
    if acknowledged:
        notes.append(
            "uncontrolled scoped changes accepted by explicit acknowledgement; "
            "this is not a PASS of the governance checklist"
        )
    if latest is None:
        notes.append(f"no checkpoint found for task {task_id} in {store_root}")

    return BlockedReport(
        task_id=task_id,
        status=status,
        uncontrolled=tuple(uncontrolled),
        checkpointed=tuple(controlled_by_checkpoint),
        clean=tuple(clean),
        head_clean=tuple(uncommitted),
        acknowledgement=acknowledgement if acknowledged else None,
        notes=tuple(notes),
    )


def _has_uncommitted_difference(root: Path, relative: str) -> bool:
    """True when the path differs from HEAD, including being untracked or absent."""

    tracked = _run_git(root, ["ls-files", "--error-unmatch", "--", relative])
    if tracked is None:
        return True
    diff = _run_git(root, ["status", "--porcelain", "--", relative])
    return bool(diff and diff.strip())


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""

    parser = argparse.ArgumentParser(
        prog="task_checkpoint.py",
        description="Checkpoint, restore, and roll back scoped autonomous-coding changes.",
    )
    parser.add_argument(
        "--store",
        type=Path,
        default=None,
        help=f"checkpoint store directory (default: {DEFAULT_STORE})",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="snapshot the scoped paths")
    create.add_argument("--task", required=True, help="task id, for example T004")
    create.add_argument("--path", action="append", default=[], required=True, help="scoped path")
    create.add_argument("--note", default="", help="short note recorded in the manifest")
    create.add_argument("--repo", type=Path, default=None, help="repository root override")

    listing = subparsers.add_parser("list", help="list stored checkpoints")
    listing.add_argument("--task", default=None, help="filter by task id")

    verify = subparsers.add_parser("verify", help="report drift against a checkpoint")
    verify.add_argument("--id", required=True, dest="checkpoint_id")

    restore = subparsers.add_parser("restore", help="restore a checkpoint")
    restore.add_argument("--id", required=True, dest="checkpoint_id")
    restore.add_argument("--reason", default="manual", choices=list(RESTORE_REASONS))
    restore.add_argument(
        "--purge-new",
        action="store_true",
        help="also remove untracked paths that appeared in the scope after the checkpoint",
    )
    restore.add_argument(
        "--allow-root-purge",
        action="store_true",
        help="permit purging untracked paths tree-wide when the scope covers the repository root",
    )

    rollback_parser = subparsers.add_parser("rollback", help="roll a checkpoint back")
    rollback_parser.add_argument("--id", required=True, dest="checkpoint_id")
    rollback_parser.add_argument("--cause", required=True, choices=list(ROLLBACK_CAUSES))
    rollback_parser.add_argument("--detail", default="", help="short failure detail")
    rollback_parser.add_argument(
        "--allow-root-purge",
        action="store_true",
        help="permit purging untracked paths tree-wide when the scope covers the repository root",
    )

    validation = subparsers.add_parser(
        "run-validation", help="run a validation command and roll back on failure"
    )
    validation.add_argument("--id", required=True, dest="checkpoint_id")
    validation.add_argument("--allow-root-purge", action="store_true")
    validation.add_argument("validation_command", nargs=argparse.REMAINDER, help="command to run")

    blocked = subparsers.add_parser(
        "blocked-check", help="report uncontrolled scoped changes before BLOCKED"
    )
    blocked.add_argument("--task", required=True)
    blocked.add_argument("--path", action="append", default=[], required=True)
    blocked.add_argument(
        "--acknowledge",
        default=None,
        help="explicit written acknowledgement that the changes stay as they are",
    )
    blocked.add_argument("--repo", type=Path, default=None)

    return parser


def _repo_root_for(arguments: argparse.Namespace) -> Path:
    override = getattr(arguments, "repo", None)
    if override is not None:
        return Path(override)
    return Path(__file__).resolve().parent.parent


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return a process exit code."""

    parser = build_parser()
    arguments = parser.parse_args(list(argv) if argv is not None else None)
    store = arguments.store

    try:
        if arguments.command == "create":
            checkpoint = create_checkpoint(
                _repo_root_for(arguments),
                store,
                task_id=arguments.task,
                paths=arguments.path,
                note=arguments.note,
            )
            sys.stdout.write(checkpoint.to_json())
            return EXIT_OK

        if arguments.command == "list":
            checkpoints = [
                checkpoint
                for checkpoint in list_checkpoints(store)
                if arguments.task is None or checkpoint.task_id == arguments.task
            ]
            sys.stdout.write(
                json.dumps(
                    {
                        "schema": "vitanusa.checkpoint-list.v1",
                        "count": len(checkpoints),
                        "checkpoints": [checkpoint.checkpoint_id for checkpoint in checkpoints],
                    },
                    indent=2,
                )
                + "\n"
            )
            return EXIT_OK

        if arguments.command == "verify":
            checkpoint = find_checkpoint(arguments.checkpoint_id, store)
            drifted = verify_checkpoint(checkpoint)
            sys.stdout.write(
                json.dumps(
                    {
                        "schema": "vitanusa.verify-report.v1",
                        "checkpoint_id": checkpoint.checkpoint_id,
                        "drifted": drifted,
                        "status": "match" if not drifted else "drift",
                    },
                    indent=2,
                )
                + "\n"
            )
            return EXIT_OK if not drifted else EXIT_DRIFT

        if arguments.command == "restore":
            checkpoint = find_checkpoint(arguments.checkpoint_id, store)
            report = restore_checkpoint(
                checkpoint,
                reason=arguments.reason,
                purge_new=arguments.purge_new,
                allow_root_scope_purge=arguments.allow_root_purge,
            )
            sys.stdout.write(report.to_json())
            return EXIT_OK

        if arguments.command == "rollback":
            checkpoint = find_checkpoint(arguments.checkpoint_id, store)
            report = rollback(
                checkpoint,
                arguments.cause,
                detail=arguments.detail,
                allow_root_scope_purge=arguments.allow_root_purge,
            )
            sys.stdout.write(report.to_json())
            return EXIT_OK

        if arguments.command == "run-validation":
            checkpoint = find_checkpoint(arguments.checkpoint_id, store)
            command = [item for item in arguments.validation_command if item != "--"]
            if not command:
                raise CheckpointError("run-validation requires a command after --")
            outcome = run_guarded_validation(
                checkpoint, command, allow_root_scope_purge=arguments.allow_root_purge
            )
            sys.stdout.write(outcome.to_json())
            return EXIT_OK if outcome.status == "passed" else 1

        if arguments.command == "blocked-check":
            report = blocked_check(
                _repo_root_for(arguments),
                store,
                task_id=arguments.task,
                paths=arguments.path,
                acknowledgement=arguments.acknowledge,
            )
            sys.stdout.write(report.to_json())
            return EXIT_BLOCKED if report.has_uncontrolled_changes and report.status != "acknowledged" else EXIT_OK

    except RollbackError as error:
        sys.stderr.write(error.report.to_json())
        sys.stderr.write(
            "rollback did not complete; manual intervention is required.\n"
        )
        return EXIT_ROLLBACK_FAILED
    except CheckpointError as error:
        sys.stderr.write(f"checkpoint error: {error}\n")
        return EXIT_USAGE if "must live outside" in str(error) or "outside the repository" in str(error) else EXIT_ERROR

    parser.error(f"unknown command: {arguments.command}")
    return EXIT_USAGE  # pragma: no cover - argparse exits first


if __name__ == "__main__":
    raise SystemExit(main())