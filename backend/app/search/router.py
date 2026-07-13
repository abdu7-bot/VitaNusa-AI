from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
from typing import cast

from .base import SearchProvider
from .config import (
    FALLBACK_PROVIDER_ORDER,
    SUPPORTED_MODES,
    SUPPORTED_STRATEGIES,
    WebSearchConfig,
    normalize_provider_identifier,
)
from .deduplicator import deduplicate_results
from .models import (
    ProviderSearchResponse,
    SearchMode,
    SearchQuery,
    SearchRouterResponse,
    SearchStrategy,
)
from .normalizer import clean_whitespace, normalize_search_result
from .providers import (
    BraveSearchProvider,
    DuckDuckGoSearchProvider,
    SearxngSearchProvider,
)
from .ranking import rank_results


USABLE_STATUSES = frozenset({"success", "mock"})
COMPLETED_STATUSES = frozenset({"success", "mock", "empty", "disabled"})
FAILED_STATUSES = frozenset(
    {
        "blocked",
        "timeout",
        "rate_limited",
        "unavailable",
        "not_implemented",
        "failed",
    }
)


class SearchRouter:
    def __init__(
        self,
        config: WebSearchConfig | None = None,
        providers: Mapping[str, SearchProvider] | None = None,
    ) -> None:
        self.config = config or WebSearchConfig.from_env()
        self.providers: dict[str, SearchProvider] = (
            dict(providers) if providers is not None else self._default_providers()
        )

    def _default_providers(self) -> dict[str, SearchProvider]:
        return {
            "brave": BraveSearchProvider(self.config),
            "duckduckgo": DuckDuckGoSearchProvider(self.config),
            "searxng": SearxngSearchProvider(self.config),
        }

    async def route(
        self,
        query: SearchQuery,
        *,
        provider: str | None = None,
        providers: Sequence[str] | None = None,
        strategy: str | None = None,
    ) -> SearchRouterResponse:
        mode = self._safe_mode()
        selected_strategy = self._safe_strategy(strategy)
        normalized_query = clean_whitespace(query.query)

        if self.config.mode not in SUPPORTED_MODES:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                query=normalized_query,
                error_code="unsupported_web_search_mode",
            )
        if strategy is not None and strategy not in SUPPORTED_STRATEGIES:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                query=normalized_query,
                error_code="unsupported_web_search_strategy",
            )

        explicit_provider, invalid_provider = self._normalize_explicit_provider(provider)
        if invalid_provider:
            return self._unknown_provider_response(
                mode=mode,
                strategy=selected_strategy,
                query=normalized_query,
                provider=invalid_provider,
            )

        provider_order = self._provider_order(
            strategy=selected_strategy,
            provider=explicit_provider,
            providers=providers,
        )
        if not provider_order:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                query=normalized_query,
                error_code="no_web_search_providers",
                all_providers_failed=True,
            )

        if mode == "disabled":
            return SearchRouterResponse(
                mode=mode,
                strategy=selected_strategy,
                query=normalized_query,
                providers_requested=list(provider_order),
                provider_responses=[
                    ProviderSearchResponse(
                        provider=name,
                        status="disabled",
                        error_code="web_search_disabled",
                        error_message="Pencarian web dinonaktifkan.",
                    )
                    for name in provider_order
                ],
            )

        responses: list[ProviderSearchResponse] = []
        for provider_name in provider_order:
            adapter = self.providers.get(provider_name)
            if adapter is None:
                responses.append(
                    ProviderSearchResponse(
                        provider=provider_name,
                        status="failed",
                        error_code="unknown_provider",
                        error_message="Provider pencarian tidak dikenal.",
                    )
                )
            else:
                responses.append(
                    await self._call_provider(
                        provider_name=provider_name,
                        adapter=adapter,
                        query=query,
                    )
                )

            if selected_strategy == "priority":
                break
            if selected_strategy == "fallback":
                current = responses[-1]
                if current.status in USABLE_STATUSES and current.results:
                    break

        requested = [response.provider for response in responses]
        completed = [
            response.provider
            for response in responses
            if response.status in COMPLETED_STATUSES
        ]
        failed = [
            response.provider
            for response in responses
            if response.status in FAILED_STATUSES
        ]
        combined_results = [
            result
            for response in responses
            if response.status in USABLE_STATUSES
            for result in response.results
        ]
        deduplicated = deduplicate_results(combined_results)
        ranked = rank_results(deduplicated, query)
        limit = min(query.max_results, self.config.max_results, 10)

        return SearchRouterResponse(
            mode=mode,
            strategy=selected_strategy,
            query=normalized_query,
            providers_requested=requested,
            providers_completed=list(dict.fromkeys(completed)),
            providers_failed=list(dict.fromkeys(failed)),
            provider_responses=responses,
            results=ranked[:limit],
            is_mock=(mode == "mock"),
            partial_failure=bool(failed) and bool(completed),
            all_providers_failed=bool(requested) and len(set(failed)) == len(set(requested)),
        )

    async def _call_provider(
        self,
        *,
        provider_name: str,
        adapter: SearchProvider,
        query: SearchQuery,
    ) -> ProviderSearchResponse:
        try:
            response = await asyncio.wait_for(
                adapter.search(query),
                timeout=self.config.timeout_seconds,
            )
        except TimeoutError:
            return ProviderSearchResponse(
                provider=provider_name,
                status="timeout",
                error_code="provider_timeout",
                error_message="Batas waktu provider pencarian tercapai.",
            )
        except Exception:
            return ProviderSearchResponse(
                provider=provider_name,
                status="failed",
                error_code="provider_failed",
                error_message="Provider pencarian gagal secara terkontrol.",
            )

        if not isinstance(response, ProviderSearchResponse):
            return ProviderSearchResponse(
                provider=provider_name,
                status="failed",
                error_code="invalid_provider_response",
                error_message="Provider mengembalikan respons yang tidak valid.",
            )
        if response.provider != provider_name:
            return ProviderSearchResponse(
                provider=provider_name,
                status="failed",
                error_code="provider_identity_mismatch",
                error_message="Provider mengembalikan identitas yang tidak sesuai.",
            )

        if response.status not in USABLE_STATUSES:
            if response.results:
                return response.model_copy(update={"results": []})
            return response

        normalized_results = [
            normalized
            for result in response.results
            if (normalized := normalize_search_result(result, provider=provider_name))
            is not None
        ]
        if not normalized_results:
            return response.model_copy(
                update={
                    "status": "empty",
                    "results": [],
                    "error_code": "no_safe_search_results",
                    "error_message": "Provider tidak menghasilkan URL aman yang dapat digunakan.",
                }
            )
        return response.model_copy(update={"results": normalized_results})

    def _provider_order(
        self,
        *,
        strategy: SearchStrategy,
        provider: str | None,
        providers: Sequence[str] | None,
    ) -> tuple[str, ...]:
        if strategy == "priority":
            primary = provider or self.config.provider
            return (primary,) if primary else ()

        if provider is not None and strategy == "aggregate":
            return (provider,)

        configured = self._normalize_provider_sequence(
            providers if providers is not None else self.config.providers
        )

        if strategy == "fallback":
            ordered: list[str] = []
            if provider:
                ordered.append(provider)
            for name in FALLBACK_PROVIDER_ORDER:
                if name in configured and name not in ordered:
                    ordered.append(name)
            for name in configured:
                if name not in ordered:
                    ordered.append(name)
            return tuple(ordered)

        return configured

    @staticmethod
    def _normalize_provider_sequence(providers: Sequence[str]) -> tuple[str, ...]:
        normalized: list[str] = []
        for raw_provider in providers:
            official = normalize_provider_identifier(raw_provider)
            provider = official or clean_whitespace(raw_provider).casefold()
            if provider and provider not in normalized:
                normalized.append(provider)
        return tuple(normalized)

    @staticmethod
    def _normalize_explicit_provider(
        provider: str | None,
    ) -> tuple[str | None, str | None]:
        if provider is None:
            return None, None
        raw_provider = clean_whitespace(provider).casefold()
        official = normalize_provider_identifier(raw_provider)
        if official is None:
            return None, raw_provider or "unknown"
        return official, None

    def _safe_mode(self) -> SearchMode:
        if self.config.mode in SUPPORTED_MODES:
            return cast(SearchMode, self.config.mode)
        return "disabled"

    def _safe_strategy(self, strategy: str | None) -> SearchStrategy:
        candidate = strategy or self.config.strategy
        if candidate in SUPPORTED_STRATEGIES:
            return cast(SearchStrategy, candidate)
        return "priority"

    def _configuration_failure(
        self,
        *,
        mode: SearchMode,
        strategy: SearchStrategy,
        query: str,
        error_code: str,
        all_providers_failed: bool = False,
    ) -> SearchRouterResponse:
        return SearchRouterResponse(
            mode=mode,
            strategy=strategy,
            query=query,
            provider_responses=[
                ProviderSearchResponse(
                    provider="search-router",
                    status="failed",
                    error_code=error_code,
                    error_message="Konfigurasi pencarian web tidak dapat digunakan.",
                )
            ],
            all_providers_failed=all_providers_failed,
        )

    def _unknown_provider_response(
        self,
        *,
        mode: SearchMode,
        strategy: SearchStrategy,
        query: str,
        provider: str,
    ) -> SearchRouterResponse:
        response = ProviderSearchResponse(
            provider=provider,
            status="failed",
            error_code="unknown_provider",
            error_message="Provider pencarian tidak dikenal.",
        )
        return SearchRouterResponse(
            mode=mode,
            strategy=strategy,
            query=query,
            providers_requested=[provider],
            providers_failed=[provider],
            provider_responses=[response],
            is_mock=(mode == "mock"),
            all_providers_failed=True,
        )
