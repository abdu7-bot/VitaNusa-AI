"""User feedback queue (like/dislike + optional reason).

Feedback is stored append-only with status "pending_review". Nothing here
ever mutates keywords, prompts, the knowledge base, or model behavior
automatically — an admin must review and manually apply any change. This
module intentionally has no "apply"/"retrain" path.
"""

from __future__ import annotations

import json
import os
import uuid
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
    except OSError:
        pass
