from __future__ import annotations

import re
from datetime import datetime

from .models import SearchQuery, SearchResult


HEALTH_SOURCE_WEIGHTS = {
    "government": 3.0,
    "health_authority": 2.8,
    "academic": 2.5,
    "journal": 2.4,
    "official_product": 1.8,
    "general_media": 1.2,
    "community": 0.5,
    "unknown": 0.2,
}


def rank_results(
    results: list[SearchResult],
    query: SearchQuery,
) -> list[SearchResult]:
    ranked = [
        result.model_copy(update={"score": _score_result(result, query)})
        for result in results
    ]
    return sorted(
        ranked,
        key=lambda item: (
            -item.score,
            item.title.casefold(),
            item.url,
            item.provider,
        ),
    )


def classify_source_type(domain: str) -> str:
    normalized = domain.casefold()
    if "government" in normalized or "kemkes" in normalized:
        return "government"
    if "health-authority" in normalized or "healthauthority" in normalized:
        return "health_authority"
    if "journal" in normalized:
        return "journal"
    if "research" in normalized or "academic" in normalized or "education" in normalized:
        return "academic"
    if "official-product" in normalized or normalized == "vitanusa.example":
        return "official_product"
    if "media" in normalized or "news" in normalized:
        return "general_media"
    if "community" in normalized or "forum" in normalized:
        return "community"
    return "unknown"


def _score_result(result: SearchResult, query: SearchQuery) -> float:
    query_terms = _terms(query.query)
    title_terms = _terms(result.title)
    snippet_terms = _terms(result.snippet)

    title_matches = len(query_terms.intersection(title_terms))
    snippet_matches = len(query_terms.intersection(snippet_terms))
    score = result.score
    score += title_matches * 1.5
    score += snippet_matches * 0.45
    score += min(len(result.title) / 100.0, 0.8)
    score += min(len(result.snippet) / 300.0, 1.0)

    source_type = classify_source_type(result.domain)
    if query.category in {"health", "product_claim"}:
        score += HEALTH_SOURCE_WEIGHTS[source_type]
    elif source_type in {"government", "health_authority", "academic", "journal"}:
        score += 0.4

    score += _published_at_bonus(result.published_at)
    return round(score, 6)


def _terms(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.casefold()))


def _published_at_bonus(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        published = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return 0.0
    years_since_2000 = min(max(published.year - 2000, 0), 100)
    return round((years_since_2000 * 0.005) + (published.timetuple().tm_yday * 0.00001), 6)
