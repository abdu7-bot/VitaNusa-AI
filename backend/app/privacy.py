"""Lightweight sensitive-data redaction before user feedback is persisted.

This is a best-effort scrubber, not a guarantee of full anonymization — it
exists to strip the most common personal identifiers (emails, phone numbers,
Indonesian NIK-style long digit runs) out of free-text before it is written
to the feedback queue or the audit log.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?62|0)8\d{7,12}(?!\d)")
_LONG_DIGIT_RUN = re.compile(r"(?<!\d)\d{9,}(?!\d)")
_BEARER_TOKEN = re.compile(r"(?i)\bbearer\s+(?![:=])[^\s,;]+")
_SECRET_ASSIGNMENT_PREFIX = re.compile(
    r"""(?ix)
    (?<![\w])
    (?:\\?["'])?
    (?P<label>authorization|bearer|token|secret|password|api[_\s-]?key|uid)
    (?:\\?["'])?
    \s*(?:\\+\s*)?[:=]\s*
    """
)
_SENSITIVE_KEYS = frozenset({
    "token", "uid", "apikey", "password", "secret", "bearer", "authorization",
})
_MAX_JSON_REDACTION_DEPTH = 6
_MAX_REDACTION_TEXT_LENGTH = 16_384
_UNICODE_ESCAPE = re.compile(r"\\u([0-9a-fA-F]{4})")
_SAFE_UNICODE_ESCAPE_CHARACTERS = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-=:'\"\\ \t"
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


def _redact_secret_assignments(text: str) -> str:
    """Redact labeled values using common plain, quoted, and escaped syntax."""

    output: list[str] = []
    cursor = 0
    while match := _SECRET_ASSIGNMENT_PREFIX.search(text, cursor):
        output.append(text[cursor:match.start()])
        value_start = match.end()
        value_end = value_start

        escaped_quote = text[value_start:value_start + 2]
        if escaped_quote in (r"\"", r"\'"):
            closing = text.find(escaped_quote, value_start + 2)
            value_end = len(text) if closing < 0 else closing + 2
        elif value_start < len(text) and text[value_start] in "\"'":
            quote = text[value_start]
            value_end = value_start + 1
            while value_end < len(text):
                if text[value_end] == quote and text[value_end - 1] != "\\":
                    value_end += 1
                    break
                value_end += 1
        else:
            while (
                value_end < len(text)
                and not text[value_end].isspace()
                and text[value_end] not in ",;}]"
            ):
                value_end += 1

        output.append(f"{match.group('label')}=[rahasia dihapus]")
        cursor = value_end

    output.append(text[cursor:])
    return "".join(output)


def _canonicalize_safe_unicode_escapes(text: str) -> str:
    """Decode only bounded ASCII syntax escapes used by sensitive assignments."""

    canonical = text
    for _ in range(_MAX_JSON_REDACTION_DEPTH):
        changed = False

        def replace(match: re.Match[str]) -> str:
            nonlocal changed
            character = chr(int(match.group(1), 16))
            if character not in _SAFE_UNICODE_ESCAPE_CHARACTERS:
                return match.group(0)
            changed = True
            return character

        canonical = _UNICODE_ESCAPE.sub(replace, canonical)
        if not changed:
            break
    return canonical


def redact_pii(text: str) -> str:
    if len(text) > _MAX_REDACTION_TEXT_LENGTH:
        return "[data terlalu panjang dihapus]"
    text = _canonicalize_safe_unicode_escapes(text)
    text = _BEARER_TOKEN.sub("Bearer [rahasia dihapus]", text)
    text = _redact_secret_assignments(text)
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
            key_text = str(key)
            if len(key_text) > _MAX_REDACTION_TEXT_LENGTH:
                redacted[key] = "[data terlalu panjang dihapus]"
                continue
            canonical_key = _canonicalize_safe_unicode_escapes(key_text)
            normalized_key = re.sub(r"[^a-z0-9]", "", canonical_key.lower())
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
    if len(value) > _MAX_REDACTION_TEXT_LENGTH:
        return "[data terlalu panjang dihapus]"

    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        pass
    else:
        if isinstance(decoded, (dict, list, str)):
            sanitized = redact_sensitive_data(decoded, _depth=_depth + 1)
            return json.dumps(sanitized, ensure_ascii=False, separators=(",", ":"))
    return redact_pii(value)
