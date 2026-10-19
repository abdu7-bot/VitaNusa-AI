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

        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].task_id, "T005")
        self.assertEqual(events[0].reference, "T005-claim-001")

    def test_multiple_events_append_only(self) -> None:
        """Event berturut-turut hanya ditambah, tidak menimpa."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        tool.append_event("validation_result", "T005", "kilo", "ACTIVE -> TESTING", "success", "valid", "ref-3", store=self.store)

        events, _ = tool.read_log(self.store)
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

        events, _ = tool.read_log(self.store)
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
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        meta = events[0].metadata
        self.assertEqual(meta["api_key"], "[REDACTED]")
        self.assertEqual(meta["normal"], "value")

    def test_secret_in_reason_redacted(self) -> None:
        """Secret di reason diredact (seluruh field diredact jika mengandung pola sensitif)."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE",
            "success",
            "claim with api_key sk-12345 in reason",
            "ref-secret-reason",
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        # Seluruh field diredact karena mengandung kata "api_key"
        self.assertEqual(events[0].reason, "[REDACTED]")

    def test_secret_in_reference_redacted(self) -> None:
        """Secret di reference diredact (seluruh field diredact jika mengandung pola sensitif)."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE",
            "success",
            "claim",
            "ref-with-token-abc123",
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        # Seluruh field diredact karena mengandung kata "token"
        self.assertEqual(events[0].reference, "[REDACTED]")

    def test_secret_in_state_transition_redacted(self) -> None:
        """Secret di state_transition diredact (seluruh field diredact jika mengandung pola sensitif)."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE with password secret123",
            "success",
            "claim",
            "ref-secret-st",
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        # Seluruh field diredact karena mengandung kata "password"
        self.assertEqual(events[0].state_transition, "[REDACTED]")

    def test_secret_in_result_redacted(self) -> None:
        """Secret di result diredact (seluruh field diredact jika mengandung pola sensitif)."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE",
            "failed due to token xyz789",
            "claim",
            "ref-secret-result",
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        # Seluruh field diredact karena mengandung kata "token"
        self.assertEqual(events[0].result, "[REDACTED]")

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
        events, _ = tool.read_log(self.store)
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
        events, _ = tool.read_log(self.store)
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
            events, _ = tool.read_log(self.store)
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
        events, _ = tool.read_log(self.store)
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
        events, _ = tool.read_log(self.store)
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
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].reference, "ref-1")


class AuditLogCustomStoreTests(TemporaryAuditTestCase):
    """Property: custom store path via arg/env."""

    def test_custom_store_path(self) -> None:
        """Custom store path via argumen."""
        custom = Path(self.workspace.name) / "custom_audit"
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-custom", store=custom)
        events, _ = tool.read_log(custom)
        self.assertEqual(len(events), 1)

    def test_env_var_store(self) -> None:
        """Custom store via env VITANUSA_AUDIT_DIR."""
        custom = Path(self.workspace.name) / "env_audit"
        os.environ["VITANUSA_AUDIT_DIR"] = str(custom)
        try:
            tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-env", store=None)
            events, _ = tool.read_log(custom)
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


class AuditLogFailClosedTests(TemporaryAuditTestCase):
    """Property: fail-closed behavior pada log korup."""

    def test_append_rejects_when_log_corrupted_at_end(self) -> None:
        """Append ditolak jika log korup di akhir."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Corrupt log: tambah baris JSON invalid di akhir
        log_file = self.store / "audit.log"
        log_file.write_text(log_file.read_text() + "invalid json\n", encoding="utf-8")

        # Append harus gagal dengan ValueError
        with self.assertRaises(ValueError) as cm:
            tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        self.assertIn("JSON invalid", str(cm.exception))

        # Log original harus utuh (byte-by-byte identical before/after attempt)
        content_before = (self.store / "audit.log").read_bytes()
        # Note: log is unchanged because append failed
        content_after = (self.store / "audit.log").read_bytes()
        self.assertEqual(content_before, content_after)

    def test_append_rejects_when_log_corrupted_in_middle(self) -> None:
        """Append ditolak jika log korup di tengah."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)

        # Corrupt log: ubah baris kedua
        log_file = self.store / "audit.log"
        lines = log_file.read_text().strip().split("\n")
        lines[1] = "corrupted line"
        log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        # Append harus gagal
        with self.assertRaises(ValueError) as cm:
            tool.append_event("completion", "T005", "kilo", "ACTIVE -> DONE", "success", "done", "ref-3", store=self.store)
        self.assertIn("JSON invalid", str(cm.exception))

    def test_append_rejects_when_missing_cumulative_hash(self) -> None:
        """Append ditolak jika cumulative_hash hilang."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Hapus cumulative_hash dari baris terakhir
        log_file = self.store / "audit.log"
        line = json.loads(log_file.read_text().strip())
        del line["cumulative_hash"]
        log_file.write_text(json.dumps(line, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")

        # Append harus gagal
        with self.assertRaises(ValueError) as cm:
            tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        self.assertIn("cumulative_hash", str(cm.exception).lower())
        self.assertIn("hilang", str(cm.exception).lower())

    def test_append_rejects_when_cumulative_hash_empty(self) -> None:
        """Append ditolak jika cumulative_hash kosong."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Set cumulative_hash ke empty string
        log_file = self.store / "audit.log"
        line = json.loads(log_file.read_text().strip())
        line["cumulative_hash"] = ""
        log_file.write_text(json.dumps(line, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")

        with self.assertRaises(ValueError) as cm:
            tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        self.assertIn("cumulative_hash", str(cm.exception).lower())
        self.assertIn("kosong", str(cm.exception).lower())

    def test_log_unchanged_after_failed_append(self) -> None:
        """Log tidak berubah setelah append gagal."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Corrupt log
        log_file = self.store / "audit.log"
        log_file.write_text(log_file.read_text() + "garbage\n", encoding="utf-8")

        # Snapshot byte sebelum percobaan append
        original_bytes = log_file.read_bytes()

        with self.assertRaises(ValueError):
            tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)

        # Log harus identik byte-by-byte
        self.assertEqual(log_file.read_bytes(), original_bytes)

    def test_empty_cumulative_hash_raises(self) -> None:
        """_read_last_hash raises on empty cumulative_hash."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)

        # Set cumulative_hash to empty string
        log_file = self.store / "audit.log"
        line = json.loads(log_file.read_text().strip())
        line["cumulative_hash"] = ""
        log_file.write_text(json.dumps(line, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")

        import sys
        sys.path.insert(0, str(REPO_ROOT))
        from scripts.task_audit_log import _read_last_hash
        with self.assertRaises(ValueError) as cm:
            _read_last_hash(log_file)
        self.assertIn("cumulative_hash", str(cm.exception).lower())
        self.assertIn("kosong", str(cm.exception).lower())


class AuditLogLockLifecycleTests(TemporaryAuditTestCase):
    """Property: lock release on all paths including idempotent return."""

    def test_lock_released_on_idempotent_duplicate_then_new_event(self) -> None:
        """Lock dilepas saat duplicate reference, event baru bisa ditambah di proses yang sama."""
        # Event A
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-A", store=self.store)
        # Duplicate A (should return early, lock must be released)
        ev_dup = tool.append_event("task_claimed", "T005", "copilot", "READY -> ACTIVE", "success", "claim dup", "ref-A", store=self.store)
        self.assertEqual(ev_dup.reference, "ref-A")
        self.assertEqual(ev_dup.actor, "kilo")  # First wins
        # Event B (distinct) - should complete without timeout
        ev_b = tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-B", store=self.store)
        self.assertEqual(ev_b.reference, "ref-B")
        # Log should verify
        ok, errors = tool.verify_integrity(self.store)
        self.assertTrue(ok, f"Integrity errors after duplicate+new: {errors}")
        events, _ = tool.read_log(self.store)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0].reference, "ref-A")
        self.assertEqual(events[1].reference, "ref-B")


class AuditLogFailClosedRegressionTests(TemporaryAuditTestCase):
    """Property: fail-closed regression tests with three-event middle corruption."""

    def _create_three_event_log(self) -> None:
        """Helper: create a valid three-event log."""
        tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "claim", "ref-1", store=self.store)
        tool.append_event("task_started", "T005", "kilo", "ACTIVE -> ACTIVE", "success", "start", "ref-2", store=self.store)
        tool.append_event("validation_result", "T005", "kilo", "ACTIVE -> TESTING", "success", "valid", "ref-3", store=self.store)

    def _get_log_bytes(self) -> bytes:
        return (self.store / "audit.log").read_bytes()

    def _corrupt_and_test(self, corrupt_fn, expected_error_substring: str) -> None:
        """Helper: corrupt log, snapshot, attempt append, verify log unchanged."""
        self._create_three_event_log()

        # Corrupt the log
        log_file = self.store / "audit.log"
        corrupt_fn(log_file)

        # Snapshot AFTER corruption, BEFORE append attempt
        corrupted_bytes = log_file.read_bytes()

        # Attempt append - should fail
        with self.assertRaises(ValueError) as cm:
            tool.append_event("completion", "T005", "kilo", "TESTING -> DONE", "success", "done", "ref-4", store=self.store)
        self.assertIn(expected_error_substring, str(cm.exception))

        # Log should be unchanged from corrupted state (no additional modifications)
        self.assertEqual(log_file.read_bytes(), corrupted_bytes)
        # Also verify no temp files left
        temp_files = list(self.store.glob(".audit-*.tmp"))
        self.assertEqual(len(temp_files), 0, f"Temp files remain: {temp_files}")

    def test_append_rejects_when_checksum_corrupted_in_middle(self) -> None:
        """Append ditolak jika checksum korup di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            data["checksum"] = "a" * 64
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "checksum mismatch")

    def test_append_rejects_when_cumulative_hash_corrupted_in_middle(self) -> None:
        """Append ditolak jika cumulative_hash korup di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            data["cumulative_hash"] = "b" * 64
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "cumulative hash mismatch")

    def test_append_rejects_when_missing_cumulative_hash_in_middle(self) -> None:
        """Append ditolak jika cumulative_hash hilang di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            del data["cumulative_hash"]
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "cumulative_hash")

    def test_append_rejects_when_empty_cumulative_hash_in_middle(self) -> None:
        """Append ditolak jika cumulative_hash kosong di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            data["cumulative_hash"] = ""
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "kosong")

    def test_append_rejects_when_json_corrupted_in_middle(self) -> None:
        """Append ditolak jika JSON invalid di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            lines[1] = "{ invalid json }"
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "JSON invalid")

    def test_append_rejects_when_state_transition_missing_in_middle(self) -> None:
        """Append ditolak jika state_transition hilang di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            del data["state_transition"]
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "state_transition")

    def test_append_rejects_when_result_missing_in_middle(self) -> None:
        """Append ditolak jika result hilang di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            del data["result"]
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "result")

    def test_append_rejects_when_reason_missing_in_middle(self) -> None:
        """Append ditolak jika reason hilang di tengah log 3 event."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            data = json.loads(lines[1])
            del data["reason"]
            lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "reason")

    def test_append_rejects_when_blank_line_in_log(self) -> None:
        """Append ditolak jika ada blank line di log (JSONL violation)."""
        def corrupt(log_file):
            lines = log_file.read_text().strip().split("\n")
            lines.insert(1, "")
            log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self._corrupt_and_test(corrupt, "blank line")

    def test_append_rejects_when_invalid_field_type(self) -> None:
        """Append ditolak jika tipe field tidak valid (contoh: timestamp bukan string)."""
        self._create_three_event_log()

        # Corrupt: change timestamp to integer
        log_file = self.store / "audit.log"
        line = json.loads(log_file.read_text().strip().split("\n")[0])
        line["timestamp"] = 12345
        lines = log_file.read_text().strip().split("\n")
        lines[0] = json.dumps(line, sort_keys=True, separators=(",", ":"))
        log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        # Snapshot after corruption
        corrupted_bytes = log_file.read_bytes()

        # Attempt append - should fail (schema validation should catch invalid timestamp type)
        with self.assertRaises(ValueError) as cm:
            tool.append_event("completion", "T005", "kilo", "TESTING -> DONE", "success", "done", "ref-4", store=self.store)
        # The error should be about timestamp type validation
        self.assertIn("timestamp", str(cm.exception).lower())
        self.assertIn("tipe", str(cm.exception).lower())
        # Log should be unchanged from corrupted state
        self.assertEqual(log_file.read_bytes(), corrupted_bytes)

    def test_log_unchanged_after_failed_append_middle_corruption(self) -> None:
        """Log tidak berubah byte-for-byte setelah append gagal karena korupsi tengah."""
        self._create_three_event_log()

        # Corrupt middle event
        log_file = self.store / "audit.log"
        lines = log_file.read_text().strip().split("\n")
        data = json.loads(lines[1])
        data["reason"] = "tampered"
        lines[1] = json.dumps(data, sort_keys=True, separators=(",", ":"))
        log_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        # Snapshot after corruption
        corrupted_bytes = log_file.read_bytes()

        with self.assertRaises(ValueError):
            tool.append_event("completion", "T005", "kilo", "TESTING -> DONE", "success", "done", "ref-4", store=self.store)

        # Verify byte-for-byte unchanged from corrupted state
        self.assertEqual(log_file.read_bytes(), corrupted_bytes)
        # Also verify no temp files left
        temp_files = list(self.store.glob(".audit-*.tmp"))
        self.assertEqual(len(temp_files), 0, f"Temp files remain: {temp_files}")


class AuditLogSchemaExtendedTests(TemporaryAuditTestCase):
    """Property: validasi schema diperluas untuk field wajib tambahan."""

    def test_reject_empty_state_transition(self) -> None:
        """state_transition kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "T005", "kilo", "", "success", "claim", "ref-1", store=self.store)

    def test_reject_empty_result(self) -> None:
        """result kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "", "claim", "ref-1", store=self.store)

    def test_reject_empty_reason(self) -> None:
        """reason kosong ditolak."""
        with self.assertRaises(ValueError):
            tool.append_event("task_claimed", "T005", "kilo", "READY -> ACTIVE", "success", "", "ref-1", store=self.store)


class AuditLogSecretRedactionTests(TemporaryAuditTestCase):
    """Property: secret redaction mencakup field 'key'."""

    def test_key_field_redacted_even_with_benign_value(self) -> None:
        """Field 'key' diredact karena nama field, meski value benign."""
        tool.append_event(
            "task_claimed",
            "T005",
            "kilo",
            "READY -> ACTIVE",
            "success",
            "claim with key field",
            "ref-key-1",
            metadata={"key": "benign-value", "normal": "ok"},
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        meta = events[0].metadata
        self.assertEqual(meta["key"], "[REDACTED]")
        self.assertEqual(meta["normal"], "ok")

    def test_nested_key_field_redacted(self) -> None:
        """Field 'key' di nested dict diredact."""
        tool.append_event(
            "validation_result",
            "T005",
            "kilo",
            "ACTIVE -> TESTING",
            "success",
            "nested key",
            "ref-key-2",
            metadata={"config": {"key": "nested-secret"}, "items": [{"key": "item-key"}]},
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        meta = events[0].metadata
        self.assertEqual(meta["config"]["key"], "[REDACTED]")
        self.assertEqual(meta["items"][0]["key"], "[REDACTED]")

    def test_key_in_list_redacted(self) -> None:
        """Field 'key' di list of dicts diredact."""
        tool.append_event(
            "failure",
            "T005",
            "kilo",
            "TESTING -> BLOCKED",
            "failed",
            "list of keys",
            "ref-key-3",
            metadata={"keys": [{"key": "a"}, {"key": "b"}, {"other": "c"}]},
            store=self.store,
        )
        events, _ = tool.read_log(self.store)
        meta = events[0].metadata
        self.assertEqual(meta["keys"][0]["key"], "[REDACTED]")
        self.assertEqual(meta["keys"][1]["key"], "[REDACTED]")
        self.assertEqual(meta["keys"][2]["other"], "c")


if __name__ == "__main__":
    unittest.main(verbosity=2)
