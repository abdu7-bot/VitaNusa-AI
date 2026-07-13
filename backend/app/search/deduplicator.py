from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urlsplit

from .models import SearchResult
from .normalizer import normalize_search_result, normalize_title


MULTI_PROVIDER_SCORE_BOOST = 0.15


@dataclass
class _DeduplicatedEntry:
    result: SearchResult
    providers: set[str] = field(default_factory=set)
    base_score: float = 0.0


def deduplicate_results(results: list[SearchResult]) -> list[SearchResult]:
    entries: list[_DeduplicatedEntry] = []
    exact_url_indexes: dict[str, int] = {}
    content_indexes: dict[tuple[str, str, str, str], int] = {}

    for raw_result in results:
        result = normalize_search_result(raw_result)
        if result is None:
            continue

        content_key = _content_key(result)
        index = exact_url_indexes.get(result.url)
        if index is None:
            index = content_indexes.get(content_key)

        if index is None:
            index = len(entries)
            entries.append(
                _DeduplicatedEntry(
                    result=result,
                    providers={result.provider},
                    base_score=result.score,
                )
            )
        else:
            entry = entries[index]
            entry.providers.add(result.provider)
            entry.base_score = max(entry.base_score, result.score)
            entry.result = _prefer_more_complete(entry.result, result)

        exact_url_indexes[result.url] = index
        content_indexes[content_key] = index

    deduplicated: list[SearchResult] = []
    for entry in entries:
        provider_boost = MULTI_PROVIDER_SCORE_BOOST * max(
            0,
            len(entry.providers) - 1,
        )
        deduplicated.append(
            entry.result.model_copy(
                update={"score": entry.base_score + provider_boost}
            )
        )
    return deduplicated


def _content_key(result: SearchResult) -> tuple[str, str, str, str]:
    parsed = urlsplit(result.url)
    return (
        (parsed.hostname or result.domain).casefold(),
        parsed.path.rstrip("/") or "/",
        parsed.query,
        normalize_title(result.title),
    )


def _prefer_more_complete(
    current: SearchResult,
    candidate: SearchResult,
) -> SearchResult:
    current_quality = (
        len(current.snippet),
        len(current.title),
        current.published_at is not None,
        current.score,
    )
    candidate_quality = (
        len(candidate.snippet),
        len(candidate.title),
        candidate.published_at is not None,
        candidate.score,
    )
    if candidate_quality > current_quality:
        return candidate
    return current
