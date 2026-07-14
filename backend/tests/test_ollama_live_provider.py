from __future__ import annotations

import json
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch

import httpx

from app.llm.config import (
    LocalLlmConfig,
    ProviderRuntimeConfig,
    validate_local_provider_url,
)
from app.llm.http_providers import MAX_MODEL_RESPONSE_CHARS, LiveOllamaProvider
from app.llm.models import LlmRequest


MODEL = "gemma3:1b"


def make_config(
    *,
    mode: str = "live",
    enabled: bool = True,
    model: str | None = MODEL,
    base_url: str = "http://127.0.0.1:11434",
) -> LocalLlmConfig:
    return replace(
        LocalLlmConfig(),
        mode=mode,
        strategy="priority",
        providers=("ollama",),
        provider="ollama",
        model=model,
        timeout_seconds=1.0,
        ollama=ProviderRuntimeConfig(enabled=enabled, base_url=base_url),
    )


def make_request() -> LlmRequest:
    return LlmRequest(
        system_prompt="Patuhi Policy Engine dan berikan edukasi umum.",
        user_message="Jelaskan fungsi VitaCheck secara singkat.",
        temperature=0.2,
        max_tokens=500,
        intent="vitacheck",
        safety_level="low",
    )


class OllamaLiveProviderContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_client_ignores_proxy_environment(self) -> None:
        response = httpx.Response(
            200,
            json={"message": {"content": "Respons lokal."}},
            request=httpx.Request("POST", "http://127.0.0.1:11434/api/chat"),
        )
        client = AsyncMock()
        client.post.return_value = response

        with patch("app.llm.http_providers.httpx.AsyncClient") as client_class:
            client_class.return_value.__aenter__ = AsyncMock(return_value=client)
            client_class.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await LiveOllamaProvider(make_config()).generate(make_request())

        self.assertEqual(result.status, "success")
        self.assertFalse(client_class.call_args.kwargs["trust_env"])

    async def test_request_contract_uses_api_chat_and_configured_values(self) -> None:
        captured: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["method"] = request.method
            captured["url"] = str(request.url)
            captured["payload"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(
                200,
                json={"message": {"content": "  Respons lokal yang aman.  "}},
            )

        provider = LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(handler),
        )
        response = await provider.generate(make_request())

        payload = captured["payload"]
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["url"], "http://127.0.0.1:11434/api/chat")
        self.assertEqual(payload["model"], MODEL)
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["options"]["temperature"], 0.2)
        self.assertEqual(payload["options"]["num_predict"], 500)
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertEqual(payload["messages"][0]["content"], make_request().system_prompt)
        self.assertEqual(payload["messages"][1]["role"], "user")
        self.assertEqual(payload["messages"][1]["content"], make_request().user_message)
        self.assertEqual(response.status, "success")
        self.assertEqual(response.model, MODEL)
        self.assertEqual(response.content, "Respons lokal yang aman.")
        self.assertFalse(response.is_mock)

    async def test_empty_content_is_structured(self) -> None:
        for content in ("", "   \n\t"):
            with self.subTest(content=content):
                transport = httpx.MockTransport(
                    lambda request: httpx.Response(
                        200,
                        json={"message": {"content": content}},
                    )
                )
                response = await LiveOllamaProvider(
                    make_config(),
                    transport=transport,
                ).generate(make_request())
                self.assertEqual(response.status, "empty")
                self.assertEqual(response.error_code, "empty_model_response")
                self.assertEqual(response.content, "")

    async def test_invalid_json_is_structured(self) -> None:
        transport = httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                content=b"{not-json",
                headers={"content-type": "application/json"},
            )
        )
        response = await LiveOllamaProvider(
            make_config(),
            transport=transport,
        ).generate(make_request())
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "invalid_json_response")
        self.assertEqual(response.content, "")

    async def test_invalid_response_schemas_are_structured(self) -> None:
        invalid_payloads = (
            [],
            {},
            {"message": []},
            {"message": {}},
            {"message": {"content": ["not", "text"]}},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                transport = httpx.MockTransport(
                    lambda request, value=payload: httpx.Response(200, json=value)
                )
                response = await LiveOllamaProvider(
                    make_config(),
                    transport=transport,
                ).generate(make_request())
                self.assertEqual(response.status, "failed")
                self.assertEqual(response.error_code, "invalid_response_schema")
                self.assertEqual(response.content, "")

    async def test_http_404_is_structured(self) -> None:
        response = await LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(
                lambda request: httpx.Response(404, json={"error": "missing"})
            ),
        ).generate(make_request())
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "http_404")
        self.assertNotIn("missing", response.error_message or "")

    async def test_http_500_is_structured(self) -> None:
        response = await LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(
                lambda request: httpx.Response(500, json={"error": "private detail"})
            ),
        ).generate(make_request())
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "http_500")
        self.assertNotIn("private detail", response.error_message or "")

    async def test_timeout_is_structured(self) -> None:
        def timeout(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("private timeout detail", request=request)

        response = await LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(timeout),
        ).generate(make_request())
        self.assertEqual(response.status, "timeout")
        self.assertEqual(response.error_code, "provider_timeout")
        self.assertNotIn("private", response.error_message or "")

    async def test_connection_error_is_structured(self) -> None:
        def unavailable(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("private connection detail", request=request)

        response = await LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(unavailable),
        ).generate(make_request())
        self.assertEqual(response.status, "unavailable")
        self.assertEqual(response.error_code, "provider_connection_failed")
        self.assertNotIn("private", response.error_message or "")

    async def test_non_loopback_url_is_rejected_before_transport(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(200, json={"message": {"content": "unsafe"}})

        response = await LiveOllamaProvider(
            make_config(base_url="http://example.com:11434"),
            transport=httpx.MockTransport(handler),
        ).generate(make_request())
        self.assertEqual(calls, 0)
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "invalid_ollama_base_url")
        self.assertNotIn("example.com", response.error_message or "")

    async def test_disabled_provider_does_not_open_transport(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            raise AssertionError("transport must not run")

        response = await LiveOllamaProvider(
            make_config(enabled=False),
            transport=httpx.MockTransport(handler),
        ).generate(make_request())
        self.assertEqual(calls, 0)
        self.assertEqual(response.status, "unavailable")
        self.assertEqual(response.error_code, "provider_not_enabled")

    async def test_mock_mode_does_not_open_transport(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            raise AssertionError("transport must not run")

        response = await LiveOllamaProvider(
            make_config(mode="mock"),
            transport=httpx.MockTransport(handler),
        ).generate(make_request())
        self.assertEqual(calls, 0)
        self.assertEqual(response.status, "mock")
        self.assertTrue(response.is_mock)

    async def test_live_mode_without_model_does_not_open_transport(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            raise AssertionError("transport must not run")

        response = await LiveOllamaProvider(
            make_config(model=None),
            transport=httpx.MockTransport(handler),
        ).generate(make_request())
        self.assertEqual(calls, 0)
        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error_code, "model_not_configured")

    async def test_oversized_content_is_blocked(self) -> None:
        content = "x" * (MAX_MODEL_RESPONSE_CHARS + 1)
        response = await LiveOllamaProvider(
            make_config(),
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json={"message": {"content": content}},
                )
            ),
        ).generate(make_request())
        self.assertEqual(response.status, "blocked")
        self.assertEqual(response.error_code, "response_too_large")
        self.assertEqual(response.content, "")


class LocalProviderUrlValidationTests(unittest.TestCase):
    def test_explicit_loopback_urls_are_allowed(self) -> None:
        allowed = (
            "http://127.0.0.1:11434",
            "http://localhost:11434/",
            "http://[::1]:11434",
        )
        for url in allowed:
            with self.subTest(url=url):
                self.assertEqual(
                    validate_local_provider_url(url, provider="ollama"),
                    url.rstrip("/"),
                )

    def test_non_loopback_and_credential_urls_are_rejected(self) -> None:
        forbidden = (
            "http://0.0.0.0:11434",
            "http://192.168.1.10:11434",
            "http://10.0.0.10:11434",
            "http://172.16.0.10:11434",
            "http://172.31.255.254:11434",
            "http://example.com:11434",
            "https://localhost:11434",
            "file:///tmp/ollama.sock",
            "data:text/plain,ollama",
            "javascript:alert(1)",
            "ftp://localhost/model",
            "http://user:password@localhost:11434",
            "http://localhost:11434?token=secret",
        )
        for url in forbidden:
            with self.subTest(url=url):
                with self.assertRaisesRegex(ValueError, "invalid_ollama_base_url"):
                    validate_local_provider_url(url, provider="ollama")

    def test_invalid_url_becomes_safe_configuration_error(self) -> None:
        config = LocalLlmConfig.from_env(
            {
                "LOCAL_LLM_MODE": "live",
                "LOCAL_LLM_MODEL": MODEL,
                "OLLAMA_ENABLED": "true",
                "OLLAMA_BASE_URL": "http://user:private@example.com:11434",
            }
        )
        self.assertIn("invalid_ollama_base_url", config.configuration_errors)
        self.assertEqual(config.ollama.base_url, "http://127.0.0.1:11434")
        self.assertNotIn("private", " ".join(config.configuration_errors))

    def test_all_three_local_provider_urls_use_the_same_loopback_policy(self) -> None:
        valid = LocalLlmConfig.from_env(
            {
                "OLLAMA_BASE_URL": "http://localhost:11434",
                "LM_STUDIO_BASE_URL": "http://[::1]:1234/v1",
                "LOCALAI_BASE_URL": "http://127.0.0.1:8080/v1",
            }
        )
        self.assertEqual(valid.configuration_errors, ())

        invalid = LocalLlmConfig.from_env(
            {
                "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
                "LM_STUDIO_BASE_URL": "http://192.168.1.5:1234/v1",
                "LOCALAI_BASE_URL": "https://example.com/v1",
            }
        )
        self.assertIn("invalid_lm_studio_base_url", invalid.configuration_errors)
        self.assertIn("invalid_localai_base_url", invalid.configuration_errors)
        self.assertFalse(invalid.lmstudio.enabled)
        self.assertFalse(invalid.localai.enabled)

    def test_live_public_ask_requires_explicit_model(self) -> None:
        config = LocalLlmConfig.from_env(
            {
                "LOCAL_LLM_MODE": "live",
                "LOCAL_LLM_ASK_ENABLED": "true",
                "LOCAL_LLM_PROVIDER": "ollama",
                "LOCAL_LLM_MODEL": "   ",
                "OLLAMA_ENABLED": "true",
            }
        )
        self.assertIn("missing_ollama_model_for_ask", config.configuration_errors)

    def test_default_provider_flags_remain_disabled(self) -> None:
        config = LocalLlmConfig.from_env({})
        self.assertEqual(config.mode, "mock")
        self.assertEqual(config.strategy, "fallback")
        self.assertEqual(config.providers, ("ollama", "lmstudio", "localai"))
        self.assertEqual(config.provider, "ollama")
        self.assertIsNone(config.model)
        self.assertEqual(config.timeout_seconds, 45)
        self.assertEqual(config.max_tokens, 500)
        self.assertEqual(config.temperature, 0.2)
        self.assertFalse(config.preview_enabled)
        self.assertFalse(config.ask_enabled)
        self.assertFalse(config.ollama.enabled)
        self.assertEqual(config.ollama.base_url, "http://127.0.0.1:11434")
        self.assertFalse(config.lmstudio.enabled)
        self.assertFalse(config.localai.enabled)
        self.assertEqual(config.configuration_errors, ())


if __name__ == "__main__":
    unittest.main()
