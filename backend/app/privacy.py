"""Lightweight PII redaction used before anything is persisted to disk.

This is a best-effort scrubber, not a guarantee of full anonymization — it
exists to strip the most common personal identifiers (emails, phone numbers,
Indonesian NIK-style long digit runs) out of free-text before it is written
to the feedback queue or the audit log.
"""

from __future__ import annotations

import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?62|0)8\d{7,12}(?!\d)")
_LONG_DIGIT_RUN = re.compile(r"(?<!\d)\d{9,}(?!\d)")


def redact_pii(text: str) -> str:
    text = _EMAIL.sub("[email dihapus]", text)
    text = _PHONE.sub("[nomor telepon dihapus]", text)
    text = _LONG_DIGIT_RUN.sub("[nomor identitas dihapus]", text)
    return text
