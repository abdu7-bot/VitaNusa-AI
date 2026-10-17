#!/usr/bin/env python3
"""
Audit trail untuk autonomous task — append-only event log.

File ini adalah TOOL non-runtime di `scripts/`. Tidak dieksekusi oleh aplikasi.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Sequence

# ─── Konstanta ──────────────────────────────────────────────────────────────
SCHEMA_VERSION = "vitanusa.audit.v1"
DEFAULT_STORE = Path.home() / ".local" / "state" / "vitanusa-agent" / "audit"
EVENT_TYPES = (
    "task_claimed",
    "task_started",
    "validation_result",
    "review_result",
    "blocked",
    "failure",
    "commit_ref",
    "completion",
)
REQUIRED_FIELDS = ("task_id", "actor", "timestamp", "state_transition", "result", "reason", "reference")
SENSITIVE_PATTERNS = (
    r"secret",
    r"token",
    r"password",
    r"passwd",
    r"apikey",
    r"api_key",
    r"private[_-]?key",
    r"private_key",
    r"access[_-]?token",
    r"refresh[_-]?token",
    r"bearer[_-]?token",
    r"auth",
    r"credential",
    r"health[_-]?query",
    r"health[_-]?check",
)

_SECRET_RE = re.compile("|".join(SENSITIVE_PATTERNS), re.IGNORECASE)

# ─── Data Classes ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AuditEvent:
    """Satu event audit yang divalidasi schema."""
    event_type: str
    task_id: str
    actor: str
    timestamp: str  # UTC ISO 8601
    state_transition: str
    result: str
    reason: str
    reference: str
    metadata: dict = field(default_factory=dict)
    checksum: str = ""  # diisi saat append

    def __post_init__(self) -> None:
        if self.event_type not in EVENT_TYPES:
            raise ValueError(f"event_type tidak valid: {self.event_type}")
        if not self.task_id or not self.task_id.strip():
            raise ValueError("task_id tidak boleh kosong")
        if not self.actor or not self.actor.strip():
            raise ValueError("actor tidak boleh kosong")
        # validasi timestamp ISO 8601 UTC
        try:
            dt = datetime.fromisoformat(self.timestamp.replace("Z", "+00:00"))
            if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) != timezone.utc.utcoffset(dt):
                raise ValueError
        except Exception:
            raise ValueError("timestamp harus ISO 8601 UTC (contoh: 2026-10-17T10:00:00Z)")
        if not self.reference or not self.reference.strip():
            raise ValueError("reference tidak boleh kosong")


# ─── Fungsi Utilitas ────────────────────────────────────────────────────────

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _redact_secret(data: Any, key: str | None = None) -> Any:
    """Redaksi nilai sensitif secara rekursif. Cek key dan value."""
    if isinstance(data, dict):
        return {k: _redact_secret(v, k) for k, v in data.items()}
    if isinstance(data, list):
        return [_redact_secret(v) for v in data]
    if isinstance(data, str) and (_SECRET_RE.search(str(key)) or _SECRET_RE.search(data)):
        return "[REDACTED]"
    return data


def _compute_checksum(event_dict: dict) -> str:
    """Checksum per event: SHA256 dari JSON tanpa field checksum."""
    data = {k: v for k, v in event_dict.items() if k != "checksum"}
    return _sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode())


def _kumulatif_hash(prev_hash: str, line_hash: str) -> str:
    """Hash kumulatif: SHA256(prev_hash + line_hash)."""
    return _sha256((prev_hash + line_hash).encode())


def _resolve_store(custom: str | None = None) -> Path:
    """Resolve direktori penyimpanan audit log."""
    env = os.environ.get("VITANUSA_AUDIT_DIR")
    base = Path(custom or env or DEFAULT_STORE)
    base.mkdir(parents=True, exist_ok=True)
    return base


def _log_path(store: Path) -> Path:
    return store / "audit.log"


def _read_last_hash(path: Path) -> str:
    """Baca hash kumulatif terakhir dari file log."""
    if not path.exists():
        return ""
    try:
        with path.open("r", encoding="utf-8") as f:
            lines = f.readlines()
        if not lines:
            return ""
        last = json.loads(lines[-1])
        return last.get("cumulative_hash", "")
    except Exception:
        return ""


# ─── API Publik ──────────────────────────────────────────────────────────────

def append_event(
    event_type: str,
    task_id: str,
    actor: str,
    state_transition: str,
    result: str,
    reason: str,
    reference: str,
    metadata: dict | None = None,
    store: Path | str | None = None,
    timestamp: str | None = None,
) -> AuditEvent:
    """
    Tambahkan event ke audit log (append-only).

    Args:
        event_type: salah satu EVENT_TYPES
        task_id: ID task (contoh: T005)
        actor: identitas agent/user (contoh: "kilo", "copilot", "human")
        state_transition: transisi state (contoh: "READY -> ACTIVE")
        result: hasil (contoh: "success", "failed", "blocked")
        reason: alasan singkat
        reference: referensi unik (commit SHA, PR URL, task ID, dll)
        metadata: dict tambahan (akan diredaksi secret)
        store: direktori custom (default: ~/.local/state/vitanusa-agent/audit)
        timestamp: override timestamp (default: UTC now)

    Returns:
        AuditEvent yang ditambahkan (dengan checksum terisi)

    Raises:
        ValueError: field tidak valid
        OSError: gagal menulis file
    """
    store_path = _resolve_store(str(store) if store else None)
    log_file = _log_path(store_path)

    # Idempotency: cek reference existing
    if find_by_reference(reference, store_path):
        # Return existing event (idempotent)
        return find_by_reference(reference, store_path)  # type: ignore[return-value]

    ts = timestamp or _utc_now()
    meta = _redact_secret(metadata or {})

    event = AuditEvent(
        event_type=event_type,
        task_id=task_id,
        actor=actor,
        timestamp=ts,
        state_transition=state_transition,
        result=result,
        reason=reason,
        reference=reference,
        metadata=meta,
    )

    # build dict untuk checksum
    event_dict = asdict(event)
    event_dict["checksum"] = _compute_checksum(event_dict)

    # hitung cumulative hash
    prev_hash = _read_last_hash(_log_path(store_path))
    event_dict["cumulative_hash"] = _kumulatif_hash(prev_hash, event_dict["checksum"])

    # atomic write: temp file -> rename
    log_file.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(log_file.parent), prefix=".audit-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            # tulis log existing jika ada
            if _log_path(store_path).exists():
                with _log_path(store_path).open("r", encoding="utf-8") as src:
                    f.write(src.read())
            # tulis event baru
            f.write(json.dumps(event_dict, sort_keys=True, separators=(",", ":")) + "\n")
        os.replace(tmp_name, _log_path(store_path))
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise

    return AuditEvent(**{k: v for k, v in event_dict.items() if k != "cumulative_hash"})


def read_log(store: Path | str | None = None, limit: int | None = None) -> list[AuditEvent]:
    """
    Baca audit log (terbaru dulu jika limit diset).
    """
    store_path = _resolve_store(str(store) if store else None)
    log_file = _log_path(store_path)
    if not log_file.exists():
        return []

    events = []
    with log_file.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                # Skip corrupted lines
                continue
            # skip cumulative_hash saat reconstruct
            data.pop("cumulative_hash", None)
            events.append(AuditEvent(**data))

    if limit is not None and limit > 0:
        return events[-limit:]
    return events


def verify_integrity(store: Path | str | None = None) -> tuple[bool, list[str]]:
    """
    Verifikasi integritas audit log.

    Returns:
        (ok, errors) — ok=True jika semua checksum dan cumulative hash valid.
    """
    store_path = _resolve_store(str(store) if store else None)
    log_file = _log_path(store_path)
    if not log_file.exists():
        return True, []

    errors = []
    prev_hash = ""
    with log_file.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"Baris {i}: JSON invalid — {e}")
                continue

            # cek checksum
            line_hash = data.get("checksum", "")
            expected = _compute_checksum({k: v for k, v in data.items() if k not in ("checksum", "cumulative_hash")})
            if line_hash != expected:
                errors.append(f"Baris {i}: checksum mismatch (got {line_hash[:8]}..., expected {expected[:8]}...)")

            # cek cumulative hash
            cum_hash = data.get("cumulative_hash", "")
            expected_cum = _kumulatif_hash(prev_hash, line_hash)
            if cum_hash != expected_cum:
                errors.append(f"Baris {i}: cumulative hash mismatch (got {cum_hash[:8]}..., expected {expected_cum[:8]}...)")
            prev_hash = cum_hash

    return len(errors) == 0, errors


def find_by_reference(reference: str, store: Path | str | None = None) -> Optional[AuditEvent]:
    """Cari event berdasarkan reference (untuk idempotency check)."""
    for ev in read_log(store):
        if ev.reference == reference:
            return ev
    return None


# ─── CLI ────────────────────────────────────────────────────────────────────

def _cli_append(args: Sequence[str]) -> int:
    """CLI: append_event"""
    import argparse
    parser = argparse.ArgumentParser(prog="task_audit_log append")
    parser.add_argument("--event-type", required=True, choices=EVENT_TYPES)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--actor", required=True)
    parser.add_argument("--state-transition", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument("--reason", required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--metadata", default="{}")
    parser.add_argument("--store", default=None)
    parser.add_argument("--timestamp", default=None)
    ns = parser.parse_args(args)

    try:
        meta = json.loads(ns.metadata) if ns.metadata else None
    except json.JSONDecodeError as e:
        print(f"ERROR: metadata JSON invalid: {e}", file=sys.stderr)
        return 1

    try:
        ev = append_event(
            event_type=ns.event_type,
            task_id=ns.task_id,
            actor=ns.actor,
            state_transition=ns.state_transition,
            result=ns.result,
            reason=ns.reason,
            reference=ns.reference,
            metadata=meta,
            store=ns.store,
            timestamp=ns.timestamp,
        )
        print(json.dumps(asdict(ev)))
        return 0
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


def _cli_read(args: Sequence[str]) -> int:
    """CLI: read_log"""
    import argparse
    parser = argparse.ArgumentParser(prog="task_audit_log read")
    parser.add_argument("--store", default=None)
    parser.add_argument("--limit", type=int, default=None)
    ns = parser.parse_args(args)

    events = read_log(ns.store, ns.limit)
    print(json.dumps([asdict(e) for e in events], indent=2))
    return 0


def _cli_verify(args: Sequence[str]) -> int:
    """CLI: verify_integrity"""
    import argparse
    parser = argparse.ArgumentParser(prog="task_audit_log verify")
    parser.add_argument("--store", default=None)
    ns = parser.parse_args(args)

    ok, errors = verify_integrity(ns.store)
    if ok:
        print("OK: audit log integrity verified")
        return 0
    else:
        print("FAIL: integrity errors:")
        for e in errors:
            print(f"  - {e}")
        return 1


def _cli_find(args: Sequence[str]) -> int:
    """CLI: find_by_reference"""
    import argparse
    parser = argparse.ArgumentParser(prog="task_audit_log find")
    parser.add_argument("reference")
    parser.add_argument("--store", default=None)
    ns = parser.parse_args(args)

    ev = find_by_reference(ns.reference, ns.store)
    if ev:
        print(json.dumps(asdict(ev)))
        return 0
    else:
        print("NOT FOUND")
        return 1


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point CLI."""
    if argv is None:
        argv = sys.argv[1:]

    if not argv:
        print("usage: task_audit_log <append|read|verify|find> ...", file=sys.stderr)
        return 1

    cmd = argv[0]
    if cmd == "append":
        return _cli_append(argv[1:])
    if cmd == "read":
        return _cli_read(argv[1:])
    if cmd == "verify":
        return _cli_verify(argv[1:])
    if cmd == "find":
        return _cli_find(argv[1:])

    print(f"unknown command: {cmd}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
