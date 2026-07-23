"""Lightweight sensitive-data redaction before user feedback is persisted.

This is a best-effort scrubber, not a guarantee of full anonymization — it
exists to strip the most common personal identifiers (emails, phone numbers,
Indonesian NIK-style long digit runs) out of free-text before it is written
to the feedback queue or the audit log.
"""

from __future__ import annotations

import logging
import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?62|0)8\d{7,12}(?!\d)")
_LONG_DIGIT_RUN = re.compile(r"(?<!\d)\d{9,}(?!\d)")
_BEARER_TOKEN = re.compile(r"(?i)\bbearer\s+[^\s,;]+")
_LABELED_SECRET = re.compile(
    r"(?i)\b(token|secret|password|api[_ -]?key|uid)\s*[:=]\s*[^\s,;]+"
)


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
    text = _LABELED_SECRET.sub(r"\1=[rahasia dihapus]", text)
    text = _EMAIL.sub("[email dihapus]", text)
    text = _PHONE.sub("[nomor telepon dihapus]", text)
    text = _LONG_DIGIT_RUN.sub("[nomor identitas dihapus]", text)
    return text
