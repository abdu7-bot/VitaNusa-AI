from __future__ import annotations

import unittest
from dataclasses import replace
from unittest.mock import patch
from urllib.parse import urlsplit

from app.search.config import WebSearchConfig
from app.search.models import ProviderSearchResponse, SearchQuery
from app.search.providers import (
    BraveSearchProvider,
    DuckDuckGoSearchProvider,
    SearxngSearchProvider,
)


PROVIDER_CASES = (
    ("brave", BraveSearchProvider),
    ("duckduckgo", DuckDuckGoSearchProvider),
    ("searxng", SearxngSearchProvider),
)


def make_query() -> SearchQuery:
    return SearchQuery(
        query="cara menilai klaim produk kesehatan",
        category="product_claim",
    )


class MockSearchProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_mock_providers_share_the_same_contract(self) -> None:
        config = WebSearchConfig(mode="mock", mock_scenario="success")
        expected_fields = set(ProviderSearchResponse.model_fields)

        for expected_name, provider_class in PROVIDER_CASES:
            with self.subTest(provider=expected_name):
                response = await provider_class(config).search(make_query())
                self.assertIsInstance(response, ProviderSearchResponse)
                self.assertEqual(set(response.model_dump()), expected_fields)
                self.assertEqual(response.provider, expected_name)
                self.assertEqual(response.status, "mock")
                self.assertTrue(response.is_mock)
                self.assertTrue(response.results)
                for result in response.results:
                    self.assertEqual(result.provider, expected_name)
                    self.assertTrue(result.is_mock)
                    self.assertTrue((urlsplit(result.url).hostname or "").endswith(".example"))
                    self.assertIn("simulasi", result.snippet.casefold())
                    self.assertIn("bukan sumber kesehatan nyata", result.snippet.casefold())

    async def test_disabled_mode_returns_structured_status_without_results(self) -> None:
        config = replace(WebSearchConfig(), mode="disabled")
        for expected_name, provider_class in PROVIDER_CASES:
            response = await provider_class(config).search(make_query())
            self.assertEqual(response.provider, expected_name)
            self.assertEqual(response.status, "disabled")
            self.assertEqual(response.results, [])
            self.assertFalse(response.is_mock)

    async def test_live_mode_is_not_implemented_and_never_uses_mock(self) -> None:
        config = replace(WebSearchConfig(), mode="live")
        for expected_name, provider_class in PROVIDER_CASES:
            response = await provider_class(config).search(make_query())
            self.assertEqual(response.provider, expected_name)
            self.assertEqual(response.status, "not_implemented")
            self.assertEqual(response.results, [])
            self.assertFalse(response.is_mock)

    async def test_providers_make_no_network_connection(self) -> None:
        for mode in ("mock", "live"):
            config = replace(WebSearchConfig(), mode=mode)
            with patch(
                "socket.socket",
                side_effect=AssertionError("socket access is forbidden"),
            ) as mocked_socket, patch(
                "urllib.request.urlopen",
                side_effect=AssertionError("HTTP access is forbidden"),
            ) as mocked_urlopen:
                for _, provider_class in PROVIDER_CASES:
                    await provider_class(config).search(make_query())
                mocked_socket.assert_not_called()
                mocked_urlopen.assert_not_called()

    async def test_mock_mode_needs_no_api_key_or_base_url(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "WEB_SEARCH_MODE": "mock",
                "WEB_SEARCH_MOCK_SCENARIO": "success",
            }
        )
        for _, provider_class in PROVIDER_CASES:
            response = await provider_class(config).search(make_query())
            self.assertEqual(response.status, "mock")
            self.assertTrue(response.results)

    async def test_empty_timeout_and_rate_limit_are_simulated_structurally(self) -> None:
        expectations = {
            "empty": ("empty", "mock_empty_results"),
            "timeout": ("timeout", "mock_timeout"),
            "rate_limited": ("rate_limited", "mock_rate_limited"),
            "provider_unavailable": (
                "unavailable",
                "mock_provider_unavailable",
            ),
        }
        for scenario, (status, error_code) in expectations.items():
            config = replace(WebSearchConfig(), mock_scenario=scenario)
            for _, provider_class in PROVIDER_CASES:
                with self.subTest(scenario=scenario, provider=provider_class.__name__):
                    response = await provider_class(config).search(make_query())
                    self.assertEqual(response.status, status)
                    self.assertEqual(response.error_code, error_code)
                    self.assertEqual(response.results, [])
                    self.assertTrue(response.is_mock)


if __name__ == "__main__":
    unittest.main()
