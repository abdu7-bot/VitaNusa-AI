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

    def test_task_id_cannot_escape_checkpoint_store(self) -> None:
        for task_id in ("../escape", "/../../repo/pwn", r"..\escape"):
            with self.subTest(task_id=task_id):
                with self.assertRaises(tool.CheckpointError):
                    self.create(task_id=task_id)
        self.assertEqual(list(self.store.iterdir()) if self.store.exists() else [], [])

    def test_checkpoint_refuses_symlinked_parent(self) -> None:
        target = self.repo / "target"
        target.mkdir()
        (target / "file.md").write_text("target\n", encoding="utf-8")
        (self.repo / "link").symlink_to(target, target_is_directory=True)

        with self.assertRaises(tool.CheckpointError) as raised:
            tool.create_checkpoint(
                self.repo, self.store, task_id="T004", paths=["link/file.md"]
            )

        self.assertIn("symlinked parent", str(raised.exception))


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

    def test_restore_refuses_parent_symlink_redirect(self) -> None:
        scope = self.repo / "scope"
        target = self.repo / "target"
        scope.mkdir()
        target.mkdir()
        (scope / "file.md").write_text("checkpointed\n", encoding="utf-8")
        (target / "file.md").write_text("out of scope\n", encoding="utf-8")
        git(self.repo, "add", "scope/file.md", "target/file.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped and target files")

        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scope/file.md"]
        )
        (scope / "file.md").unlink()
        scope.rmdir()
        scope.symlink_to(target, target_is_directory=True)

        with self.assertRaises(tool.RollbackError) as raised:
            tool.restore_checkpoint(self.load(checkpoint), self.repo)

        report = raised.exception.report
        self.assertEqual(report.status, "failed")
        self.assertEqual(report.failed, ("scope/file.md",))
        self.assertTrue(report.manual_intervention_required)
        self.assertEqual((target / "file.md").read_text(encoding="utf-8"), "out of scope\n")

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

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(self.load(checkpoint), "worker-failure", self.repo)
        guarded = raised.exception.report
        self.assertEqual(guarded.status, "failed")
        self.assertEqual(guarded.failed, ("worker-output.md",))
        self.assertTrue(guarded.manual_intervention_required)
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

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(self.load(checkpoint), "worker-failure", self.repo)

        report = raised.exception.report
        self.assertEqual(report.status, "partial")
        self.assertEqual(report.failed, ("scoped/worker-output.md",))
        self.assertTrue(report.manual_intervention_required)
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
            "--others",
            "--ignored",
            "--exclude-standard",
            "diff",
            "--cached",
            "--name-only",
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
        (scoped_directory / "tracked.md").write_text("worker changed\n", encoding="utf-8")
        (scoped_directory / "neighbor.txt").write_text("neighbor\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(self.load(checkpoint), "worker-failure", self.repo)

        report = raised.exception.report
        self.assertEqual(report.status, "partial")
        self.assertEqual(report.failed, ("scoped/neighbor.txt",))
        self.assertTrue(report.manual_intervention_required)
        self.assertEqual(report.restored, ("scoped/tracked.md",))
        self.assertTrue((scoped_directory / "neighbor.txt").exists())
        self.assertIn("subdirectory purge is not supported", " ".join(report.notes))

    def test_worker_session_surfaces_incomplete_subdirectory_rollback(self) -> None:
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        session = tool.create_worker_session(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        with self.assertRaises(tool.RollbackError) as raised:
            with session:
                (scoped_directory / "tracked.md").write_text("changed\n", encoding="utf-8")
                (scoped_directory / "neighbor.txt").write_text("worker output\n", encoding="utf-8")
                raise RuntimeError("worker failed")

        report = raised.exception.report
        self.assertEqual(report.status, "partial")
        self.assertTrue(report.manual_intervention_required)
        self.assertEqual(report.failed, ("scoped/neighbor.txt",))
        self.assertEqual((scoped_directory / "tracked.md").read_text(encoding="utf-8"), "tracked\n")
        self.assertTrue((scoped_directory / "neighbor.txt").exists())

    def test_blocked_check_detects_new_file_in_checkpoint_scope(self) -> None:
        """blocked_check must fail closed over the whole checkpoint scope.

        A new untracked file inside a checkpoint scope directory is
        uncontrolled worker output even when the caller names only the
        checkpointed path.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        (scoped_directory / "neighbor.txt").write_text("worker output\n", encoding="utf-8")

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertEqual(report.uncontrolled, ("scoped/neighbor.txt",))
        self.assertEqual(report.checkpointed, ("scoped/tracked.md",))
        self.assertTrue(
            any("checkpoint scope" in note for note in report.notes),
            report.notes,
        )

    def test_blocked_check_detects_modified_tracked_file_in_checkpoint_scope(
        self,
    ) -> None:
        """A modified tracked file inside the checkpoint scope is uncontrolled."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        (scoped_directory / "other.md").write_text("other\n", encoding="utf-8")
        git(self.repo, "add", "scoped")
        git(self.repo, "commit", "--quiet", "-m", "add scoped files")
        tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        (scoped_directory / "other.md").write_text("worker modified\n", encoding="utf-8")

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertIn("scoped/other.md", report.uncontrolled)

    def test_blocked_check_detects_deleted_tracked_file_in_checkpoint_scope(
        self,
    ) -> None:
        """A deleted tracked file inside the checkpoint scope is uncontrolled."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        (scoped_directory / "doomed.md").write_text("doomed\n", encoding="utf-8")
        git(self.repo, "add", "scoped")
        git(self.repo, "commit", "--quiet", "-m", "add scoped files")
        tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        (scoped_directory / "doomed.md").unlink()

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        self.assertEqual(report.status, "uncontrolled-changes")
        self.assertIn("scoped/doomed.md", report.uncontrolled)

    def test_blocked_check_ignores_files_untracked_before_the_checkpoint(
        self,
    ) -> None:
        """Files already untracked at checkpoint time are not worker output."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        (scoped_directory / "preexisting.txt").write_text(
            "was already untracked\n", encoding="utf-8"
        )
        tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        self.assertEqual(report.status, "clear")
        self.assertEqual(report.uncontrolled, ())

    def test_blocked_check_head_clean_lists_paths_matching_head(self) -> None:
        """`head_clean` must list paths identical to HEAD, not dirty ones."""
        (self.repo / "new_file.md").write_text("new\n", encoding="utf-8")

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["new_file.md", "dropped.md"]
        )

        self.assertEqual(report.clean, ("dropped.md",))
        self.assertEqual(report.head_clean, ("dropped.md",))
        self.assertIn("new_file.md", report.uncontrolled)
        self.assertNotIn("new_file.md", report.head_clean)

    def test_blocked_check_still_clear_when_scope_is_unchanged(self) -> None:
        """A clean checkpoint scope with caller-named covered paths stays clear."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        report = tool.blocked_check(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )

        self.assertEqual(report.status, "clear")
        self.assertEqual(report.uncontrolled, ())

    # === New regression tests for staged/ignored file detection ===

    def test_rollback_detects_untracked_file_created_by_worker(self) -> None:
        """Rollback must detect and fail on untracked file created by worker."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates untracked file
        (scoped_directory / "worker_output.txt").write_text("worker\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn("scoped/worker_output.txt", report.failed)
        self.assertTrue(report.manual_intervention_required)
        self.assertNotEqual(report.status, "restored")

    def test_rollback_detects_staged_new_file_created_by_worker(self) -> None:
        """Rollback must detect and fail on staged new file created by worker."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates new file and stages it
        (scoped_directory / "staged_new.txt").write_text("staged\n", encoding="utf-8")
        git(self.repo, "add", "scoped/staged_new.txt")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn("scoped/staged_new.txt", report.failed)
        self.assertTrue(report.manual_intervention_required)
        self.assertNotEqual(report.status, "restored")

    def test_rollback_detects_staged_modification_of_tracked_file(self) -> None:
        """Rollback must fail when staged modification remains in Git index.

        Even though working tree content is restored to checkpoint state,
        the Git index still contains the worker's staged change. Rollback
        must not report 'restored' in this case.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker modifies tracked file and stages it
        (scoped_directory / "tracked.md").write_text("modified\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn(report.status, {"partial", "failed"})
        self.assertIn("scoped/tracked.md", report.failed)
        self.assertTrue(report.manual_intervention_required)
        # Working tree content must still be restored to checkpoint
        self.assertEqual((scoped_directory / "tracked.md").read_text(), "tracked\n")

    def test_rollback_detects_staged_deletion_of_tracked_file(self) -> None:
        """Rollback must detect and fail on staged deletion of tracked file."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        (scoped_directory / "other.md").write_text("other\n", encoding="utf-8")
        git(self.repo, "add", "scoped")
        git(self.repo, "commit", "--quiet", "-m", "add scoped files")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker deletes other.md and stages deletion
        (scoped_directory / "other.md").unlink()
        git(self.repo, "add", "scoped/other.md")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn("scoped/other.md", report.failed)
        self.assertTrue(report.manual_intervention_required)
        self.assertNotEqual(report.status, "restored")

    def test_rollback_detects_ignored_file_created_by_worker(self) -> None:
        """Rollback must detect and fail on ignored file created by worker."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Add .gitignore for the scoped directory
        (scoped_directory / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
        git(self.repo, "add", "scoped/.gitignore")
        git(self.repo, "commit", "--quiet", "-m", "add gitignore")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates ignored file
        (scoped_directory / "secret.ignored").write_text("secret\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn("scoped/secret.ignored", report.failed)
        self.assertTrue(report.manual_intervention_required)
        self.assertNotEqual(report.status, "restored")

    def test_rollback_preserves_preexisting_untracked_file(self) -> None:
        """Pre-existing untracked file at checkpoint time must not be removed."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Pre-existing untracked file
        (scoped_directory / "preexisting.txt").write_text("pre-existing\n", encoding="utf-8")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker modifies tracked file
        (scoped_directory / "tracked.md").write_text("worker\n", encoding="utf-8")

        # Rollback should succeed - only checkpointed file changed
        report = tool.rollback(checkpoint, "worker-failure", self.repo)

        self.assertEqual(report.status, "restored")
        self.assertIn("scoped/tracked.md", report.restored)
        # Pre-existing file must still exist
        self.assertTrue((scoped_directory / "preexisting.txt").exists())
        self.assertEqual((scoped_directory / "preexisting.txt").read_text(), "pre-existing\n")
        self.assertFalse(report.manual_intervention_required)

    def test_rollback_preserves_preexisting_ignored_file(self) -> None:
        """Pre-existing ignored file at checkpoint time must not be treated as worker change."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Add .gitignore
        (scoped_directory / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
        git(self.repo, "add", "scoped/.gitignore")
        git(self.repo, "commit", "--quiet", "-m", "add gitignore")
        # Pre-existing ignored file
        (scoped_directory / "preexisting.ignored").write_text("pre-existing\n", encoding="utf-8")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker modifies tracked file
        (scoped_directory / "tracked.md").write_text("worker\n", encoding="utf-8")

        # Rollback should succeed - only checkpointed file changed
        report = tool.rollback(checkpoint, "worker-failure", self.repo)

        self.assertEqual(report.status, "restored")
        self.assertIn("scoped/tracked.md", report.restored)
        # Pre-existing ignored file must still exist and not be in failed
        self.assertTrue((scoped_directory / "preexisting.ignored").exists())
        self.assertNotIn("scoped/preexisting.ignored", report.failed)
        self.assertFalse(report.manual_intervention_required)

    def test_rollback_never_reports_restored_when_worker_files_remain(self) -> None:
        """Rollback must not report 'restored' if any worker-created file remains."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates untracked file
        (scoped_directory / "worker.txt").write_text("worker\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        # Must not be "restored" - must be "partial" or "failed"
        self.assertIn(report.status, {"partial", "failed"})
        self.assertTrue(report.manual_intervention_required)
        # Worker file must be in failed
        self.assertIn("scoped/worker.txt", report.failed)

    def test_rollback_failure_always_has_manual_intervention_required(self) -> None:
        """Rollback failure must always set manual_intervention_required=True."""
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates untracked file
        (scoped_directory / "worker.txt").write_text("worker\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertTrue(report.manual_intervention_required)
        self.assertIn("scoped/worker.txt", report.failed)

    def test_rollback_fails_on_staged_modification_index_residue(self) -> None:
        """Rollback must fail when Git index still contains staged worker change.

        Even after working tree content is restored to checkpoint state,
        the Git index may still hold the worker's staged modification.
        Rollback must not report 'restored' in this case.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker modifies tracked file and stages it
        (scoped_directory / "tracked.md").write_text("modified\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn(report.status, {"partial", "failed"})
        self.assertIn("scoped/tracked.md", report.failed)
        self.assertTrue(report.manual_intervention_required)
        # Working tree content must still be restored to checkpoint
        self.assertEqual((scoped_directory / "tracked.md").read_text(), "tracked\n")

    def test_rollback_fails_on_git_discovery_error(self) -> None:
        """Rollback must fail when Git discovery fails, not silently succeed.

        A Git error during discovery must not be treated as "no changes found".
        """

        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker creates untracked file
        (scoped_directory / "worker.txt").write_text("worker\n", encoding="utf-8")

        # Force a Git error during discovery by patching _run_git_or_raise
        def failing_git(*args, **kwargs):
            raise tool.CheckpointError("injected git failure")

        with mock.patch.object(tool, "_run_git_or_raise", side_effect=failing_git):
            with self.assertRaises((tool.RollbackError, tool.CheckpointError)):
                tool.rollback(checkpoint, "worker-failure", self.repo)

    def test_rollback_fails_on_modified_preexisting_ignored_file(self) -> None:
        """Rollback must fail when worker modifies content of pre-existing ignored file.

        Pre-existing ignored files must not be deleted, but a content change
        by the worker is still worker output and must be reported.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Add .gitignore
        (scoped_directory / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
        git(self.repo, "add", "scoped/.gitignore")
        git(self.repo, "commit", "--quiet", "-m", "add gitignore")
        # Pre-existing ignored file
        (scoped_directory / "preexisting.ignored").write_text("pre-existing\n", encoding="utf-8")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker modifies tracked file AND modifies ignored file content
        (scoped_directory / "tracked.md").write_text("worker\n", encoding="utf-8")
        (scoped_directory / "preexisting.ignored").write_text("worker modified ignored\n", encoding="utf-8")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn(report.status, {"partial", "failed"})
        self.assertTrue(report.manual_intervention_required)
        # Pre-existing ignored file must still exist
        self.assertTrue((scoped_directory / "preexisting.ignored").exists())
        # Must NOT be deleted
        self.assertNotIn("scoped/preexisting.ignored", report.removed)
        # Must be reported as failed
        self.assertIn("scoped/preexisting.ignored", report.failed)

    def test_rollback_root_scope_purge_staged_addition_index_residue(self) -> None:
        """Root-scope purge must detect staged addition that was removed from disk.

        With allow_root_scope_purge=True, a staged new file is purged from
        the working tree but still lives in the Git index. Rollback must
        not report 'restored' in this case.
        """
        (self.repo / "tracked.md").write_text("alpha\n", encoding="utf-8")
        git(self.repo, "add", "tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "baseline")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["tracked.md"]
        )
        # Worker creates a new file and stages it
        (self.repo / "worker_new.txt").write_text("worker\n", encoding="utf-8")
        git(self.repo, "add", "worker_new.txt")

        # Rollback with root-scope purge opt-in
        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(
                self.load(checkpoint),
                "worker-failure",
                self.repo,
                allow_root_scope_purge=True,
            )

        report = raised.exception.report
        self.assertIn(report.status, {"partial", "failed"})
        self.assertTrue(report.manual_intervention_required)
        # The staged addition must be detected in the index
        self.assertIn("worker_new.txt", report.failed)

    def test_rollback_fails_on_cached_index_query_error(self) -> None:
        """Post-restore index verification must not swallow Git errors.

        A failure in git diff --cached during index verification must
        produce a rollback failure, not silently pass.
        """
        (self.repo / "tracked.md").write_text("alpha\n", encoding="utf-8")
        git(self.repo, "add", "tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "baseline")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["tracked.md"]
        )
        # Worker modifies tracked file
        (self.repo / "tracked.md").write_text("worker\n", encoding="utf-8")

        original = tool._run_git_or_raise

        def failing_git(*args, **kwargs):
            if "diff" in args[1] and "--cached" in args[1]:
                raise tool.CheckpointError("injected git diff --cached failure")
            return original(*args, **kwargs)

        with mock.patch.object(tool, "_run_git_or_raise", side_effect=failing_git):
            with self.assertRaises(tool.RollbackError) as raised:
                tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertTrue(report.manual_intervention_required)
        self.assertIn("tracked.md", report.failed)

    def test_rollback_detects_modified_preexisting_ignored_symlink(self) -> None:
        """Rollback must detect when worker modifies a pre-existing ignored symlink.

        Pre-existing ignored symlinks must have their target fingerprinted
        at checkpoint time. A change to the symlink target is worker output
        and must be reported. The symlink itself must not be deleted.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Add .gitignore
        (scoped_directory / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
        git(self.repo, "add", "scoped/.gitignore")
        git(self.repo, "commit", "--quiet", "-m", "add gitignore")
        # Pre-existing ignored symlink
        (scoped_directory / "link.ignored").symlink_to("tracked.md")
        checkpoint = tool.create_checkpoint(
            self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
        )
        # Worker changes the symlink target
        (scoped_directory / "link.ignored").unlink()
        (scoped_directory / "link.ignored").symlink_to("other_target.md")

        with self.assertRaises(tool.RollbackError) as raised:
            tool.rollback(checkpoint, "worker-failure", self.repo)

        report = raised.exception.report
        self.assertIn(report.status, {"partial", "failed"})
        self.assertTrue(report.manual_intervention_required)
        # The pre-existing ignored symlink must not be deleted by rollback.
        # The symlink itself is preserved; a worker-retargeted symlink may
        # legitimately point at a non-existent target, in which case
        # Path.exists() follows the link and returns False even though the
        # symlink inode is intact. The correct invariant is that the path is
        # still a symlink and still points at the worker's chosen target.
        link = scoped_directory / "link.ignored"
        self.assertTrue(link.is_symlink(), "pre-existing ignored symlink was deleted by rollback")
        self.assertEqual(os.readlink(link), "other_target.md")
        # Must NOT be deleted
        self.assertNotIn("scoped/link.ignored", report.removed)
        # Must be reported as failed
        self.assertIn("scoped/link.ignored", report.failed)

    def test_rollback_fails_on_ignored_baseline_read_failure(self) -> None:
        """Rollback must fail closed when ignored baseline cannot be fingerprinted.

        If a pre-existing ignored file cannot be read at checkpoint time,
        the checkpoint creation must fail rather than silently producing
        an incomplete baseline.
        """
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        # Add .gitignore
        (scoped_directory / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
        git(self.repo, "add", "scoped/.gitignore")
        git(self.repo, "commit", "--quiet", "-m", "add gitignore")
        # Pre-existing ignored file
        (scoped_directory / "preexisting.ignored").write_text("pre-existing\n", encoding="utf-8")

        # Simulate baseline fingerprint failure by patching read_bytes
        original_read_bytes = Path.read_bytes

        def failing_read_bytes(self_path):
            if self_path.name == "preexisting.ignored":
                raise OSError("injected read failure")
            return original_read_bytes(self_path)

        with mock.patch.object(Path, "read_bytes", failing_read_bytes):
            with self.assertRaises(tool.CheckpointError):
                tool.create_checkpoint(
                    self.repo, self.store, task_id="T004", paths=["scoped/tracked.md"]
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

    def test_blocked_check_exits_non_zero_for_scope_detected_change(
        self,
    ) -> None:
        scoped_directory = self.repo / "scoped"
        scoped_directory.mkdir()
        (scoped_directory / "tracked.md").write_text("tracked\n", encoding="utf-8")
        git(self.repo, "add", "scoped/tracked.md")
        git(self.repo, "commit", "--quiet", "-m", "add scoped file")
        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "create",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "scoped/tracked.md",
        )
        self.assertEqual(exit_code, tool.EXIT_OK, stderr)
        (scoped_directory / "neighbor.txt").write_text(
            "worker output\n", encoding="utf-8"
        )

        exit_code, stdout, stderr = self.run_cli(
            "--store",
            str(self.store),
            "blocked-check",
            "--repo",
            str(self.repo),
            "--task",
            "T004",
            "--path",
            "scoped/tracked.md",
        )

        self.assertEqual(exit_code, tool.EXIT_BLOCKED)
        payload = json.loads(stdout)
        self.assertEqual(payload["status"], "uncontrolled-changes")
        self.assertIn("scoped/neighbor.txt", payload["uncontrolled"])

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