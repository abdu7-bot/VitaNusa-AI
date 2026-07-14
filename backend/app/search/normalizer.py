from __future__ import annotations

import re
from math import isfinite
from collections.abc import Mapping
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .config import normalize_provider_identifier
from .models import SearchResult


TRACKING_QUERY_PARAMETERS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
    }
)


def clean_whitespace(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_title(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean_whitespace(value).casefold()).strip()


def normalize_url(value: object) -> str | None:
    raw_url = clean_whitespace(value)
    if not raw_url or any(character.isspace() for character in raw_url):
        return None
    if any(ord(character) < 32 or ord(character) == 127 for character in raw_url):
        return None

    try:
        parsed = urlsplit(raw_url)
        scheme = parsed.scheme.lower()
        if scheme not in {"http", "https"}:
            return None
        if parsed.username is not None or parsed.password is not None:
            return None

        hostname = parsed.hostname
        if not hostname:
            return None
        hostname = hostname.rstrip(".").lower()
        if not hostname:
            return None

        port = parsed.port
        default_port = (scheme == "http" and port == 80) or (
            scheme == "https" and port == 443
        )
        if ":" in hostname and not hostname.startswith("["):
            hostname_for_url = f"[{hostname}]"
        else:
            hostname_for_url = hostname
        netloc = hostname_for_url
        if port is not None and not default_port:
            netloc = f"{netloc}:{port}"

        path = parsed.path or "/"
        if path != "/":
            path = path.rstrip("/") or "/"

        query_items = [
            (key, item_value)
            for key, item_value in parse_qsl(
                parsed.query,
                keep_blank_values=True,
            )
            if key.casefold() not in TRACKING_QUERY_PARAMETERS
        ]
        query_items.sort(key=lambda item: (item[0].casefold(), item[0], item[1]))
        query = urlencode(query_items, doseq=True)
        return urlunsplit((scheme, netloc, path, query, ""))
    except (TypeError, UnicodeError, ValueError):
        return None


def normalize_search_result(
    result: SearchResult | Mapping[str, Any],
    *,
    provider: str | None = None,
) -> SearchResult | None:
    try:
        data = result.model_dump() if isinstance(result, SearchResult) else dict(result)
    except (TypeError, ValueError):
        return None

    normalized_url = normalize_url(data.get("url"))
    if normalized_url is None:
        return None

    title = clean_whitespace(data.get("title"))
    snippet = clean_whitespace(data.get("snippet"))
    if not title:
        return None

    raw_provider = provider if provider is not None else data.get("provider")
    provider_name = normalize_provider_identifier(raw_provider)
    if provider_name is None:
        provider_name = clean_whitespace(raw_provider).casefold()
    if not provider_name:
        return None

    try:
        parsed = urlsplit(normalized_url)
        domain = (parsed.hostname or "").lower()
        score = float(data.get("score", 0.0) or 0.0)
    except (TypeError, ValueError):
        return None
    if not isfinite(score):
        return None

    published_at_value = data.get("published_at")
    published_at = (
        clean_whitespace(published_at_value)
        if published_at_value is not None
        else None
    )
    if published_at == "":
        published_at = None

    return SearchResult(
        title=title,
        url=normalized_url,
        snippet=snippet,
        domain=domain,
        provider=provider_name,
        published_at=published_at,
        score=score,
        is_mock=bool(data.get("is_mock", False)),
    )
