#!/usr/bin/env python3
"""Tests untuk `scripts/task_audit_log.py` (T005)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "task_audit_log.py"


def load_tool_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("task_audit_log", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


tool = load_tool_module()


class TemporaryAuditTestCase(unittest.TestCase):
    """Base fixture: temporary audit store."""

    def setUp(self) -> None:
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.store = Path(self.workspace.name) / "audit"

    def _run_cli(self, *args: str) -> tuple[int, str, str]:
        """Jalankan CLI task_audit_log dan kembalikan (exit_code, stdout, stderr)."""
        cmd = [sys.executable, str(MODULE_PATH), *args]
        completed = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        return completed.returncode, completed.stdout, completed.stderr


class AuditLogBasicTests(TemporaryAuditTestCase):
    """Property: append, read, verify integritas."""

    def test_append_and_read_single_event(self) -> None:
        """Satu event bisa ditambah dan dibaca kembali."""
        ev = tool.append_event(
            event_type="task_claimed",
            task_id="T005",
            actor="kilo",
            state_transition="READY -> ACTIVE",
            result="success",
            reason="task claimed by implementer",
            reference="T005-claim-001",
            store=self.store,
        )
        self.assertEqual(ev.task_id, "T005")
        self.assertEqual(ev.event_type, "task_claimed")
        self.assertTrue(ev.checksum)

        events = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].task_id, "T005")
        self.assertEqual(events[0].reference, "T005-claim-001")

    def test_multiple_events_append_only(self) -> None:
        """Event berturut-turut hanya ditambah, tidak menimpa."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        tool.append_event("validation_result", "T005", "kilo", "ACTIVE -> TESTING", "success", "valid", "ref-3", store=self.store)

        events = tool.read_log(self.store)
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0].reference, "ref-1")
        self.assertEqual(events[1].reference, "ref-2")
        self.assertEqual(events[2].reference, "ref-3")

    def test_verify_integrity_clean_log(self) -> None:
        """Log bersih lulus verifikasi integritas."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)

        ok, errors = tool.verify_integrity(self.store)
        self.assertTrue(ok, f"errors: {errors}")
        self.assertEqual(errors, [])

    def test_verify_integrity_detects_tampering(self) -> None:
        """Verifikasi mendeteksi tampering pada file log."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)

        # Tamper file: ubah satu field
        log_file = self.store / "audit.log"
        content = log_file.read_text(encoding="utf-8")
        lines = content.strip().split("\n")
        # ubah reason pada line pertama
        data = json.loads(lines[0])
        data["reason"] = "tampered"
        lines[0] = json.dumps(data, sort_keys=True, separators=(",", ":"))
        log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        ok, errors = tool.verify_integrity(self.store)
        self.assertFalse(ok)
        self.assertGreater(len(errors), 0)


class AuditLogIdempotencyTests(TemporaryAuditTestCase):
    """Property: idempotent berdasarkan reference."""

    def test_duplicate_reference_ignored(self) -> None:
        """Event dengan reference duplikat diabaikan (idempotent)."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "same-ref", store=self.store)
        tool.append_event("task_claimed", "T005", "copilot", "READY -> ACTIVE", "success", "claim again", "same-ref", store=self.store)

        events = tool.read_log(self.store)
        self.assertEqual(len(events), 1, "Duplicate reference should be ignored")
        self.assertEqual(events[0].actor, "kilo")  # First one wins

    def test_find_by_reference(self) -> None:
        """Cari event berdasarkan reference."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "find-me", store=self.store)
        found = tool.find_by_reference("find-me", self.store)
        self.assertIsNotNone(found)
        self.assertEqual(found.reference, "find-me")

        not_found = tool.find_by_reference("not-exist", self.store)
        self.assertIsNone(not_found)


class AuditLogRedactionTests(TemporaryAuditTestCase):
    """Property: secret redaction otomatis."""

    def test_secret_in_metadata_redacted(self) -> None:
        """Secret di metadata diredact sebelum tulis."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE",
            "success",
            "claim with secret",
            "ref-secret-1",
            metadata={"api_key": "sk-12345", "normal": "value"},
            store=self.store,
        )
        events = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        meta = events[0].metadata
        self.assertEqual(meta["api_key"], "[REDACTED]")
        self.assertEqual(meta["normal"], "value")

    def test_various_secret_patterns_redacted(self) -> None:
        """Berbagai pola secret diredact."""
        tool.append_event(
            "validation_result",
            "T005",
            "kilo",
            "ACTIVE -> TESTING",
            "success",
            "validated",
            "ref-secret-2",
            metadata={
                "token": "abc123",
                "password": "secret",
                "apiKey": "key123",
                "private_key": "-----BEGIN PRIVATE KEY-----",
                "health_query": "user health data",
                "safe_field": "ok",
            },
            store=self.store,
        )
        events = tool.read_log(self.store)
        meta = events[0].metadata
        self.assertEqual(meta["token"], "[REDACTED]")
        self.assertEqual(meta["password"], "[REDACTED]")
        self.assertEqual(meta["apiKey"], "[REDACTED]")
        self.assertEqual(meta["private_key"], "[REDACTED]")
        self.assertEqual(meta["health_query"], "[REDACTED]")
        self.assertEqual(meta["safe_field"], "ok")

    def test_nested_secret_redacted(self) -> None:
        """Secret di nested dict/list diredact."""
        tool.append_event(
            "failure",
            "T005",
            "kilo",
            "TESTING -> BLOCKED",
            "failed",
            "nested secret",
            "ref-secret-3",
            metadata={
                "config": {"api_key": "nested-secret"},
                "tokens": ["token1", "token2"],
            },
            store=self.store,
        )
        events = tool.read_log(self.store)
        meta = events[0].metadata
        self.assertEqual(meta["config"]["api_key"], "[REDACTED]")
        self.assertEqual(meta["tokens"], ["[REDACTED]", "[REDACTED]"])


class AuditLogFailSafeTests(TemporaryAuditTestCase):
    """Property: fail-safe write, tidak menghapus log existing."""

    def test_partial_write_does_not_corrupt_existing(self) -> None:
        """Gagal write event baru tidak merusak log existing."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Simulasi gagal write: buat file read-only
        log_file = self.store / "audit.log"
        log_file.chmod(0o444)

        try:
            tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
            # On some systems (e.g., root), read-only may not prevent write
            # If write succeeded, verify integrity is maintained
            events = tool.read_log(self.store)
            if len(events) == 2:
                # Write succeeded despite read-only - verify integrity
                ok, _ = tool.verify_integrity(self.store)
                self.assertTrue(ok, "Integrity broken after write to read-only file")
        except OSError:
            # Write failed as expected - verify existing log intact
            pass
        finally:
            log_file.chmod(0o644)

        # Log existing harus utuh
        events = tool.read_log(self.store)
        # Should have at least the original event
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0].reference, "ref-1")
        ok, _ = tool.verify_integrity(self.store)
        self.assertTrue(ok)

    def test_atomic_write_temp_then_rename(self) -> None:
        """Write menggunakan temp file + rename atomic."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)

        # Pastikan tidak ada temp file tersisa
        temp_files = list(self.store.glob(".audit-*.tmp"))
        self.assertEqual(len(temp_files), 0, f"Temp files remain: {temp_files}")


class AuditLogSchemaTests(TemporaryAuditTestCase):
    """Property: validasi schema ketat."""

    def test_reject_invalid_event_type(self) -> None:
        """Event type tidak valid ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("invalid_type", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

    def test_reject_empty_task_id(self) -> None:
        """task_id kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

    def test_reject_empty_actor(self) -> None:
        """actor kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "T005", "", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

    def test_reject_invalid_timestamp(self) -> None:
        """Timestamp tidak valid ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event(
                "task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1",
                timestamp="invalid-timestamp", store=self.store,
            )

    def test_reject_non_utc_timestamp(self) -> None:
        """Timestamp non-UTC ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event(
                "task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1",
                timestamp="2026-10-17T10:00:00+07:00", store=self.store,
            )

    def test_reject_empty_reference(self) -> None:
        """Reference kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "", store=self.store)


class AuditLogCLITests(TemporaryAuditTestCase):
    """Property: CLI bekerja dengan benar."""

    def test_cli_append_read_verify(self) -> None:
        """CLI append -> read -> verify berfungsi."""
        # Append
        code, out, err = self._run_cli(
            "append",
            "--event-type", "task_claimed",
            "--task-id", "T005",
            "--actor", "kilo",
            "--state-transition", "READY -> ACTIVE",
            "--result", "success",
            "--reason", "cli test",
            "--reference", "cli-ref-1",
            "--store", str(self.store),
        )
        self.assertEqual(code, 0, f"stderr: {err}")

        # Read
        code, out, err = self._run_cli("read", "--store", str(self.store))
        self.assertEqual(code, 0, f"stderr: {err}")
        events = json.loads(out)
        self.assertEqual(len(events), 1)

        # Verify
        code, out, err = self._run_cli("verify", "--store", str(self.store))
        self.assertEqual(code, 0, f"stderr: {err}")
        self.assertIn("OK", out)

    def test_cli_find_by_reference(self) -> None:
        """CLI find by reference."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "cli-find-1", store=self.store)
        code, out, err = self._run_cli("find", "cli-find-1", "--store", str(self.store))
        self.assertEqual(code, 0, f"stderr: {err}")
        self.assertIn("cli-find-1", out)

        code, out, err = self._run_cli("find", "not-exist", "--store", str(self.store))
        self.assertEqual(code, 1)
        self.assertIn("NOT FOUND", out)

    def test_cli_rejects_invalid_json_metadata(self) -> None:
        """CLI menolak metadata JSON invalid."""
        code, out, err = self._run_cli(
            "append",
            "--event-type", "task_claimed",
            "--task-id", "T005",
            "--actor", "kilo",
            "--state-transition", "READY -> ACTIVE",
            "--result", "success",
            "--reason", "test",
            "--reference", "cli-bad-meta",
            "--metadata", "not json",
            "--store", str(self.store),
        )
        self.assertEqual(code, 1)
        self.assertIn("ERROR", err)


class AuditLogFilesystemFailureTests(TemporaryAuditTestCase):
    """Property: penanganan filesystem failure."""

    def test_disk_full_simulation(self) -> None:
        """Simulasi disk full: write gagal tapi log existing aman."""
        # Buat file log dengan satu event
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Mock os.replace untuk gagal (simulasi disk full)
        import sys
        sys.path.insert(0, str(REPO_ROOT))
        import scripts.task_audit_log as mod
        original_replace = os.replace

        def failing_replace(src, dst):
            raise OSError("No space left on device")

        try:
            os.replace = failing_replace
            try:
                tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
                self.fail("Expected OSError")
            except OSError as e:
                self.assertIn("No space left", str(e))
        finally:
            os.replace = original_replace

        # Log existing harus utuh
        events = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].reference, "ref-1")

    def test_corrupted_log_read_returns_partial(self) -> None:
        """Log korup: read_log mengembalikan yang valid, skip yang rusak."""
        """Log korup: read_log mengembalikan yang valid, skip yang rusak."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Corrupt file: tambah baris invalid JSON
        log_file = self.store / "audit.log"
        log_file.write_text(log_file.read_text() + "invalid json line\n", encoding="utf-8")

        # read_log harus skip baris rusak dan return yang valid
        events = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].reference, "ref-1")


class AuditLogCustomStoreTests(TemporaryAuditTestCase):
    """Property: custom store path via arg/env."""

    def test_custom_store_path(self) -> None:
        """Custom store path via argumen."""
        custom = Path(self.workspace.name) / "custom_audit"
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-custom", store=custom)
        events = tool.read_log(custom)
        self.assertEqual(len(events), 1)

    def test_env_var_store(self) -> None:
        """Custom store via env VITANUSA_AUDIT_DIR."""
        custom = Path(self.workspace.name) / "env_audit"
        os.environ["VITANUSA_AUDIT_DIR"] = str(custom)
        try:
            tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-env", store=None)
            events = tool.read_log(custom)
            self.assertEqual(len(events), 1)
        finally:
            del os.environ["VITANUSA_AUDIT_DIR"]


class AuditLogRetentionExportTests(TemporaryAuditTestCase):
    """Property: dokumentasi retention/export (manual verification)."""

    def test_log_file_location_documented(self) -> None:
        """File log berada di lokasi yang didokumentasikan."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-loc", store=self.store)
        log_file = self.store / "audit.log"
        self.assertTrue(log_file.exists())
        self.assertTrue(log_file.is_file())

    def test_export_manual_possible(self) -> None:
        """Log bisa diekspor manual (copy file)."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-exp", store=self.store)
        export = Path(self.workspace.name) / "exported_audit.log"
        shutil.copy2(self.store / "audit.log", export)
        self.assertTrue(export.exists())
        # Verify exported content
        with export.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        self.assertEqual(len(lines), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
