from __future__ import annotations

import re
import unittest
from dataclasses import replace
from unittest.mock import patch

from app.llm.config import LocalLlmConfig
from app.llm.models import LlmRequest, LlmResponse
from app.llm.providers import LMStudioProvider, LocalAIProvider, OllamaProvider


PROVIDER_CASES = (
    ("ollama", OllamaProvider),
    ("lmstudio", LMStudioProvider),
    ("localai", LocalAIProvider),
)


def make_request() -> LlmRequest:
    return LlmRequest(
        system_prompt="Berikan edukasi umum dan patuhi policy aplikasi.",
        user_message="Jelaskan VitaCheck secara singkat.",
    )


class MockProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_mock_providers_use_the_same_safe_contract(self) -> None:
        config = LocalLlmConfig(mode="mock", mock_scenario="success")
        expected_fields = set(LlmResponse.model_fields)

        for expected_name, provider_class in PROVIDER_CASES:
            with self.subTest(provider=expected_name):
                response = await provider_class(config).generate(make_request())
                self.assertIsInstance(response, LlmResponse)
                self.assertEqual(set(response.model_dump()), expected_fields)
                self.assertEqual(response.provider, expected_name)
                self.assertEqual(response.status, "mock")
                self.assertTrue(response.is_mock)
                self.assertTrue(response.content)
                self.assertIsNone(response.error_code)

    async def test_mock_output_does_not_make_medical_claims(self) -> None:
        config = LocalLlmConfig(mode="mock", mock_scenario="success")

        for _, provider_class in PROVIDER_CASES:
            response = await provider_class(config).generate(make_request())
            lowered = response.content.casefold()
            self.assertNotRegex(lowered, r"\b(?:anda|kamu) menderita\b")
            self.assertNotIn("pasti sembuh", lowered)
            self.assertNotIn("100% aman", lowered)
            self.assertIsNone(
                re.search(r"\b\d+(?:[.,]\d+)?\s*(?:mg|ml|tablet|kapsul)\b", lowered)
            )

    async def test_disabled_mode_returns_no_content(self) -> None:
        config = replace(LocalLlmConfig(), mode="disabled")

        for expected_name, provider_class in PROVIDER_CASES:
            response = await provider_class(config).generate(make_request())
            self.assertEqual(response.provider, expected_name)
            self.assertEqual(response.status, "disabled")
            self.assertEqual(response.content, "")
            self.assertFalse(response.is_mock)

    async def test_live_mode_is_explicitly_not_implemented(self) -> None:
        config = replace(LocalLlmConfig(), mode="live")

        for expected_name, provider_class in PROVIDER_CASES:
            response = await provider_class(config).generate(make_request())
            self.assertEqual(response.provider, expected_name)
            self.assertEqual(response.status, "not_implemented")
            self.assertEqual(response.content, "")
            self.assertFalse(response.is_mock)

    async def test_provider_adapters_never_make_http_requests(self) -> None:
        for mode in ("mock", "live"):
            config = replace(LocalLlmConfig(), mode=mode)
            with patch(
                "urllib.request.urlopen",
                side_effect=AssertionError("network call is forbidden"),
            ) as mocked_urlopen:
                for _, provider_class in PROVIDER_CASES:
                    await provider_class(config).generate(make_request())
                mocked_urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
