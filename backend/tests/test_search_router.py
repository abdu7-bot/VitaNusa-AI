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

    async def test_live_mode_is_structured_not_implemented(self) -> None:
        config = replace(WebSearchConfig(), mode="live", strategy="aggregate")
        response = await SearchRouter(config).route(make_query())
        self.assertFalse(response.is_mock)
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])
        self.assertTrue(
            all(item.status == "not_implemented" for item in response.provider_responses)
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


class SearchRouterFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_brave_success_stops_fallback(self) -> None:
        providers = stubs(
            provider_response("brave"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), strategy="fallback")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(response.providers_requested, ["brave"])
        self.assertEqual(providers["searxng"].calls, 0)
        self.assertEqual(providers["duckduckgo"].calls, 0)

    async def test_brave_empty_then_searxng_succeeds(self) -> None:
        providers = stubs(
            provider_response("brave", "empty"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), strategy="fallback")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(response.providers_requested, ["brave", "searxng"])
        self.assertEqual(providers["duckduckgo"].calls, 0)
        self.assertEqual(response.results[0].provider, "searxng")

    async def test_two_failures_then_duckduckgo_succeeds(self) -> None:
        providers = stubs(
            provider_response("brave", "failed"),
            provider_response("searxng", "timeout"),
            provider_response("duckduckgo"),
        )
        config = replace(WebSearchConfig(), strategy="fallback")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertEqual(
            response.providers_requested,
            ["brave", "searxng", "duckduckgo"],
        )
        self.assertEqual(response.providers_failed, ["brave", "searxng"])
        self.assertTrue(response.partial_failure)
        self.assertEqual(response.results[0].provider, "duckduckgo")

    async def test_all_fallback_providers_fail_without_exception(self) -> None:
        providers = stubs(
            provider_response("brave", "failed"),
            provider_response("searxng", "unavailable"),
            provider_response("duckduckgo", "rate_limited"),
        )
        config = replace(WebSearchConfig(), strategy="fallback")
        response = await SearchRouter(config, providers).route(make_query())
        self.assertTrue(response.all_providers_failed)
        self.assertFalse(response.partial_failure)
        self.assertEqual(len(response.providers_failed), 3)
        self.assertEqual(response.results, [])


class SearchRouterAggregateTests(unittest.IsolatedAsyncioTestCase):
    def aggregate_router(
        self,
        providers: dict[str, StubProvider],
        *,
        max_results: int = 5,
    ) -> SearchRouter:
        config = replace(
            WebSearchConfig(),
            strategy="aggregate",
            max_results=max_results,
        )
        return SearchRouter(config, providers)

    async def test_all_providers_succeed(self) -> None:
        providers = stubs(
            provider_response("brave", count=2),
            provider_response("searxng", count=2),
            provider_response("duckduckgo", count=2),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertEqual(
            response.providers_requested,
            ["brave", "duckduckgo", "searxng"],
        )
        self.assertEqual(len(response.providers_completed), 3)
        self.assertEqual(response.providers_failed, [])
        self.assertEqual(len(response.results), 5)

    async def test_one_provider_failure_is_partial(self) -> None:
        providers = stubs(
            provider_response("brave"),
            provider_response("searxng", "timeout"),
            provider_response("duckduckgo"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertTrue(response.partial_failure)
        self.assertFalse(response.all_providers_failed)
        self.assertEqual(response.providers_failed, ["searxng"])
        self.assertTrue(response.results)

    async def test_two_provider_failures_still_return_survivor(self) -> None:
        providers = stubs(
            provider_response("brave", "failed"),
            provider_response("searxng", "timeout"),
            provider_response("duckduckgo"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertTrue(response.partial_failure)
        self.assertEqual(set(response.providers_failed), {"brave", "searxng"})
        self.assertTrue(response.results)

    async def test_all_provider_failures_are_structured(self) -> None:
        providers = stubs(
            provider_response("brave", "failed"),
            provider_response("searxng", "timeout"),
            provider_response("duckduckgo", "unavailable"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertTrue(response.all_providers_failed)
        self.assertFalse(response.partial_failure)
        self.assertEqual(response.results, [])

    async def test_duplicate_results_are_merged_and_richer_snippet_wins(self) -> None:
        shared_short = search_result(
            "brave",
            url="https://education.example/article?utm_source=brave",
            snippet="Simulasi singkat.",
        )
        shared_long = search_result(
            "searxng",
            url="https://education.example/article",
            snippet=(
                "Hasil simulasi yang lebih lengkap untuk menguji deduplikasi; "
                "ini bukan sumber kesehatan nyata."
            ),
        )
        providers = stubs(
            provider_response("brave", results=[shared_short]),
            provider_response("searxng", results=[shared_long]),
            provider_response("duckduckgo", "empty"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertEqual(len(response.results), 1)
        self.assertIn("lebih lengkap", response.results[0].snippet)
        self.assertGreater(response.results[0].score, 0.0)

    async def test_result_limit_never_exceeds_ten(self) -> None:
        providers = stubs(
            provider_response("brave", count=10),
            provider_response("searxng", count=10),
            provider_response("duckduckgo", count=10),
        )
        router = self.aggregate_router(providers, max_results=10)
        response = await router.route(make_query(max_results=10))
        self.assertLessEqual(len(response.results), 10)

    async def test_ranking_order_is_stable(self) -> None:
        providers = stubs(
            provider_response("brave", count=3),
            provider_response("searxng", count=3),
            provider_response("duckduckgo", count=3),
        )
        router = self.aggregate_router(providers)
        first = await router.route(make_query(category="product_claim"))
        second = await router.route(make_query(category="product_claim"))
        self.assertEqual(
            [(item.url, item.score) for item in first.results],
            [(item.url, item.score) for item in second.results],
        )

    async def test_health_ranking_prefers_source_type_not_https_alone(self) -> None:
        common = {
            "title": "Panduan kesehatan simulasi",
            "snippet": "Hasil simulasi dan bukan sumber kesehatan nyata.",
        }
        authority = SearchResult(
            **common,
            url="https://health-authority.example/panduan",
            domain="health-authority.example",
            provider="brave",
            is_mock=True,
        )
        community = SearchResult(
            **common,
            url="https://community.example/panduan",
            domain="community.example",
            provider="searxng",
            is_mock=True,
        )
        providers = stubs(
            provider_response("brave", results=[authority]),
            provider_response("searxng", results=[community]),
            provider_response("duckduckgo", "empty"),
        )
        response = await self.aggregate_router(providers).route(
            make_query(category="health")
        )
        self.assertEqual(response.results[0].domain, "health-authority.example")
        self.assertGreater(response.results[0].score, response.results[1].score)

    async def test_provider_exception_does_not_escape_or_reveal_detail(self) -> None:
        providers = stubs(
            provider_response("brave"),
            provider_response("searxng"),
            provider_response("duckduckgo"),
        )
        providers["brave"] = StubProvider(
            "brave",
            error=RuntimeError("private filesystem path /secret"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        brave = next(item for item in response.provider_responses if item.provider == "brave")
        self.assertEqual(brave.status, "failed")
        self.assertEqual(brave.error_code, "provider_failed")
        self.assertNotIn("secret", brave.error_message or "")
        self.assertTrue(response.results)

    async def test_unsafe_provider_url_is_discarded(self) -> None:
        unsafe = search_result("brave", url="javascript:alert(1)")
        providers = stubs(
            provider_response("brave", results=[unsafe]),
            provider_response("searxng", "empty"),
            provider_response("duckduckgo", "empty"),
        )
        response = await self.aggregate_router(providers).route(make_query())
        self.assertEqual(response.results, [])
        brave = next(item for item in response.provider_responses if item.provider == "brave")
        self.assertEqual(brave.status, "empty")


class SearchPreviewEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_rejects_query_that_is_too_short_after_cleaning(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="a "))
        self.assertEqual(raised.exception.status_code, 400)

    async def test_preview_is_404_when_disabled(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_PREVIEW_ENABLED": "false",
            },
            clear=False,
        ):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="cari edukasi"))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_preview_is_404_in_production_even_if_flag_is_true(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="cari edukasi"))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_mock_product_claim_preview_runs_three_providers(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
                "WEB_SEARCH_STRATEGY": "aggregate",
                "WEB_SEARCH_PROVIDERS": "brave,duckduckgo,searxng",
                "WEB_SEARCH_MOCK_SCENARIO": "success",
            },
            clear=False,
        ):
            response = await search_preview(
                SearchPreviewRequest(
                    query="cara menilai klaim produk kesehatan",
                    category="product_claim",
                    strategy="aggregate",
                    maxResults=5,
                )
            )
        self.assertTrue(response.is_mock)
        self.assertEqual(
            set(response.providers_requested),
            {"brave", "duckduckgo", "searxng"},
        )
        self.assertTrue(response.results)
        for result in response.results:
            self.assertTrue(result.domain.endswith(".example"))
            self.assertTrue(result.is_mock)
            self.assertIn("simulasi", result.snippet.casefold())

    async def test_emergency_preview_never_calls_router(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ), patch(
            "app.main.SearchRouter.route",
            new=AsyncMock(side_effect=AssertionError("search router must not run")),
        ) as route:
            response = await search_preview(
                SearchPreviewRequest(
                    query="Saya sesak berat dan nyeri dada.",
                    category="health",
                    strategy="aggregate",
                )
            )
        route.assert_not_awaited()
        self.assertEqual(response.provider_responses[0].status, "blocked")
        self.assertEqual(
            response.provider_responses[0].error_code,
            "emergency_response_required",
        )

    async def test_medication_preview_never_calls_router(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ), patch(
            "app.main.SearchRouter.route",
            new=AsyncMock(side_effect=AssertionError("search router must not run")),
        ) as route:
            response = await search_preview(
                SearchPreviewRequest(
                    query="Berikan dosis obat resep untuk saya.",
                    category="health",
                )
            )
        route.assert_not_awaited()
        self.assertEqual(
            response.provider_responses[0].error_code,
            "personal_medication_search_blocked",
        )

    async def test_all_failed_preview_is_not_an_exception(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "development",
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_PREVIEW_ENABLED": "true",
                "WEB_SEARCH_STRATEGY": "aggregate",
                "WEB_SEARCH_PROVIDERS": "brave,duckduckgo,searxng",
                "WEB_SEARCH_MOCK_SCENARIO": "all_failed",
            },
            clear=False,
        ):
            response = await search_preview(
                SearchPreviewRequest(
                    query="cara menilai klaim produk kesehatan",
                    category="product_claim",
                )
            )
        self.assertTrue(response.is_mock)
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])


class AskSearchRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_ask_works_when_search_is_disabled(self) -> None:
        with patch.dict(
            os.environ,
            {
                "WEB_SEARCH_MODE": "disabled",
                "LOCAL_LLM_ASK_ENABLED": "false",
            },
            clear=False,
        ):
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        self.assertTrue(response.answer)
        self.assertEqual(response.sources, [])

    async def test_mock_search_never_enters_public_answer_or_sources(self) -> None:
        with patch.dict(
            os.environ,
            {
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_MOCK_SCENARIO": "success",
                "LOCAL_LLM_ASK_ENABLED": "false",
            },
            clear=False,
        ):
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        public_payload = response.model_dump_json().casefold()
        self.assertEqual(response.sources, [])
        self.assertNotIn(".example", public_payload)
        self.assertNotIn("hasil simulasi", response.answer.casefold())

    async def test_search_router_failure_cannot_break_ask(self) -> None:
        with patch.dict(
            os.environ,
            {"WEB_SEARCH_MODE": "mock", "LOCAL_LLM_ASK_ENABLED": "false"},
            clear=False,
        ), patch(
            "app.main.SearchRouter.route",
            new=AsyncMock(side_effect=RuntimeError("search failure")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertTrue(response.answer)
        self.assertEqual(response.sources, [])

    async def test_emergency_ask_remains_safety_first(self) -> None:
        with patch.dict(
            os.environ,
            {"WEB_SEARCH_MODE": "mock", "LOCAL_LLM_ASK_ENABLED": "false"},
            clear=False,
        ):
            response = await ask_ai(
                AskRequest(question="Saya sesak berat dan nyeri dada.")
            )
        self.assertEqual(response.safetyLevel, "emergency")
        self.assertEqual(response.sources, [])
        self.assertEqual(response.policyDecision.dominantPolicy, "medical_safety")

    async def test_medication_ask_keeps_dose_boundary(self) -> None:
        response = await ask_ai(
            AskRequest(question="Berikan dosis obat resep untuk saya.")
        )
        self.assertIn("tidak dapat memberikan dosis", response.answer.casefold())
        self.assertIn(
            "give_personal_dose",
            response.policyDecision.prohibitedActions,
        )
        self.assertEqual(response.sources, [])

    async def test_product_claim_ask_keeps_policy_engine_response(self) -> None:
        response = await ask_ai(
            AskRequest(question="Produk ini pasti menyembuhkan diabetes.")
        )
        self.assertEqual(response.intent, "product_claim")
        self.assertTrue(response.policyDecision.responseBlocked)
        self.assertIn("claim_cure", response.policyDecision.prohibitedActions)
        self.assertEqual(response.sources, [])
        self.assertNotIn(".example", response.answer)


if __name__ == "__main__":
    unittest.main()
