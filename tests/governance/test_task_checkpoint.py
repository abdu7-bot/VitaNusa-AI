#!/usr/bin/env python3
"""Tests for `scripts/task_checkpoint.py` (task T004).

The suite proves the five properties T004 requires:

1. a checkpoint can be created;
2. state can be restored from a checkpoint;
3. rollback runs when the worker fails;
4. rollback runs when validation or tests fail;
5. a failed rollback is handled explicitly and never hidden.

It also covers the negative cases the `TOOL` gate requires: refused unsafe
scope, refused store inside the working tree, refused secret-bearing paths, and
non-zero CLI exit codes. Every test works inside a throwaway Git repository in a
temporary directory, so the canonical workspace is never touched.
"""

from __future__ import annotations

import ast
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "task_checkpoint.py"


def load_tool_module():
    """Load the tool as a module without relying on package import rules."""

    spec = importlib.util.spec_from_file_location("task_checkpoint", MODULE_PATH)
    if spec is None or spec.loader is None:  # pragma: no cover - import failure
        raise RuntimeError(f"cannot load {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tool = load_tool_module()


def git(repo: Path, *arguments: str) -> str:
    """Run a Git command inside the throwaway repository."""

    completed = subprocess.run(
        ["git", *arguments],
        cwd=str(repo),
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout


class TemporaryRepositoryTestCase(unittest.TestCase):
    """Base fixture: one throwaway repository and one checkpoint store."""

    def setUp(self) -> None:
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.base = Path(self.workspace.name)

        self.repo = self.base / "repo"
        self.store = self.base / "checkpoint-store"
        self.repo.mkdir()

        git(self.repo, "init", "--quiet", "--initial-branch=main")
        git(self.repo, "config", "user.email", "t004@example.invalid")
        git(self.repo, "config", "user.name", "T004 Test")

        (self.repo / "kept.md").write_text("alpha\n", encoding="utf-8")
        (self.repo / "dropped.md").write_text("beta\n", encoding="utf-8")
        git(self.repo, "add", "kept.md", "dropped.md")
        git(self.repo, "commit", "--quiet", "-m", "test baseline")
        self.baseline_head = git(self.repo, "rev-parse", "HEAD").strip()

        self.scoped = ["kept.md", "dropped.md"]

    def create(self, **overrides):
        """Create a checkpoint over the scoped paths."""

        arguments = {
            "task_id": "T004",
            "paths": self.scoped,
            "note": "before risky change",
        }
        arguments.update(overrides)
        return tool.create_checkpoint(self.repo, self.store, **arguments)

    def load(self, checkpoint):
        return tool.find_checkpoint(checkpoint.checkpoint_id, self.store)


class CheckpointCreationTests(TemporaryRepositoryTestCase):
    """Property 1: a checkpoint can be created."""

    def test_checkpoint_records_content_state_and_git_facts(self) -> None:
        checkpoint = self.create()

        self.assertEqual(checkpoint.task_id, "T004")
        self.assertEqual(checkpoint.checkpoint_id, "CP-T004-001")
        self.assertEqual([entry.path for entry in checkpoint.entries], self.scoped)

        kept = next(entry for entry in checkpoint.entries if entry.path == "kept.md")
        self.assertEqual(kept.kind, "file")
        self.assertEqual(kept.size, len("alpha\n"))
        self.assertTrue(kept.digest)
        self.assertEqual(kept.blob, kept.digest)

        self.assertEqual(checkpoint.git.head, self.baseline_head)
        self.assertEqual(checkpoint.git.branch, "main")
        self.assertEqual(checkpoint.git.status_porcelain, ())

        blob = Path(checkpoint.store) / checkpoint.checkpoint_id / "blobs" / kept.blob
        self.assertEqual(blob.read_bytes(), b"alpha\n")

    def test_checkpoint_is_discoverable_through_the_store(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        self.assertEqual(stored.checkpoint_id, checkpoint.checkpoint_id)
        self.assertEqual([item.checkpoint_id for item in tool.list_checkpoints(self.store)], [checkpoint.checkpoint_id])

    def test_checkpoints_are_incrementally_numbered(self) -> None:
        first = self.create()
        second = self.create()
        self.assertEqual(first.checkpoint_id, "CP-T004-001")
        self.assertEqual(second.checkpoint_id, "CP-T004-002")

    def test_store_inside_repository_is_refused(self) -> None:
        with self.assertRaises(tool.CheckpointError) as raised:
            tool.create_checkpoint(
                self.repo,
                self.repo / "checkpoints",
                task_id="T004",
                paths=self.scoped,
            )
        self.assertIn("outside the repository working tree", str(raised.exception))

    def test_path_outside_repository_is_refused(self) -> None:
        with self.assertRaises(tool.CheckpointError) as raised:
            tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["../escape.md"])
        self.assertIn("outside the repository", str(raised.exception))

    def test_directory_scope_is_refused(self) -> None:
        (self.repo / "folder").mkdir()
        with self.assertRaises(tool.CheckpointError) as raised:
            tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["folder"])
        self.assertIn("name each file explicitly", str(raised.exception))

    def test_secret_bearing_path_is_refused(self) -> None:
        (self.repo / ".env").write_text("SECRET=value\n", encoding="utf-8")
        with self.assertRaises(tool.CheckpointError) as raised:
            tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=[".env"])
        self.assertIn("secret-bearing path", str(raised.exception))

    def test_checkpoint_without_paths_is_refused(self) -> None:
        with self.assertRaises(tool.CheckpointError):
            tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=[])


class RestoreTests(TemporaryRepositoryTestCase):
    """Property 2: state can be restored."""

    def test_restore_recovers_modified_deleted_and_added_files(self) -> None:
        checkpoint = self.create()

        (self.repo / "kept.md").write_text("corrupted\n", encoding="utf-8")
        (self.repo / "dropped.md").unlink()
        (self.repo / "added.md").write_text("new file\n", encoding="utf-8")

        stored = self.load(checkpoint)
        self.assertEqual(
            sorted(tool.verify_checkpoint(stored, self.repo)),
            ["added.md", "dropped.md", "kept.md"],
        )

        report = tool.restore_checkpoint(
            stored,
            self.repo,
            reason="manual",
            purge_new=True,
            allow_root_scope_purge=True,
        )

        self.assertEqual(report.status, "restored")
        self.assertEqual(report.notes, ())
        self.assertFalse(report.manual_intervention_required)
        self.assertEqual(sorted(report.restored), ["dropped.md", "kept.md"])
        self.assertEqual(report.removed, ("added.md",))
        self.assertEqual(report.failed, ())
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")
        self.assertEqual((self.repo / "dropped.md").read_text(encoding="utf-8"), "beta\n")
        self.assertFalse((self.repo / "added.md").exists())
        self.assertEqual(git(self.repo, "status", "--porcelain").strip(), "")

    def test_manual_restore_keeps_new_files_unless_purge_is_asked(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("corrupted\n", encoding="utf-8")
        (self.repo / "added.md").write_text("new file\n", encoding="utf-8")

        report = tool.restore_checkpoint(self.load(checkpoint), self.repo, reason="manual")

        self.assertEqual(report.removed, ())
        self.assertTrue((self.repo / "added.md").exists())
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")

    def test_restore_of_unchanged_tree_reports_unchanged(self) -> None:
        checkpoint = self.create()
        report = tool.restore_checkpoint(self.load(checkpoint), self.repo, reason="manual")
        self.assertEqual(report.unchanged, ("kept.md", "dropped.md"))
        self.assertEqual(report.restored, ())
        self.assertEqual(report.status, "restored")

    def test_restore_recreates_a_file_that_did_not_exist(self) -> None:
        (self.repo / "fresh.md").write_text("draft\n", encoding="utf-8")
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["fresh.md"])
        (self.repo / "fresh.md").unlink()

        report = tool.restore_checkpoint(self.load(checkpoint), self.repo)

        self.assertEqual(report.restored, ("fresh.md",))
        self.assertEqual((self.repo / "fresh.md").read_text(encoding="utf-8"), "draft\n")

    def test_restore_recreates_a_symlink(self) -> None:
        (self.repo / "link.md").symlink_to("kept.md")
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["link.md"])
        (self.repo / "link.md").unlink()

        report = tool.restore_checkpoint(self.load(checkpoint), self.repo)

        self.assertEqual(report.restored, ("link.md",))
        self.assertTrue((self.repo / "link.md").is_symlink())
        self.assertEqual(os.readlink(self.repo / "link.md"), "kept.md")

    def test_restore_removes_a_file_that_did_not_exist_at_checkpoint_time(self) -> None:
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["fresh.md"])
        (self.repo / "fresh.md").write_text("worker output\n", encoding="utf-8")

        self.assertEqual(tool.verify_checkpoint(self.load(checkpoint), self.repo), ["fresh.md"])

        report = tool.restore_checkpoint(self.load(checkpoint), self.repo)

        self.assertEqual(report.removed, ("fresh.md",))
        self.assertFalse((self.repo / "fresh.md").exists())
        self.assertEqual(tool.verify_checkpoint(self.load(checkpoint), self.repo), [])

    def test_restore_rejects_unknown_reason(self) -> None:
        checkpoint = self.create()
        with self.assertRaises(tool.CheckpointError):
            tool.restore_checkpoint(self.load(checkpoint), self.repo, reason="because")

    def test_unknown_checkpoint_is_reported(self) -> None:
        with self.assertRaises(tool.CheckpointError) as raised:
            tool.find_checkpoint("CP-T004-404", self.store)
        self.assertIn("unknown checkpoint", str(raised.exception))


class WorkerFailureRollbackTests(TemporaryRepositoryTestCase):
    """Property 3: rollback runs when the worker fails."""

    def test_rollback_after_worker_failure_restores_the_tree(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("half finished\n", encoding="utf-8")
        (self.repo / "orphan.md").write_text("untracked\n", encoding="utf-8")

        report = tool.rollback(
            self.load(checkpoint),
            "worker-failure",
            self.repo,
            detail="worker exited 1",
            allow_root_scope_purge=True,
        )

        self.assertEqual(report.status, "restored")
        self.assertEqual(report.reason, "worker-failure: worker exited 1")
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")
        self.assertFalse((self.repo / "orphan.md").exists())
        self.assertEqual(git(self.repo, "status", "--porcelain").strip(), "")

    def test_checkpoint_is_bound_to_the_repository_it_recorded(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        other_repo = self.base / "other-repo"
        other_repo.mkdir()
        (other_repo / "kept.md").write_text("unrelated\n", encoding="utf-8")

        for call in (
            lambda: tool.verify_checkpoint(stored, other_repo),
            lambda: tool.restore_checkpoint(stored, other_repo),
            lambda: tool.rollback(stored, "worker-failure", other_repo),
            lambda: tool.run_guarded_validation(stored, [sys.executable, "-c", "pass"], other_repo),
        ):
            with self.assertRaises(tool.CheckpointError) as raised:
                call()
            self.assertIn("belongs to", str(raised.exception))

        self.assertEqual((other_repo / "kept.md").read_text(encoding="utf-8"), "unrelated\n")

    def test_root_scope_purge_is_refused_without_explicit_opt_in(self) -> None:
        checkpoint = self.create(paths=["kept.md"])
        (self.repo / "worker-output.md").write_text("new\n", encoding="utf-8")

        guarded = tool.rollback(self.load(checkpoint), "worker-failure", self.repo)
        self.assertEqual(guarded.removed, ())
        self.assertTrue((self.repo / "worker-output.md").exists())
        self.assertTrue(any("repository root" in note for note in guarded.notes))

        opted_in = tool.rollback(
            self.load(checkpoint),
            "worker-failure",
            self.repo,
            allow_root_scope_purge=True,
        )
        self.assertEqual(opted_in.removed, ("worker-output.md",))
        self.assertFalse((self.repo / "worker-output.md").exists())

    def test_rollback_never_removes_files_that_predate_the_checkpoint(self) -> None:
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        (scoped_directory / "untracked-before.md").write_text("pre-existing\n", encoding="utf-8")

        checkpoint = tool.create_checkpoint(
            self.repo,
            self.store,
            task_id="T004",
            paths=["scoped/tracked.md"],
        )
        (scoped_directory / "tracked.md").write_text("half finished\n", encoding="utf-8")
        (scoped_directory / "worker-output.md").write_text("new\n", encoding="utf-8")

        report = tool.rollback(self.load(checkpoint), "worker-failure", self.repo)

        self.assertEqual(report.status, "restored")
        # Subdirectory purge is not supported; worker-output.md should NOT be removed
        self.assertEqual(report.removed, ())
        self.assertEqual((scoped_directory / "tracked.md").read_text(encoding="utf-8"), "tracked\n")
        self.assertTrue((scoped_directory / "untracked-before.md").exists())
        self.assertTrue((scoped_directory / "worker-output.md").exists())

    def test_rollback_rejects_unknown_cause(self) -> None:
        checkpoint = self.create()
        with self.assertRaises(tool.CheckpointError):
            tool.rollback(self.load(checkpoint), "vibes", self.repo)


class ValidationFailureRollbackTests(TemporaryRepositoryTestCase):
    """Property 4: rollback runs when validation or tests fail."""

    @staticmethod
    def fake_runner(returncode: int, stdout: str = "", stderr: str = ""):
        def runner(command, **kwargs):  # noqa: ARG005 - signature mirrors subprocess.run
            return subprocess.CompletedProcess(command, returncode, stdout, stderr)

        return runner

    def test_failing_validation_triggers_rollback(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        outcome = tool.run_guarded_validation(
            self.load(checkpoint),
            ["python3", "-m", "unittest", "discover"],
            self.repo,
            runner=self.fake_runner(1, stderr="FAILED (failures=1)"),
        )

        self.assertEqual(outcome.exit_code, 1)
        self.assertEqual(outcome.status, "rolled-back")
        self.assertIsNotNone(outcome.restore)
        self.assertEqual(outcome.restore.status, "restored")
        self.assertEqual(outcome.restore.reason, "validation-failure")
        self.assertIn("kept.md", outcome.restore.restored)
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")
        self.assertEqual(git(self.repo, "status", "--porcelain").strip(), "")

    def test_passing_validation_keeps_the_changes(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("intentional change\n", encoding="utf-8")

        outcome = tool.run_guarded_validation(
            self.load(checkpoint),
            ["python3", "-m", "unittest", "discover"],
            self.repo,
            runner=self.fake_runner(0),
        )

        self.assertEqual(outcome.status, "passed")
        self.assertIsNone(outcome.restore)
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "intentional change\n")

    def test_validation_command_is_required(self) -> None:
        checkpoint = self.create()
        with self.assertRaises(tool.CheckpointError):
            tool.run_guarded_validation(self.load(checkpoint), [], self.repo)

    def test_real_subprocess_failure_is_rolled_back(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        outcome = tool.run_guarded_validation(
            self.load(checkpoint),
            [sys.executable, "-c", "raise SystemExit(3)"],
            self.repo,
        )

        self.assertEqual(outcome.exit_code, 3)
        self.assertEqual(outcome.status, "rolled-back")
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")


class RollbackFailureTests(TemporaryRepositoryTestCase):
    """Property 5: a failed rollback is explicit and never hidden."""

    def test_corrupt_store_raises_rollback_error(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        kept = next(entry for entry in stored.entries if entry.path == "kept.md")
        blob = Path(stored.store) / stored.checkpoint_id / "blobs" / kept.blob
        blob.write_bytes(b"tampered\n")
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(stored, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertTrue(report.manual_intervention_required)
        self.assertIn(report.status, {"failed", "partial"})
        self.assertIn("kept.md", report.failed)
        self.assertTrue(any("tampered" in failure or "digest" in failure for failure in report.failures))

    def test_write_failure_during_rollback_is_not_swallowed(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        with mock.patch.object(
            tool, "_write_file", side_effect=OSError("disk is read-only")
        ):
            with self.assertRaises(tool.RollbackError) as raised:
                tool.rollback(stored, "validation-failure", self.repo)

        report = raised.exception.report
        self.assertTrue(report.manual_intervention_required)
        self.assertIn("kept.md", report.failed)
        self.assertTrue(any("read-only" in failure for failure in report.failures))

    def test_partial_rollback_is_reported_as_partial(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")
        (self.repo / "dropped.md").write_text("also changed\n", encoding="utf-8")

        original = tool._restore_one

        def selective(checkpoint_arg, entry, target):
            if entry.path == "kept.md":
                raise OSError("injected failure")
            return original(checkpoint_arg, entry, target)

        with mock.patch.object(tool, "_restore_one", side_effect=selective):
            with self.assertRaises(tool.RollbackError) as raised:
                tool.rollback(stored, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertEqual(report.status, "partial")
        self.assertEqual(report.restored, ("dropped.md",))
        self.assertEqual(report.failed, ("kept.md",))

    def test_cli_returns_dedicated_exit_code_on_rollback_failure(self) -> None:
        checkpoint = self.create()
        stored = self.load(checkpoint)
        kept = next(entry for entry in stored.entries if entry.path == "kept.md")
        blob = Path(stored.store) / stored.checkpoint_id / "blobs" / kept.blob
        blob.write_bytes(b"tampered\n")
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        stdout = io.StringIO()
        stderr = io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            exit_code = tool.main(
                ["--store", str(self.store), "rollback", "--id", stored.checkpoint_id, "--cause", "worker-failure"]
            )

        self.assertEqual(exit_code, tool.EXIT_ROLLBACK_FAILED)
        self.assertEqual(stdout.getvalue(), "")
        payload, _ = json.JSONDecoder().raw_decode(stderr.getvalue())
        self.assertTrue(payload["manual_intervention_required"])
        self.assertIn("manual intervention is required", stderr.getvalue())

    def test_tool_only_ever_uses_allowlisted_read_only_git_commands(self) -> None:
        allowed = {
            "rev-parse",
            "HEAD",
            "branch",
            "--show-current",
            "status",
            "--porcelain",
            "--untracked-files=all",
            "ls-files",
            "--error-unmatch",
            "--",
        }
        tree = ast.parse(MODULE_PATH.read_text(encoding="utf-8"))
        git_calls = 0
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                continue
            if node.func.id != "_run_git" or len(node.args) < 2:
                continue
            git_calls += 1
            arguments = node.args[1]
            assert isinstance(arguments, ast.List), "_run_git must receive a literal list"
            elements = arguments.elts
            for position, element in enumerate(elements):
                if isinstance(element, ast.Starred):
                    assert isinstance(element.value, ast.Name)
                    assert element.value.id in {"directories"}, (
                        "starred git pathspec must come from the internal directory list"
                    )
                    continue
                if isinstance(element, ast.Name) and position == len(elements) - 1:
                    continue
                assert isinstance(element, ast.Constant) and element.value in allowed, (
                    f"git argument outside the read-only allowlist: {ast.dump(element)}"
                )
        self.assertGreaterEqual(git_calls, 1)


class BlockedStateTests(TemporaryRepositoryTestCase):
    """Property 8: BLOCKED must not leave uncontrolled changes."""

    def test_uncontrolled_changes_are_reported(self) -> None:
        (self.repo / "kept.md").write_text("half finished\n", encoding="utf-8")

        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=self.scoped)

        self.assertTrue(report.has_uncontrolled_changes)
        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertEqual(report.uncontrolled, ("kept.md",))
        self.assertEqual(report.clean, ("dropped.md",))

    def test_blocked_check_is_clear_after_rollback(self) -> None:
        checkpoint = self.create()
        (self.repo / "kept.md").write_text("half finished\n", encoding="utf-8")
        tool.rollback(self.load(checkpoint), "blocked", self.repo)

        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=self.scoped)

        self.assertFalse(report.has_uncontrolled_changes)
        self.assertEqual(report.status, "clear")
        self.assertEqual(report.uncontrolled, ())
        self.assertEqual(sorted(report.checkpointed), sorted(self.scoped))

    def test_blocked_check_is_clear_when_nothing_was_touched(self) -> None:
        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=self.scoped)
        self.assertEqual(report.status, "clear")
        self.assertEqual(report.clean, ("kept.md", "dropped.md"))
        self.assertTrue(any("no checkpoint found" in note for note in report.notes))

    def test_acknowledgement_is_recorded_and_not_treated_as_pass(self) -> None:
        (self.repo / "kept.md").write_text("half finished\n", encoding="utf-8")

        report = tool.blocked_check(
            self.repo,
            self.store,
            task_id="T004",
            paths=self.scoped,
            acknowledgement="human owner keeps the work in progress, 2026-10-05",
        )

        self.assertEqual(report.status, "acknowledged")
        self.assertIsNotNone(report.acknowledgement)
        self.assertTrue(any("not a PASS" in note for note in report.notes))

    def test_blocked_check_requires_a_path(self) -> None:
        with self.assertRaises(tool.CheckpointError):
            tool.blocked_check(self.repo, self.store, task_id="T004", paths=[])


class BlockerRegressionTests(TemporaryRepositoryTestCase):
    """Regression tests for the four blockers identified in T004 review."""

    def test_blocked_check_fails_closed_for_uncovered_modified_file(self) -> None:
        """blocked_check must NOT report 'clear' for a modified file not in checkpoint."""
        # Create checkpoint only for kept.md
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])

        # Modify dropped.md (not in checkpoint)
        (self.repo / "dropped.md").write_text("modified but not snapshotted\n", encoding="utf-8")

        # blocked_check on dropped.md should report uncontrolled-changes
        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=["dropped.md"])

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertIn("dropped.md", report.uncontrolled)
        self.assertNotIn("dropped.md", report.checkpointed)
        self.assertTrue(any("not covered by checkpoint" in note for note in report.notes))

    def test_blocked_check_fails_closed_for_uncovered_new_file(self) -> None:
        """blocked_check must NOT report 'clear' for a new file not in checkpoint."""
        tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])

        # Create a new file not in checkpoint
        (self.repo / "new_file.md").write_text("new\n", encoding="utf-8")

        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=["new_file.md"])

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertIn("new_file.md", report.uncontrolled)
        self.assertNotIn("new_file.md", report.checkpointed)

    def test_blocked_check_fails_closed_for_uncovered_deleted_file(self) -> None:
        """blocked_check must NOT report 'clear' for a deleted file not in checkpoint."""
        tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])
        (self.repo / "dropped.md").write_text("to be deleted\n", encoding="utf-8")
        git(self.repo, "add", "dropped.md")
        git(self.repo, "commit", "--quiet", "-m", "add dropped")
        (self.repo / "dropped.md").unlink()

        report = tool.blocked_check(self.repo, self.store, task_id="T004", paths=["dropped.md"])

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertIn("dropped.md", report.uncontrolled)

    def test_verify_checkpoint_detects_mode_change(self) -> None:
        """verify_checkpoint must detect file mode/permission changes."""
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])

        # Change mode from 0644 to 0755
        (self.repo / "kept.md").chmod(0o755)

        drifted = tool.verify_checkpoint(self.load(checkpoint), self.repo)

        self.assertIn("kept.md", drifted)

    def test_verify_checkpoint_restores_mode(self) -> None:
        """Restored file should have the original mode from checkpoint."""
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])

        # Change content and mode
        (self.repo / "kept.md").write_text("corrupted\n", encoding="utf-8")
        (self.repo / "kept.md").chmod(0o755)

        report = tool.restore_checkpoint(self.load(checkpoint), self.repo, reason="manual")

        self.assertEqual(report.status, "restored")
        restored_mode = oct((self.repo / "kept.md").stat().st_mode & 0o777)
        self.assertEqual(restored_mode, "0o644")

    def test_run_guarded_validation_rolls_back_on_executable_not_found(self) -> None:
        """run_guarded_validation must rollback when executable is not found."""
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        # Use a non-existent executable
        outcome = tool.run_guarded_validation(
            self.load(checkpoint),
            ["/this/executable/does/not/exist", "arg"],
            self.repo,
        )

        self.assertEqual(outcome.exit_code, -1)
        self.assertEqual(outcome.status, "rolled-back")
        self.assertIsNotNone(outcome.restore)
        self.assertEqual(outcome.restore.status, "restored")
        self.assertEqual(outcome.restore.reason, "validation-failure")
        self.assertIn("kept.md", outcome.restore.restored)
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")

    def test_run_guarded_validation_rolls_back_on_permission_error(self) -> None:
        """run_guarded_validation must rollback when command fails with PermissionError."""
        checkpoint = tool.create_checkpoint(self.repo, self.store, task_id="T004", paths=["kept.md"])
        (self.repo / "kept.md").write_text("broken change\n", encoding="utf-8")

        def permission_error_runner(command, **kwargs):
            raise PermissionError("Permission denied")

        outcome = tool.run_guarded_validation(
            self.load(checkpoint),
            ["some_command"],
            self.repo,
            runner=permission_error_runner,
        )

        self.assertEqual(outcome.exit_code, -1)
        self.assertEqual(outcome.status, "rolled-back")
        self.assertIsNotNone(outcome.restore)
        self.assertEqual(outcome.restore.status, "restored")

    def test_worker_session_auto_rollback_on_exception(self) -> None:
        """Worker session context manager must auto-rollback on exception."""
        session = tool.create_worker_session(
            self.repo, self.store, task_id="T004", paths=["kept.md", "dropped.md"]
        )

        # Verify checkpoint was created
        self.assertIsNotNone(session.checkpoint)

        # Modify files inside the session
        (self.repo / "kept.md").write_text("worker output\n", encoding="utf-8")
        (self.repo / "dropped.md").write_text("more output\n", encoding="utf-8")

        # Simulate worker failure by raising exception in context
        with self.assertRaises(RuntimeError):
            with session:
                raise RuntimeError("worker crashed")

        # After exception, files should be restored
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")
        self.assertEqual((self.repo / "dropped.md").read_text(encoding="utf-8"), "beta\n")
        self.assertEqual(git(self.repo, "status", "--porcelain").strip(), "")

    def test_worker_session_no_rollback_on_success(self) -> None:
        """Worker session must NOT rollback on successful completion."""
        session = tool.create_worker_session(
            self.repo, self.store, task_id="T004", paths=["kept.md"]
        )

        with session:
            (self.repo / "kept.md").write_text("intentional change\n", encoding="utf-8")

        # Changes should persist
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "intentional change\n")

    def test_worker_session_rollback_failure_propagates(self) -> None:
        """If rollback itself fails during worker session, it should propagate."""
        session = tool.create_worker_session(
            self.repo, self.store, task_id="T004", paths=["kept.md"]
        )

        # Corrupt the checkpoint store
        stored = self.load(session.checkpoint)
        kept = next(entry for entry in stored.entries if entry.path == "kept.md")
        blob = Path(stored.store) / stored.checkpoint_id / "blobs" / kept.blob
        blob.write_bytes(b"tampered\n")
        (self.repo / "kept.md").write_text("worker output\n", encoding="utf-8")

        # Exception in session should trigger rollback, which should fail
        with self.assertRaises(tool.RollbackError):
            with session:
                raise RuntimeError("worker crashed")

        # The file should still be in the corrupted state (rollback failed)
        # but the RollbackError should have been raised

    def test_subdirectory_purge_not_supported(self) -> None:
        """Rollback must not purge new files in subdirectories outside checkpoint scope."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")

        checkpoint = tool.create_checkpoint(
            self.repo,
            self.store,
            task_id="T004",
            paths=["scoped/tracked.md"],
        )
        # Create a new file in the same directory (not in checkpoint)
        (scoped_directory / "neighbor.txt").write_text("neighbor\n", encoding="utf-8")

        report = tool.rollback(self.load(checkpoint), "worker-failure", self.repo)

        self.assertEqual(report.status, "restored")
        self.assertEqual(report.removed, ())
        self.assertTrue(
            (scoped_directory / "neighbor.txt").exists(),
            "neighbor.txt should not be purged; subdirectory purge is not supported",
        )
        self.assertIn(
            "subdirectory purge is not supported",
            " ".join(report.notes),
        )


class CliTests(TemporaryRepositoryTestCase):
    """The CLI is the interface an agent uses, so its exit codes are covered."""

    def run_cli(self, *arguments: str):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            exit_code = tool.main(list(arguments))
        return exit_code, stdout.getvalue(), stderr.getvalue()

    def test_create_verify_and_blocked_check_round_trip(self) -> None:
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "create",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "kept.md",
            "--path",
            "dropped.md",
        )
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        checkpoint_id = json.loads(stdout)["checkpoint_id"]

        exit_code, stdout, stderr = self.run_cli(
            "--store", str(self.store), "verify", "--id", checkpoint_id
        )
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        self.assertEqual(json.loads(stdout)["status"], "match")

        (self.repo / "kept.md").write_text("changed\n", encoding="utf-8")
        exit_code, stdout, stderr = self.run_cli(
            "--store", str(self.store), "verify", "--id", checkpoint_id
        )
        self.assertEqual(exit_code, tool.EXIT_DRIFT)
        self.assertEqual(json.loads(stdout)["drifted"], ["kept.md"])

        exit_code, stdout, stderr = self.run_cli(
            "--store", str(self.store), "restore", "--id", checkpoint_id
        )
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        self.assertEqual(json.loads(stdout)["status"], "restored")

    def test_blocked_check_exits_non_zero_on_uncontrolled_changes(self) -> None:
        (self.repo / "kept.md").write_text("changed\n", encoding="utf-8")
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "blocked-check",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "kept.md",
        )
        self.assertEqual(exit_code, tool.EXIT_BLOCKED)
        self.assertEqual(json.loads(stdout)["status"], "uncontrolled-changes")

    def test_store_inside_repository_exits_with_usage_error(self) -> None:
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.repo / "inside"),
            "create",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "kept.md",
        )
        self.assertEqual(exit_code, tool.EXIT_USAGE)
        self.assertIn("outside the repository working tree", stderr)

    def test_run_validation_rolls_back_and_reports_exit_code(self) -> None:
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "create",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "kept.md",
        )
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        checkpoint_id = json.loads(stdout)["checkpoint_id"]

        (self.repo / "kept.md").write_text("changed\n", encoding="utf-8")
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "run-validation",
            "--id",
            checkpoint_id,
            "--",
            sys.executable,
            "-c",
            "raise SystemExit(4)",
        )
        self.assertEqual(exit_code, 1)
        payload = json.loads(stdout)
        self.assertEqual(payload["status"], "rolled-back")
        self.assertEqual(payload["exit_code"], 4)
        self.assertEqual((self.repo / "kept.md").read_text(encoding="utf-8"), "alpha\n")

    def test_list_reports_stored_checkpoints(self) -> None:
        self.create()
        exit_code, stdout, stderr = self.run_cli("--store", str(self.store), "list", "--task", "T004")
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        payload = json.loads(stdout)
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["checkpoints"], ["CP-T004-001"])


if __name__ == "__main__":
    unittest.main(verbosity=2)