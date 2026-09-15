from __future__ import annotations

import json
from urllib.parse import urlsplit

import httpx

from .http_client import ResponseTooLarge, UnsafeRedirect, safe_provider_request
from .models import ProviderSearchResponse, SearchQuery, SearchResult


def result_from_payload(
    *,
    provider: str,
    title: object,
    url: object,
    snippet: object,
    published_at: object = None,
    score: object = 0.0,
) -> SearchResult | None:
    title_text = str(title or "").strip()[:500]
    url_text = str(url or "").strip()
    snippet_text = str(snippet or "").strip()[:2_000]
    parsed = urlsplit(url_text)
    if not title_text or not snippet_text or parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    if parsed.username or parsed.password or parsed.fragment:
        return None
    try:
        numeric_score = float(score or 0.0)
    except (TypeError, ValueError):
        numeric_score = 0.0
    return SearchResult(
        title=title_text,
        url=url_text,
        snippet=snippet_text,
        domain=parsed.hostname.lower(),
        provider=provider,
        published_at=str(published_at).strip() if published_at else None,
        score=numeric_score,
        is_mock=False,
    )


def parse_json(raw: bytes) -> dict | None:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


async def fetch_json(
    *,
    provider: str,
    url: str,
    query: SearchQuery,
    timeout_seconds: float,
    max_response_bytes: int,
    params: dict[str, str | int | bool | None],
    headers: dict[str, str] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> ProviderSearchResponse:
    try:
        status_code, _, raw = await safe_provider_request(
            url=url,
            timeout_seconds=timeout_seconds,
            params=params,
            headers=headers,
            max_bytes=max_response_bytes,
            transport=transport,
        )
    except UnsafeRedirect:
        return ProviderSearchResponse(
            provider=provider,
            status="failed",
            error_code="unsafe_provider_redirect",
            error_message="Provider mengembalikan redirect yang ditolak.",
        )
    except ResponseTooLarge:
        return ProviderSearchResponse(
            provider=provider,
            status="failed",
            error_code="provider_response_too_large",
            error_message="Respons provider melebihi batas ukuran.",
        )
    except httpx.TimeoutException:
        return ProviderSearchResponse(
            provider=provider,
            status="timeout",
            error_code="provider_timeout",
            error_message="Provider pencarian melewati batas waktu.",
        )
    except (httpx.HTTPError, ValueError, OSError):
        return ProviderSearchResponse(
            provider=provider,
            status="unavailable",
            error_code="provider_request_failed",
            error_message="Provider pencarian tidak dapat diakses.",
        )

    if status_code == 429:
        return ProviderSearchResponse(
            provider=provider,
            status="rate_limited",
            error_code="provider_rate_limited",
            error_message="Provider membatasi permintaan.",
        )
    if status_code >= 500:
        return ProviderSearchResponse(
            provider=provider,
            status="unavailable",
            error_code="provider_server_error",
            error_message="Provider pencarian sedang bermasalah.",
        )
    if status_code >= 400:
        return ProviderSearchResponse(
            provider=provider,
            status="failed",
            error_code="provider_http_error",
            error_message="Provider menolak permintaan pencarian.",
        )

    payload = parse_json(raw)
    if payload is None:
        return ProviderSearchResponse(
            provider=provider,
            status="failed",
            error_code="provider_invalid_json",
            error_message="Respons provider bukan JSON yang valid.",
        )

    return ProviderSearchResponse(provider=provider, status="success", results=[])
