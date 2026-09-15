from __future__ import annotations

import os
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.main import ask_ai, search_preview
from app.schemas import AskRequest, SearchPreviewRequest
from app.search.config import WebSearchConfig
from app.search.models import ProviderSearchResponse, SearchQuery, SearchResult
from app.search.router import SearchRouter


def make_query(*, max_results: int = 5, category: str = "general") -> SearchQuery:
    return SearchQuery(
        query="cara menilai klaim produk kesehatan",
        category=category,
        max_results=max_results,
    )


def search_result(
    provider: str,
    index: int = 1,
    *,
    url: str | None = None,
    snippet: str = "Hasil simulasi dan bukan sumber kesehatan nyata.",
) -> SearchResult:
    return SearchResult(
        title=f"Panduan klaim simulasi {index}",
        url=url or f"https://{provider}.example/article-{index}",
        snippet=snippet,
        domain=f"{provider}.example",
        provider=provider,
        is_mock=True,
    )


def provider_response(
    provider: str,
    status: str = "mock",
    *,
    count: int = 1,
    results: list[SearchResult] | None = None,
) -> ProviderSearchResponse:
    if results is None:
        results = (
            [search_result(provider, index) for index in range(1, count + 1)]
            if status in {"success", "mock"}
            else []
        )
    return ProviderSearchResponse(
        provider=provider,
        status=status,
        results=results,
        is_mock=(status == "mock"),
        error_code=None if status in {"success", "mock", "empty"} else "simulated",
    )


class StubProvider:
    def __init__(
        self,
        name: str,
        response: ProviderSearchResponse | None = None,
        error: Exception | None = None,
    ) -> None:
        self.name = name
        self.response = response
        self.error = error
        self.calls = 0

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        self.calls += 1
        if self.error is not None:
            raise self.error
        if self.response is None:
            raise AssertionError("stub response is required")
        return self.response


def stubs(
    brave: ProviderSearchResponse,
    searxng: ProviderSearchResponse,
    duckduckgo: ProviderSearchResponse,
) -> dict[str, StubProvider]:
    return {
        "brave": StubProvider("brave", brave),
        "searxng": StubProvider("searxng", searxng),
        "duckduckgo": StubProvider("duckduckgo", duckduckgo),
    }


class WebSearchConfigTests(unittest.TestCase):
    def test_environment_values_are_validated_and_normalized(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "APP_ENV": "development",
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_STRATEGY": "fallback",
                "WEB_SEARCH_PROVIDERS": "brave-search,ddg,searx",
                "WEB_SEARCH_PROVIDER": "BRAVESEARCH",
                "WEB_SEARCH_MAX_RESULTS": "10",
                "WEB_SEARCH_TIMEOUT_SECONDS": "30",
                "WEB_SEARCH_LANGUAGE": "id",
                "WEB_SEARCH_COUNTRY": "id",
                "WEB_SEARCH_SAFE_SEARCH": "true",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
            }
        )
        self.assertEqual(config.providers, ("brave", "duckduckgo", "searxng"))
        self.assertEqual(config.provider, "brave")
        self.assertEqual(config.max_results, 10)
        self.assertEqual(config.timeout_seconds, 30)
        self.assertEqual(config.country, "ID")
        self.assertTrue(config.safe_search)
        self.assertTrue(config.preview_available)
        self.assertEqual(config.configuration_errors, ())

    def test_invalid_ranges_language_and_provider_fall_back_safely(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "WEB_SEARCH_MAX_RESULTS": "99",
                "WEB_SEARCH_TIMEOUT_SECONDS": "0",
                "WEB_SEARCH_LANGUAGE": "   ",
                "WEB_SEARCH_PROVIDERS": "brave,unknown-provider,searxng",
                "WEB_SEARCH_PROVIDER": "unknown-primary",
            }
        )
        self.assertEqual(config.max_results, 5)
        self.assertEqual(config.timeout_seconds, 8)
        self.assertEqual(config.language, "id")
        self.assertEqual(config.providers, ("brave", "searxng"))
        self.assertEqual(config.provider, "unknown-primary")
        self.assertIn("unknown_web_search_provider", config.configuration_errors)
        self.assertIn(
            "unknown_primary_web_search_provider",
            config.configuration_errors,
        )

    def test_api_keys_have_no_default_value(self) -> None:
        config = WebSearchConfig.from_env({})
        self.assertIsNone(config.brave.api_key)
        self.assertIsNone(config.searxng.api_key)
        self.assertEqual(config.duckduckgo.base_url, "")
        self.assertEqual(config.searxng.base_url, "")


class SearchRouterModeTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_mode_does_not_call_any_provider(self) -> None:
        providers = stubs(
            provider_response("brave"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), mode="disabled")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(response.mode, "disabled")
        self.assertEqual(response.results, [])
        self.assertTrue(all(stub.calls == 0 for stub in providers.values()))
        self.assertTrue(
            all(item.status == "disabled" for item in response.provider_responses)
        )

    async def test_mock_mode_is_marked_mock(self) -> None:
        response = await SearchRouter(WebSearchConfig()).route(make_query())
        self.assertEqual(response.mode, "mock")
        self.assertTrue(response.is_mock)
        self.assertTrue(response.results)

    async def test_live_mode_requires_explicit_provider_configuration(self) -> None:
        config = replace(WebSearchConfig(), mode="live", strategy="aggregate")
        response = await SearchRouter(config).route(make_query())
        self.assertFalse(response.is_mock)
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])
        self.assertTrue(
            all(item.status == "unavailable" for item in response.provider_responses)
        )


class SearchRouterPriorityTests(unittest.IsolatedAsyncioTestCase):
    async def test_priority_uses_only_brave_on_success(self) -> None:
        providers = stubs(
            provider_response("brave"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), strategy="priority", provider="brave")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(response.providers_requested, ["brave"])
        self.assertEqual(providers["brave"].calls, 1)
        self.assertEqual(providers["searxng"].calls, 0)
        self.assertEqual(providers["duckduckgo"].calls, 0)
        self.assertFalse(response.all_providers_failed)

    async def test_priority_does_not_fallback_when_primary_fails(self) -> None:
        providers = stubs(
            provider_response("brave", "failed"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), strategy="priority", provider="brave")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(response.providers_failed, ["brave"])
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(providers["searxng"].calls, 0)

    async def test_unknown_priority_provider_is_safe(self) -> None:
        response = await SearchRouter(WebSearchConfig()).route(
            make_query(),
            provider="unknown-engine",
            strategy="priority",
        )
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.providers_failed, ["unknown-engine"])
        self.assertEqual(response.provider_responses[0].error_code, "unknown_provider")
