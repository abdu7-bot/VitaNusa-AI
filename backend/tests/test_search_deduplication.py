from __future__ import annotations

import unittest

from app.search.deduplicator import deduplicate_results
from app.search.models import SearchResult
from app.search.normalizer import normalize_search_result, normalize_url


def result(
    url: str,
    *,
    title: str = "Artikel edukasi simulasi",
    snippet: str = "Ringkasan simulasi.",
    provider: str = "brave",
) -> SearchResult:
    return SearchResult(
        title=title,
        url=url,
        snippet=snippet,
        domain="ignored.example",
        provider=provider,
        is_mock=True,
    )


class SearchNormalizerTests(unittest.TestCase):
    def test_tracking_parameters_are_removed(self) -> None:
        tracked = normalize_url(
            "https://education.example/article?utm_source=test&utm_medium=email"
        )
        plain = normalize_url("https://education.example/article")
        self.assertEqual(tracked, plain)

    def test_query_parameter_order_is_canonical(self) -> None:
        first = normalize_url("https://education.example/article?a=1&b=2")
        second = normalize_url("https://education.example/article?b=2&a=1")
        self.assertEqual(first, second)
        self.assertEqual(first, "https://education.example/article?a=1&b=2")

    def test_required_query_parameters_are_preserved(self) -> None:
        normalized = normalize_url(
            "https://education.example/article?page=2&utm_campaign=test"
        )
        self.assertEqual(normalized, "https://education.example/article?page=2")

    def test_dangerous_and_unsupported_schemes_are_rejected(self) -> None:
        dangerous = (
            "javascript:alert(1)",
            "data:text/html,test",
            "file:///etc/passwd",
            "ftp://education.example/file",
        )
        for url in dangerous:
            with self.subTest(url=url):
                self.assertIsNone(normalize_url(url))

    def test_malformed_urls_do_not_raise(self) -> None:
        malformed = ("not a url", "https://[broken", "http://", "https://user@:80")
        for url in malformed:
            with self.subTest(url=url):
                self.assertIsNone(normalize_url(url))

    def test_result_fields_are_cleaned_and_domain_is_extracted(self) -> None:
        normalized = normalize_search_result(
            result(
                "https://Education.Example/article#section",
                title="  Judul   simulasi  ",
                snippet=" Ringkasan   simulasi. ",
                provider="brave",
            )
        )
        self.assertIsNotNone(normalized)
        self.assertEqual(normalized.title, "Judul simulasi")
        self.assertEqual(normalized.snippet, "Ringkasan simulasi.")
        self.assertEqual(normalized.domain, "education.example")
        self.assertNotIn("#", normalized.url)


class SearchDeduplicationTests(unittest.TestCase):
    def test_tracking_variant_and_plain_url_are_one_result(self) -> None:
        deduplicated = deduplicate_results(
            [
                result(
                    "https://education.example/article?utm_source=test",
                    provider="brave",
                ),
                result(
                    "https://education.example/article",
                    provider="searxng",
                    snippet="Ringkasan simulasi yang lebih lengkap dan tetap bukan sumber nyata.",
                ),
            ]
        )
        self.assertEqual(len(deduplicated), 1)
        self.assertIn("lebih lengkap", deduplicated[0].snippet)
        self.assertGreater(deduplicated[0].score, 0.0)

    def test_query_order_variants_are_one_result(self) -> None:
        deduplicated = deduplicate_results(
            [
                result("https://education.example/article?a=1&b=2"),
                result(
                    "https://education.example/article?b=2&a=1",
                    provider="duckduckgo",
                ),
            ]
        )
        self.assertEqual(len(deduplicated), 1)

    def test_same_title_on_different_paths_is_not_over_deduplicated(self) -> None:
        deduplicated = deduplicate_results(
            [
                result("https://education.example/article-one"),
                result(
                    "https://education.example/article-two",
                    provider="searxng",
                ),
            ]
        )
        self.assertEqual(len(deduplicated), 2)

    def test_unsafe_result_is_removed_without_exception(self) -> None:
        deduplicated = deduplicate_results(
            [
                result("javascript:alert(1)"),
                result("https://education.example/safe"),
            ]
        )
        self.assertEqual(len(deduplicated), 1)
        self.assertEqual(deduplicated[0].url, "https://education.example/safe")


if __name__ == "__main__":
    unittest.main()
