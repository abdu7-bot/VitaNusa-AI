from __future__ import annotations

import json
import unittest
from dataclasses import replace
from unittest.mock import patch

import httpx

from app.search.config import SearchProviderRuntimeConfig, WebSearchConfig
from app.search.http_client import ResponseTooLarge, UnsafeRedirect, safe_provider_request, validate_resolved_host
from app.search.models import SearchQuery
from app.search.providers import BraveSearchProvider, DuckDuckGoSearchProvider, SearxngSearchProvider


QUERY = SearchQuery(query="health education")


def public_dns(*args, **kwargs):
    return [(2, 1, 6, "", ("93.184.216.34", 443))]


class SearchRuntimeSecurityTests(unittest.IsolatedAsyncioTestCase):
    def test_runtime_dns_rejects_private_address(self) -> None:
        with patch("app.search.http_client.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaises(ValueError):
                validate_resolved_host("provider.example")

    def test_runtime_dns_accepts_public_address(self) -> None:
        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            addresses = validate_resolved_host("provider.example")
        self.assertEqual(addresses, ("93.184.216.34",))

    async def test_redirect_is_rejected(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(302, headers={"location": "https://127.0.0.1/admin"})

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            with self.assertRaises(UnsafeRedirect):
                await safe_provider_request(
                    url="https://provider.example/search",
                    timeout_seconds=2,
                    transport=httpx.MockTransport(handler),
                )

    async def test_content_length_limit_is_enforced(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, headers={"content-length": "100"}, content=b"x")

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            with self.assertRaises(ResponseTooLarge):
                await safe_provider_request(
                    url="https://provider.example/search",
                    timeout_seconds=2,
                    max_bytes=10,
                    transport=httpx.MockTransport(handler),
                )

    async def test_streaming_response_limit_is_enforced_without_content_length(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b"x" * 20)

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            with self.assertRaises(ResponseTooLarge):
                await safe_provider_request(
                    url="https://provider.example/search",
                    timeout_seconds=2,
                    max_bytes=10,
                    transport=httpx.MockTransport(handler),
                )

    async def test_brave_live_adapter_parses_bounded_response(self) -> None:
        payload = {"web": {"results": [{"title": "Health", "url": "https://example.org/a", "description": "Educational result"}]}}

        async def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers["x-subscription-token"], "secret")
            return httpx.Response(200, json=payload)

        config = replace(
            WebSearchConfig(mode="live", max_response_bytes=10_000),
            brave=SearchProviderRuntimeConfig(enabled=True, api_key="secret"),
        )
        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await BraveSearchProvider(config, transport=httpx.MockTransport(handler)).search(QUERY)
        self.assertEqual(response.status, "success")
        self.assertEqual(len(response.results), 1)
        self.assertEqual(response.results[0].domain, "example.org")

    async def test_duckduckgo_nested_topics_are_parsed(self) -> None:
        payload = {"RelatedTopics": [{"Topics": [{"Text": "Health result", "FirstURL": "https://example.org/ddg"}]}]}

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=payload)

        config = replace(
            WebSearchConfig(mode="live"),
            duckduckgo=SearchProviderRuntimeConfig(enabled=True, base_url="https://api.example.com/"),
        )
        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await DuckDuckGoSearchProvider(config, transport=httpx.MockTransport(handler)).search(QUERY)
        self.assertEqual(response.status, "success")
        self.assertEqual(response.results[0].url, "https://example.org/ddg")

    async def test_searxng_results_are_parsed(self) -> None:
        payload = {"results": [{"title": "Health result", "url": "https://example.org/searx", "content": "Educational result", "score": 1.2}]}

        async def handler(request: httpx.Request) -> httpx.Response:
            self.assertTrue(str(request.url).endswith("/search?q=health+education&format=json&language=id&safesearch=2&categories=general"))
            return httpx.Response(200, json=payload)

        config = replace(
            WebSearchConfig(mode="live"),
            searxng=SearchProviderRuntimeConfig(enabled=True, base_url="https://search.example.com/"),
        )
        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await SearxngSearchProvider(config, transport=httpx.MockTransport(handler)).search(QUERY)
        self.assertEqual(response.status, "success")
        self.assertEqual(response.results[0].domain, "example.org")

    async def test_429_is_rate_limited(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(429)

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await DuckDuckGoSearchProvider(
                replace(WebSearchConfig(mode="live"), duckduckgo=SearchProviderRuntimeConfig(enabled=True, base_url="https://api.example.com/")),
                transport=httpx.MockTransport(handler),
            ).search(QUERY)
        self.assertEqual(response.status, "rate_limited")

    async def test_5xx_is_unavailable(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503)

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await DuckDuckGoSearchProvider(
                replace(WebSearchConfig(mode="live"), duckduckgo=SearchProviderRuntimeConfig(enabled=True, base_url="https://api.example.com/")),
                transport=httpx.MockTransport(handler),
            ).search(QUERY)
        self.assertEqual(response.status, "unavailable")

    async def test_invalid_json_is_failed_without_leaking_body(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b"not-json-secret-provider-body")

        with patch("app.search.http_client.socket.getaddrinfo", side_effect=public_dns):
            response = await DuckDuckGoSearchProvider(
                replace(WebSearchConfig(mode="live"), duckduckgo=SearchProviderRuntimeConfig(enabled=True, base_url="https://api.example.com/")),
                transport=httpx.MockTransport(handler),
            ).search(QUERY)
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "provider_invalid_json")
        self.assertNotIn("secret", response.error_message or "")

    async def test_runtime_response_size_is_configurable_but_bounded(self) -> None:
        config = WebSearchConfig.from_env({"WEB_SEARCH_MAX_RESPONSE_BYTES": "20000"})
        self.assertEqual(config.max_response_bytes, 20_000)
        invalid = WebSearchConfig.from_env({"WEB_SEARCH_MAX_RESPONSE_BYTES": "99999999"})
        self.assertIn("invalid_web_search_max_response_bytes", invalid.configuration_errors)
        self.assertLessEqual(invalid.max_response_bytes, 5_000_000)


if __name__ == "__main__":
    unittest.main()
