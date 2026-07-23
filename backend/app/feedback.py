"""User feedback queue (like/dislike + optional reason).

Feedback is stored append-only with status "pending_review". Nothing here
ever mutates keywords, prompts, the knowledge base, or model behavior
automatically — an admin must review and manually apply any change. This
module intentionally has no "apply"/"retrain" path.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Literal

from pydantic import BaseModel, Field

from .privacy import redact_pii

_DEFAULT_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "feedback_queue.jsonl"
_STORE_PATH = Path(os.getenv("VITANUSA_FEEDBACK_STORE_PATH", str(_DEFAULT_STORE_PATH)))
_LOCK = Lock()

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
    def __init__(self) -> None:
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, client_key: str, *, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        limit = _positive_env_int(
            "VITANUSA_FEEDBACK_RATE_LIMIT_REQUESTS",
            _DEFAULT_RATE_LIMIT_REQUESTS,
        )
        window = feedback_rate_limit_window_seconds()
        cutoff = current - window
        with self._lock:
            for key in list(self._requests):
                requests = self._requests[key]
                while requests and requests[0] <= cutoff:
                    requests.popleft()
                if not requests:
                    del self._requests[key]
            requests = self._requests[client_key]
            if len(requests) >= limit:
                return False
            requests.append(current)
            return True

    def clear(self) -> None:
        with self._lock:
            self._requests.clear()


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
        "questionRedacted": redact_pii(feedback.question)[:_MAX_TEXT_LENGTH],
        "answerRedacted": redact_pii(feedback.answer)[:4000],
        "reasonRedacted": redact_pii(feedback.reason)[:_MAX_TEXT_LENGTH] if feedback.reason else None,
    }
    _append(entry)
    return FeedbackReceipt(feedbackId=feedback_id)


def list_pending_feedback(limit: int = 100) -> list[dict]:
    if not _STORE_PATH.exists():
        return []
    entries: list[dict] = []
    with _LOCK, _STORE_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries[-limit:]


def _append(entry: dict) -> None:
    try:
        with _LOCK:
            _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _STORE_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
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
    temporary_path = _STORE_PATH.with_suffix(f"{_STORE_PATH.suffix}.tmp")
    temporary_path.write_text("\n".join(retained) + "\n", encoding="utf-8")
    temporary_path.replace(_STORE_PATH)


def _positive_env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default
