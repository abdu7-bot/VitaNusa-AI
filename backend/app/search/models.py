from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SearchMode = Literal["disabled", "mock", "live"]
SearchStrategy = Literal["priority", "fallback", "aggregate"]
SearchCategory = Literal[
    "general",
    "health",
    "news",
    "education",
    "product_claim",
    "technology",
]
SearchStatus = Literal[
    "success",
    "mock",
    "empty",
    "disabled",
    "blocked",
    "timeout",
    "rate_limited",
    "unavailable",
    "not_implemented",
    "failed",
]


class SearchQuery(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    language: str = Field(default="id", min_length=2, max_length=10)
    country: str = Field(default="ID", min_length=2, max_length=10)
    category: SearchCategory = "general"
    max_results: int = Field(default=5, ge=1, le=10)
    freshness: str | None = Field(default=None, max_length=50)
    safe_search: bool = True


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    domain: str
    provider: str
    published_at: str | None = None
    score: float = 0.0
    is_mock: bool = False


class ProviderSearchResponse(BaseModel):
    provider: str
    status: SearchStatus
    results: list[SearchResult] = Field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None
    elapsed_ms: int = Field(default=0, ge=0)
    is_mock: bool = False


class SearchRouterResponse(BaseModel):
    mode: SearchMode
    strategy: SearchStrategy
    query: str
    providers_requested: list[str] = Field(default_factory=list)
    providers_completed: list[str] = Field(default_factory=list)
    providers_failed: list[str] = Field(default_factory=list)
    provider_responses: list[ProviderSearchResponse] = Field(default_factory=list)
    results: list[SearchResult] = Field(default_factory=list)
    is_mock: bool = False
    partial_failure: bool = False
    all_providers_failed: bool = False
