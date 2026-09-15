from __future__ import annotations

import unittest

from app.search.config import WebSearchConfig
from app.search.ssrf import UnsafeOutboundUrl, validate_outbound_base_url


class SearchOutboundUrlTests(unittest.TestCase):
    def test_public_https_host_is_allowed(self) -> None:
        self.assertEqual(
            validate_outbound_base_url("https://search.example/"),
            "https://search.example",
        )

    def test_production_rejects_http(self) -> None:
        with self.assertRaises(UnsafeOutboundUrl):
            validate_outbound_base_url("http://search.example", app_env="production")

    def test_rejects_credentials(self) -> None:
        with self.assertRaises(UnsafeOutboundUrl):
            validate_outbound_base_url("https://user:pass@search.example")

    def test_rejects_query_and_fragment(self) -> None:
        with self.assertRaises(UnsafeOutboundUrl):
            validate_outbound_base_url("https://search.example/?q=test")
        with self.assertRaises(UnsafeOutboundUrl):
            validate_outbound_base_url("https://search.example/#fragment")

    def test_rejects_private_and_loopback_literal_ips(self) -> None:
        for url in (
            "http://127.0.0.1:8080",
            "http://10.0.0.5:8080",
            "http://172.16.0.5:8080",
            "http://192.168.1.5:8080",
            "http://169.254.169.254",
            "http://[::1]:8080",
        ):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeOutboundUrl):
                    validate_outbound_base_url(url)

    def test_enabled_provider_requires_base_url(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "DUCKDUCKGO_SEARCH_ENABLED": "true",
                "DUCKDUCKGO_BASE_URL": "",
            }
        )
        self.assertIn("invalid_duckduckgo_base_url", config.configuration_errors)

    def test_provider_config_rejects_unsafe_url(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "SEARXNG_SEARCH_ENABLED": "true",
                "SEARXNG_BASE_URL": "http://127.0.0.1:8080",
            }
        )
        self.assertIn("invalid_searxng_base_url", config.configuration_errors)
        self.assertEqual(config.searxng.base_url, "")

    def test_production_provider_requires_https(self) -> None:
        config = WebSearchConfig.from_env(
            {
                "APP_ENV": "production",
                "SEARXNG_SEARCH_ENABLED": "true",
                "SEARXNG_BASE_URL": "http://search.example",
            }
        )
        self.assertIn("invalid_searxng_base_url", config.configuration_errors)


if __name__ == "__main__":
    unittest.main()
