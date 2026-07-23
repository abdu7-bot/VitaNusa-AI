"""Lightweight sensitive-data redaction before user feedback is persisted.

This is a best-effort scrubber, not a guarantee of full anonymization — it
exists to strip the most common personal identifiers (emails, phone numbers,
Indonesian NIK-style long digit runs) out of free-text before it is written
to the feedback queue or the audit log.
"""

from __future__ import annotations

import logging
import json
import re
from typing import Any

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?62|0)8\d{7,12}(?!\d)")
_LONG_DIGIT_RUN = re.compile(r"(?<!\d)\d{9,}(?!\d)")
_BEARER_TOKEN = re.compile(r"(?i)\bbearer\s+[^\s,;]+")
_LABELED_SECRET = re.compile(
    r"""(?ix)
    (?P<label>token|secret|password|api[_\s-]?key|uid)
    (?:\\?["'])?\s*[:=]\s*(?:\\?["'])?
    (?P<value>[^\s,;}\]\\"]+)
    """
)
_SENSITIVE_KEYS = frozenset({
    "token", "uid", "apikey", "password", "secret", "bearer", "authorization",
})
_MAX_JSON_REDACTION_DEPTH = 6


class SensitiveAccessLogFilter(logging.Filter):
    """Remove query strings from Uvicorn's structured access-log arguments."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) >= 3:
            arguments = list(record.args)
            request_path = arguments[2]
            if isinstance(request_path, str) and "?" in request_path:
                arguments[2] = f"{request_path.split('?', 1)[0]}?[query dihapus]"
                record.args = tuple(arguments)
        return True


def install_sensitive_access_log_filter() -> None:
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, SensitiveAccessLogFilter) for item in access_logger.filters):
        access_logger.addFilter(SensitiveAccessLogFilter())


def redact_pii(text: str) -> str:
    text = _BEARER_TOKEN.sub("Bearer [rahasia dihapus]", text)
    text = _LABELED_SECRET.sub(
        lambda match: f"{match.group('label')}=[rahasia dihapus]",
        text,
    )
    text = _EMAIL.sub("[email dihapus]", text)
    text = _PHONE.sub("[nomor telepon dihapus]", text)
    text = _LONG_DIGIT_RUN.sub("[nomor identitas dihapus]", text)
    return text


def redact_sensitive_data(value: Any, *, _depth: int = 0) -> Any:
    """Recursively sanitize mappings, arrays, and JSON encoded as strings."""

    if _depth > _MAX_JSON_REDACTION_DEPTH:
        return "[data bersarang dihapus]"
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            normalized_key = re.sub(r"[^a-z0-9]", "", str(key).lower())
            redacted[key] = (
                "[rahasia dihapus]"
                if normalized_key in _SENSITIVE_KEYS
                else redact_sensitive_data(item, _depth=_depth + 1)
            )
        return redacted
    if isinstance(value, list):
        return [redact_sensitive_data(item, _depth=_depth + 1) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_sensitive_data(item, _depth=_depth + 1) for item in value)
    if not isinstance(value, str):
        return value

    stripped = value.strip()
    if stripped.startswith(("{", "[")):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            pass
        else:
            sanitized = redact_sensitive_data(decoded, _depth=_depth + 1)
            return json.dumps(sanitized, ensure_ascii=False, separators=(",", ":"))
    return redact_pii(value)
