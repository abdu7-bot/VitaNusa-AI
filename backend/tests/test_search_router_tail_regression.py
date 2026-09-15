from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.main import ask_ai, search_preview
from app.schemas import AskRequest, SearchPreviewRequest
from app.search.config import WebSearchConfig
from app.search.models import SearchResult
from app.search.router import SearchRouter
from test_search_router import make_query, search_result, provider_response, stubs, StubProvider


class SearchRouterFallbackTailTests(unittest.IsolatedAsyncioTestCase):
    async def test_brave_success_stops_fallback(self):
        providers = stubs(provider_response("brave"), provider_response("searxng"), provider_response("duckduckgo"))
        response = await SearchRouter(WebSearchConfig(strategy="fallback"), providers).route(make_query())
        self.assertEqual(response.providers_requested, ["brave"])

    async def test_brave_empty_then_searxng_succeeds(self):
        providers = stubs(provider_response("brave", "empty"), provider_response("searxng"), provider_response("duckduckgo"))
        response = await SearchRouter(WebSearchConfig(strategy="fallback"), providers).route(make_query())
        self.assertEqual(response.providers_requested, ["brave", "searxng"])
        self.assertEqual(response.results[0].provider, "searxng")

    async def test_two_failures_then_duckduckgo_succeeds(self):
        providers = stubs(provider_response("brave", "failed"), provider_response("searxng", "timeout"), provider_response("duckduckgo"))
        response = await SearchRouter(WebSearchConfig(strategy="fallback"), providers).route(make_query())
        self.assertEqual(response.providers_failed, ["brave", "searxng"])
        self.assertTrue(response.results)

    async def test_all_fallback_providers_fail_without_exception(self):
        providers = stubs(provider_response("brave", "failed"), provider_response("searxng", "unavailable"), provider_response("duckduckgo", "rate_limited"))
        response = await SearchRouter(WebSearchConfig(strategy="fallback"), providers).route(make_query())
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])


class SearchRouterAggregateTailTests(unittest.IsolatedAsyncioTestCase):
    def router(self, providers, max_results=5):
        return SearchRouter(WebSearchConfig(strategy="aggregate", max_results=max_results), providers)

    async def test_all_providers_succeed(self):
        providers = stubs(provider_response("brave", count=2), provider_response("searxng", count=2), provider_response("duckduckgo", count=2))
        response = await self.router(providers).route(make_query())
        self.assertEqual(len(response.providers_completed), 3)
        self.assertEqual(len(response.results), 5)

    async def test_one_provider_failure_is_partial(self):
        providers = stubs(provider_response("brave"), provider_response("searxng", "timeout"), provider_response("duckduckgo"))
        response = await self.router(providers).route(make_query())
        self.assertTrue(response.partial_failure)
        self.assertTrue(response.results)

    async def test_two_provider_failures_still_return_survivor(self):
        providers = stubs(provider_response("brave", "failed"), provider_response("searxng", "timeout"), provider_response("duckduckgo"))
        response = await self.router(providers).route(make_query())
        self.assertTrue(response.partial_failure)
        self.assertTrue(response.results)

    async def test_all_provider_failures_are_structured(self):
        providers = stubs(provider_response("brave", "failed"), provider_response("searxng", "timeout"), provider_response("duckduckgo", "unavailable"))
        response = await self.router(providers).route(make_query())
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])

    async def test_duplicate_results_are_merged_and_richer_snippet_wins(self):
        first = search_result("brave", url="https://education.example/article?utm_source=brave", snippet="Simulasi singkat.")
        second = search_result("searxng", url="https://education.example/article", snippet="Hasil simulasi yang lebih lengkap untuk menguji deduplikasi; ini bukan sumber kesehatan nyata.")
        providers = stubs(provider_response("brave", results=[first]), provider_response("searxng", results=[second]), provider_response("duckduckgo", "empty"))
        response = await self.router(providers).route(make_query())
        self.assertEqual(len(response.results), 1)
        self.assertIn("lebih lengkap", response.results[0].snippet)

    async def test_result_limit_never_exceeds_ten(self):
        providers = stubs(provider_response("brave", count=10), provider_response("searxng", count=10), provider_response("duckduckgo", count=10))
        response = await self.router(providers, 10).route(make_query(max_results=10))
        self.assertLessEqual(len(response.results), 10)

    async def test_ranking_order_is_stable(self):
        providers = stubs(provider_response("brave", count=3), provider_response("searxng", count=3), provider_response("duckduckgo", count=3))
        router = self.router(providers)
        first = await router.route(make_query(category="product_claim"))
        second = await router.route(make_query(category="product_claim"))
        self.assertEqual([(x.url, x.score) for x in first.results], [(x.url, x.score) for x in second.results])

    async def test_health_ranking_prefers_source_type_not_https_alone(self):
        authority = SearchResult(title="Panduan kesehatan simulasi", snippet="Hasil simulasi dan bukan sumber kesehatan nyata.", url="https://health-authority.example/panduan", domain="health-authority.example", provider="brave", is_mock=True)
        community = SearchResult(title=authority.title, snippet=authority.snippet, url="https://community.example/panduan", domain="community.example", provider="searxng", is_mock=True)
        providers = stubs(provider_response("brave", results=[authority]), provider_response("searxng", results=[community]), provider_response("duckduckgo", "empty"))
        response = await self.router(providers).route(make_query(category="health"))
        self.assertEqual(response.results[0].domain, "health-authority.example")

    async def test_provider_exception_does_not_escape_or_reveal_detail(self):
        providers = stubs(provider_response("brave"), provider_response("searxng"), provider_response("duckduckgo"))
        providers["brave"] = StubProvider("brave", error=RuntimeError("private filesystem path /secret"))
        response = await self.router(providers).route(make_query())
        brave = next(item for item in response.provider_responses if item.provider == "brave")
        self.assertEqual(brave.error_code, "provider_failed")
        self.assertNotIn("secret", brave.error_message or "")

    async def test_unsafe_provider_url_is_discarded(self):
        providers = stubs(provider_response("brave", results=[search_result("brave", url="javascript:alert(1)")]), provider_response("searxng", "empty"), provider_response("duckduckgo", "empty"))
        response = await self.router(providers).route(make_query())
        self.assertEqual(response.results, [])


class SearchPreviewTailTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_rejects_short_query(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_PREVIEW_ENABLED": "true"}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="a "))
        self.assertEqual(raised.exception.status_code, 400)

    async def test_preview_is_404_when_disabled(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_PREVIEW_ENABLED": "false"}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="cari edukasi"))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_preview_is_404_in_production_even_if_flag_true(self):
        with patch.dict(os.environ, {"APP_ENV": "production", "WEB_SEARCH_PREVIEW_ENABLED": "true"}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                await search_preview(SearchPreviewRequest(query="cari edukasi"))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_mock_product_claim_preview_runs_three_providers(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_MODE": "mock", "WEB_SEARCH_PREVIEW_ENABLED": "true", "WEB_SEARCH_STRATEGY": "aggregate", "WEB_SEARCH_PROVIDERS": "brave,duckduckgo,searxng", "WEB_SEARCH_MOCK_SCENARIO": "success"}, clear=False):
            response = await search_preview(SearchPreviewRequest(query="cara menilai klaim produk kesehatan", category="product_claim", strategy="aggregate", maxResults=5))
        self.assertTrue(response.is_mock)
        self.assertEqual(set(response.providers_requested), {"brave", "duckduckgo", "searxng"})
        self.assertTrue(response.results)

    async def test_emergency_preview_never_calls_router(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_MODE": "mock", "WEB_SEARCH_PREVIEW_ENABLED": "true"}, clear=False), patch("app.main.SearchRouter.route", new=AsyncMock(side_effect=AssertionError())) as route:
            response = await search_preview(SearchPreviewRequest(query="Saya sesak berat dan nyeri dada.", category="health", strategy="aggregate"))
        route.assert_not_awaited()
        self.assertEqual(response.provider_responses[0].status, "blocked")

    async def test_medication_preview_never_calls_router(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_MODE": "mock", "WEB_SEARCH_PREVIEW_ENABLED": "true"}, clear=False), patch("app.main.SearchRouter.route", new=AsyncMock(side_effect=AssertionError())) as route:
            response = await search_preview(SearchPreviewRequest(query="Berikan dosis obat resep untuk saya.", category="health"))
        route.assert_not_awaited()
        self.assertEqual(response.provider_responses[0].error_code, "personal_medication_search_blocked")

    async def test_all_failed_preview_is_not_exception(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "WEB_SEARCH_MODE": "mock", "WEB_SEARCH_PREVIEW_ENABLED": "true", "WEB_SEARCH_STRATEGY": "aggregate", "WEB_SEARCH_PROVIDERS": "brave,duckduckgo,searxng", "WEB_SEARCH_MOCK_SCENARIO": "all_failed"}, clear=False):
            response = await search_preview(SearchPreviewRequest(query="cara menilai klaim produk kesehatan", category="product_claim"))
        self.assertTrue(response.is_mock)
        self.assertTrue(response.all_providers_failed)
        self.assertEqual(response.results, [])


class AskSearchTailTests(unittest.IsolatedAsyncioTestCase):
    async def test_ask_works_when_search_disabled(self):
        with patch.dict(os.environ, {"WEB_SEARCH_MODE": "disabled", "LOCAL_LLM_ASK_ENABLED": "false"}, clear=False):
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        self.assertTrue(response.answer)
        self.assertEqual(response.sources, [])

    async def test_mock_search_never_enters_public_answer_or_sources(self):
        with patch.dict(os.environ, {"WEB_SEARCH_MODE": "mock", "WEB_SEARCH_MOCK_SCENARIO": "success", "LOCAL_LLM_ASK_ENABLED": "false"}, clear=False):
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        self.assertEqual(response.sources, [])
        self.assertNotIn(".example", response.model_dump_json().casefold())

    async def test_search_router_failure_cannot_break_ask(self):
        with patch.dict(os.environ, {"WEB_SEARCH_MODE": "mock", "LOCAL_LLM_ASK_ENABLED": "false"}, clear=False), patch("app.main.SearchRouter.route", new=AsyncMock(side_effect=RuntimeError("search failure"))) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertTrue(response.answer)
        self.assertEqual(response.sources, [])

    async def test_emergency_ask_remains_safety_first(self):
        with patch.dict(os.environ, {"WEB_SEARCH_MODE": "mock", "LOCAL_LLM_ASK_ENABLED": "false"}, clear=False):
            response = await ask_ai(AskRequest(question="Saya sesak berat dan nyeri dada."))
        self.assertEqual(response.safetyLevel, "emergency")
        self.assertEqual(response.sources, [])

    async def test_medication_ask_keeps_dose_boundary(self):
        response = await ask_ai(AskRequest(question="Berikan dosis obat resep untuk saya."))
        self.assertIn("tidak dapat memberikan dosis", response.answer.casefold())
        self.assertEqual(response.sources, [])

    async def test_product_claim_ask_keeps_policy_engine_response(self):
        response = await ask_ai(AskRequest(question="Produk ini pasti menyembuhkan diabetes."))
        self.assertEqual(response.intent, "product_claim")
        self.assertTrue(response.policyDecision.responseBlocked)
        self.assertEqual(response.sources, [])
        self.assertNotIn(".example", response.answer)


if __name__ == "__main__":
    unittest.main()
