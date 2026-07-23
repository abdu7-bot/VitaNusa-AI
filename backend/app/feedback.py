"""User feedback queue (like/dislike + optional reason).

Feedback is stored append-only with status "pending_review". Nothing here
ever mutates keywords, prompts, the knowledge base, or model behavior
automatically — an admin must review and manually apply any change. This
module intentionally has no "apply"/"retrain" path.
"""

from __future__ import annotations

import json
import hashlib
import os
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from fcntl import LOCK_EX, LOCK_UN, flock
from pathlib import Path
from threading import Lock
from typing import Iterator, Literal

from pydantic import BaseModel, Field

from .privacy import redact_sensitive_data

_DEFAULT_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "feedback_queue.jsonl"
_STORE_PATH = Path(os.getenv("VITANUSA_FEEDBACK_STORE_PATH", str(_DEFAULT_STORE_PATH)))
_THREAD_LOCK = Lock()

_MAX_TEXT_LENGTH = 500
_DEFAULT_MAX_RECORDS = 1000
_DEFAULT_RATE_LIMIT_REQUESTS = 10
_DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60


class FeedbackRequest(BaseModel):
    question: str = Field(min_length=1, max_length=_MAX_TEXT_LENGTH)
    answer: str = Field(min_length=1, max_length=4000)
    intent: str
    safetyLevel: str
    rating: Literal["like", "dislike"]
    reason: str | None = Field(default=None, max_length=_MAX_TEXT_LENGTH)


class FeedbackReceipt(BaseModel):
    feedbackId: str
    status: Literal["pending_review"] = "pending_review"


def feedback_rate_limit_window_seconds() -> int:
    return _positive_env_int(
        "VITANUSA_FEEDBACK_RATE_LIMIT_WINDOW_SECONDS",
        _DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    )


class FeedbackRateLimiter:
    def allow(self, client_key: str, *, now: float | None = None) -> bool:
        current = time.time() if now is None else now
        limit = _positive_env_int(
            "VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS",
            _DEFAULT_RATE_LIMIT_REQUESTS,
        )
        window = feedback_rate_limit_window_seconds()
        cutoff = current - window
        hashed_key = hashlib.sha256(client_key.encode("utf-8")).hexdigest()
        state_path = _rate_limit_state_path()
        with _THREAD_LOCK, _process_lock(_rate_limit_lock_path()):
            state = _read_rate_limit_state(state_path)
            for key in list(state):
                requests = [timestamp for timestamp in state[key] if timestamp > cutoff]
                if requests:
                    state[key] = requests
                else:
                    del state[key]
            requests = state.setdefault(hashed_key, [])
            if len(requests) >= limit:
                _atomic_write_json(state_path, state)
                return False
            requests.append(current)
            _atomic_write_json(state_path, state)
            return True

    def clear(self) -> None:
        state_path = _rate_limit_state_path()
        with _THREAD_LOCK, _process_lock(_rate_limit_lock_path()):
            try:
                state_path.unlink()
            except FileNotFoundError:
                pass


FEEDBACK_RATE_LIMITER = FeedbackRateLimiter()


def record_feedback(feedback: FeedbackRequest) -> FeedbackReceipt:
    feedback_id = uuid.uuid4().hex
    entry = {
        "feedbackId": feedback_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
        "intent": feedback.intent,
        "safetyLevel": feedback.safetyLevel,
        "rating": feedback.rating,
        "questionRedacted": feedback.question[:_MAX_TEXT_LENGTH],
        "answerRedacted": feedback.answer[:4000],
        "reasonRedacted": feedback.reason[:_MAX_TEXT_LENGTH] if feedback.reason else None,
    }
    _append(redact_sensitive_data(entry))
    return FeedbackReceipt(feedbackId=feedback_id)


def list_pending_feedback(limit: int = 100) -> list[dict]:
    if not _STORE_PATH.exists():
        return []
    with _THREAD_LOCK, _process_lock(_queue_lock_path()):
        entries = _read_queue_entries()
    return [redact_sensitive_data(entry) for entry in entries[-limit:]]


def _append(entry: dict) -> None:
    try:
        with _THREAD_LOCK, _process_lock(_queue_lock_path()):
            _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _STORE_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
            _enforce_retention()
    except OSError:
        pass


def _enforce_retention() -> None:
    max_records = _positive_env_int(
        "VITANUSA_FEEDBACK_MAX_RECORDS",
        _DEFAULT_MAX_RECORDS,
    )
    lines = _STORE_PATH.read_text(encoding="utf-8").splitlines()
    if len(lines) <= max_records:
        return
    retained = lines[-max_records:]
    _atomic_write_text(_STORE_PATH, "\n".join(retained) + "\n")


def _read_queue_entries() -> list[dict]:
    if not _STORE_PATH.exists():
        return []
    entries = []
    with _STORE_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                entries.append(value)
    return entries


def _read_rate_limit_state(path: Path) -> dict[str, list[float]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}
    if not isinstance(value, dict):
        return {}
    state = {}
    for key, timestamps in value.items():
        if isinstance(key, str) and isinstance(timestamps, list):
            valid = [
                float(timestamp)
                for timestamp in timestamps
                if isinstance(timestamp, (int, float))
            ]
            state[key] = valid
    return state


def _rate_limit_state_path() -> Path:
    configured = os.getenv("VITANUSA_FEEDBACK_RATE_LIMIT_STORE_PATH", "").strip()
    return Path(configured) if configured else _STORE_PATH.with_suffix(".rate.json")


def _queue_lock_path() -> Path:
    return _STORE_PATH.with_suffix(f"{_STORE_PATH.suffix}.lock")


def _rate_limit_lock_path() -> Path:
    state_path = _rate_limit_state_path()
    return state_path.with_suffix(f"{state_path.suffix}.lock")


@contextmanager
def _process_lock(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        flock(descriptor, LOCK_EX)
        yield
    finally:
        flock(descriptor, LOCK_UN)
        os.close(descriptor)


def _atomic_write_json(path: Path, value: dict) -> None:
    _atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=True, separators=(",", ":")) + "\n",
    )


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        directory_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    finally:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass


def _positive_env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default
