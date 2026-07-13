"""Append-only audit log for /ask calls.

Stores only what is needed to audit *how the app decided to answer*
(intent, safety level, which provider generated the text, whether the
policy engine blocked anything) — not full personal health narratives.
The question text itself is redacted for common PII and truncated.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from .privacy import redact_pii

_DEFAULT_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "audit_log.jsonl"
_LOG_PATH = Path(os.getenv("VITANUSA_AUDIT_LOG_PATH", str(_DEFAULT_LOG_PATH)))
_LOCK = Lock()

_MAX_QUESTION_PREVIEW = 160


def log_ask_event(
    *,
    intent: str,
    safety_level: str,
    response_blocked: bool,
    dominant_policy: str | None,
    llm_used: bool,
    llm_provider: str | None,
    llm_mode: str,
    question: str,
) -> None:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "intent": intent,
        "safetyLevel": safety_level,
        "responseBlocked": response_blocked,
        "dominantPolicy": dominant_policy,
        "llmUsed": llm_used,
        "llmProvider": llm_provider,
        "llmMode": llm_mode,
        "questionPreview": redact_pii(question)[:_MAX_QUESTION_PREVIEW],
    }
    _append(entry)


def _append(entry: dict) -> None:
    try:
        with _LOCK:
            _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _LOG_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        # Audit logging must never break the /ask response.
        pass
