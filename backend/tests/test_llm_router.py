from __future__ import annotations

import asyncio
import os
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.llm.config import LocalLlmConfig
from app.llm.models import LlmRequest, LlmResponse
from app.llm.router import LocalLlmRouter
from app.main import ask_ai, llm_preview
from app.schemas import AskRequest, LlmPreviewRequest


def make_request() -> LlmRequest:
    return LlmRequest(
        system_prompt="Berikan edukasi umum dan patuhi policy aplikasi.",
        user_message="Jelaskan VitaCheck secara singkat.",
        intent="vitacheck",
        safety_level="low",
    )


class StubProvider:
    def __init__(
        self,
        name: str,
        response: LlmResponse | None = None,
        error: Exception | None = None,
    ) -> None:
        self.name = name
        self.response = response
        self.error = error
        self.calls = 0

    async def generate(self, request: LlmRequest) -> LlmResponse:
        self.calls += 1
        if self.error:
            raise self.error
        if self.response is None:
            raise AssertionError("stub response is required")
        return self.response


class HangingProvider:
    name = "ollama"

    def __init__(self) -> None:
        self.calls = 0

    async def generate(self, request: LlmRequest) -> LlmResponse:
        self.calls += 1
        await asyncio.Event().wait()
        raise AssertionError("unreachable")


def failed(name: str) -> LlmResponse:
    return LlmResponse(provider=name, status="failed", error_code="simulated")


def success(name: str) -> LlmResponse:
    return LlmResponse(
        provider=name,
        status="mock",
        is_mock=True,
        content="Respons simulasi edukatif yang aman untuk pengujian router.",
    )


class LocalLlmRouterTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_mode_does_not_run_provider(self) -> None:
        provider = StubProvider("ollama", success("ollama"))
        config = replace(LocalLlmConfig(), mode="disabled", strategy="priority")
        result = await LocalLlmRouter(config, {"ollama": provider}).route(make_request())

        self.assertEqual(result.response.status, "disabled")
        self.assertEqual(result.attempted_providers, [])
        self.assertEqual(provider.calls, 0)

    async def test_mock_fallback_stops_after_ollama_success(self) -> None:
        result = await LocalLlmRouter(LocalLlmConfig()).route(make_request())
        self.assertEqual(result.selected_provider, "ollama")
        self.assertEqual(result.attempted_providers, ["ollama"])
        self.assertFalse(result.fallback_used)
        self.assertTrue(result.response.is_mock)

    async def test_priority_uses_only_primary_provider(self) -> None:
        config = replace(
            LocalLlmConfig(),
            strategy="priority",
            mock_scenario="partial_failure",
        )
        result = await LocalLlmRouter(config).route(make_request())

        self.assertEqual(result.attempted_providers, ["ollama"])
        self.assertEqual(result.failed_providers, ["ollama"])
        self.assertTrue(result.all_providers_failed)
        self.assertFalse(result.fallback_used)

    async def test_partial_failure_falls_back_to_lmstudio(self) -> None:
        config = replace(LocalLlmConfig(), mock_scenario="partial_failure")
        result = await LocalLlmRouter(config).route(make_request())

        self.assertEqual(result.attempted_providers, ["ollama", "lmstudio"])
        self.assertEqual(result.failed_providers, ["ollama"])
        self.assertEqual(result.selected_provider, "lmstudio")
        self.assertTrue(result.fallback_used)

    async def test_two_failures_fall_back_to_localai(self) -> None:
        providers = {
            "ollama": StubProvider("ollama", failed("ollama")),
            "lmstudio": StubProvider("lmstudio", failed("lmstudio")),
            "localai": StubProvider("localai", success("localai")),
        }
        result = await LocalLlmRouter(LocalLlmConfig(), providers).route(make_request())

        self.assertEqual(
            result.attempted_providers,
            ["ollama", "lmstudio", "localai"],
        )
        self.assertEqual(result.failed_providers, ["ollama", "lmstudio"])
        self.assertEqual(result.selected_provider, "localai")
        self.assertTrue(result.fallback_used)

    async def test_all_failed_is_structured(self) -> None:
        config = replace(LocalLlmConfig(), mock_scenario="all_failed")
        result = await LocalLlmRouter(config).route(make_request())

        self.assertTrue(result.all_providers_failed)
        self.assertEqual(
            result.attempted_providers,
            ["ollama", "lmstudio", "localai"],
        )
        self.assertEqual(result.selected_provider, None)
        self.assertEqual(result.response.content, "")

    async def test_unknown_provider_does_not_raise(self) -> None:
        result = await LocalLlmRouter(LocalLlmConfig()).route(
            make_request(),
            provider="unknown",
        )
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.failed_providers, ["unknown"])
        self.assertEqual(result.response.error_code, "unknown_provider")

    async def test_empty_provider_list_does_not_raise(self) -> None:
        config = replace(LocalLlmConfig(), providers=())
        result = await LocalLlmRouter(config).route(make_request())
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.attempted_providers, [])
        self.assertEqual(result.response.error_code, "no_local_llm_providers")

    async def test_empty_provider_response_triggers_fallback(self) -> None:
        config = replace(LocalLlmConfig(), mock_scenario="empty")
        result = await LocalLlmRouter(config).route(make_request())
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.status, "empty")
        self.assertEqual(len(result.failed_providers), 3)

    async def test_simulated_timeout_returns_without_long_wait(self) -> None:
        config = replace(
            LocalLlmConfig(),
            strategy="priority",
            mock_scenario="timeout",
        )
        result = await LocalLlmRouter(config).route(make_request())
        self.assertEqual(result.response.status, "timeout")
        self.assertTrue(result.all_providers_failed)

    async def test_simulated_unavailable_provider_is_structured(self) -> None:
        config = replace(
            LocalLlmConfig(),
            strategy="priority",
            mock_scenario="provider_unavailable",
        )
        result = await LocalLlmRouter(config).route(make_request())
        self.assertEqual(result.response.status, "unavailable")
        self.assertEqual(result.response.error_code, "mock_provider_unavailable")
        self.assertTrue(result.response.is_mock)
        self.assertTrue(result.all_providers_failed)

    async def test_logical_timeout_catches_a_nonresponsive_provider(self) -> None:
        provider = HangingProvider()
        config = replace(
            LocalLlmConfig(),
            strategy="priority",
            providers=("ollama",),
            timeout_seconds=0.01,
        )
        result = await LocalLlmRouter(config, {"ollama": provider}).route(make_request())
        self.assertEqual(provider.calls, 1)
        self.assertEqual(result.response.status, "timeout")
        self.assertEqual(result.response.error_code, "provider_timeout")

    async def test_provider_exception_is_not_unhandled(self) -> None:
        provider = StubProvider("ollama", error=RuntimeError("private detail"))
        config = replace(
            LocalLlmConfig(),
            strategy="priority",
            providers=("ollama",),
        )
        result = await LocalLlmRouter(config, {"ollama": provider}).route(make_request())
        self.assertEqual(result.response.status, "failed")
        self.assertEqual(result.response.error_code, "provider_failed")
        self.assertNotIn("private detail", result.response.error_message or "")

    async def test_live_mode_never_falls_back_to_mock(self) -> None:
        config = replace(LocalLlmConfig(), mode="live")
        result = await LocalLlmRouter(config).route(make_request())
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.status, "not_implemented")
        self.assertFalse(result.response.is_mock)
        self.assertTrue(all(name in result.failed_providers for name in config.providers))


class LlmPreviewEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_is_404_when_disabled(self) -> None:
        with patch.dict(
            os.environ,
            {"LOCAL_LLM_PREVIEW_ENABLED": "false"},
            clear=False,
        ):
            with self.assertRaises(HTTPException) as raised:
                await llm_preview(LlmPreviewRequest(message="Jelaskan VitaCheck."))
        self.assertEqual(raised.exception.status_code, 404)

    async def test_preview_mock_returns_structured_response(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
                "LOCAL_LLM_STRATEGY": "fallback",
                "LOCAL_LLM_MOCK_SCENARIO": "success",
            },
            clear=False,
        ):
            result = await llm_preview(
                LlmPreviewRequest(
                    message="Jelaskan VitaCheck secara singkat.",
                    provider="ollama",
                    strategy="fallback",
                )
            )
        self.assertEqual(result.mode, "mock")
        self.assertEqual(result.selected_provider, "ollama")
        self.assertEqual(result.attempted_providers, ["ollama"])
        self.assertTrue(result.response.is_mock)

    async def test_preview_partial_failure_uses_fallback(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
                "LOCAL_LLM_MOCK_SCENARIO": "partial_failure",
            },
            clear=False,
        ):
            result = await llm_preview(
                LlmPreviewRequest(message="Jelaskan VitaCheck.")
            )
        self.assertEqual(result.selected_provider, "lmstudio")
        self.assertTrue(result.fallback_used)

    async def test_preview_live_is_not_implemented_and_not_mock(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "live",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ):
            result = await llm_preview(
                LlmPreviewRequest(
                    message="Jelaskan VitaCheck.",
                    provider="ollama",
                    strategy="priority",
                )
            )
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.status, "not_implemented")
        self.assertFalse(result.response.is_mock)

    async def test_preview_all_failed_is_not_an_exception(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
                "LOCAL_LLM_MOCK_SCENARIO": "all_failed",
            },
            clear=False,
        ):
            result = await llm_preview(
                LlmPreviewRequest(message="Jelaskan VitaCheck.")
            )
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.content, "")

    async def test_emergency_preview_does_not_call_router(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
            },
            clear=False,
        ), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not be called")),
        ) as route:
            result = await llm_preview(
                LlmPreviewRequest(message="Saya sesak berat dan nyeri dada.")
            )
        route.assert_not_awaited()
        self.assertEqual(result.response.status, "blocked")
        self.assertEqual(result.attempted_providers, [])


class AskRegressionTests(unittest.TestCase):
    def test_ask_answer_is_unchanged_in_disabled_and_mock_modes(self) -> None:
        request = AskRequest(question="Apa itu VitaCheck?")
        with patch.dict(os.environ, {"LOCAL_LLM_MODE": "disabled"}, clear=False):
            disabled = ask_ai(request)
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_MOCK_SCENARIO": "success",
            },
            clear=False,
        ):
            mocked = ask_ai(request)

        self.assertEqual(disabled.answer, mocked.answer)
        self.assertEqual(disabled.sources, mocked.sources)
        self.assertNotIn("respons simulasi local llm", mocked.answer.casefold())
        self.assertEqual(mocked.sources, [])
        self.assertIsNotNone(mocked.policyDecision)

    def test_emergency_ask_never_calls_local_llm(self) -> None:
        with patch(
            "app.llm.router.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("LLM must not be called")),
        ) as route:
            response = ask_ai(
                AskRequest(question="Saya sesak berat dan nyeri dada.")
            )
        route.assert_not_awaited()
        self.assertEqual(response.safetyLevel, "emergency")
        self.assertEqual(response.policyDecision.dominantPolicy, "medical_safety")

    def test_medication_request_keeps_policy_boundary(self) -> None:
        response = ask_ai(
            AskRequest(question="Berikan dosis obat resep untuk saya.")
        )
        self.assertIn("tidak dapat memberikan dosis", response.answer.casefold())
        self.assertTrue(response.policyDecision.responseBlocked)
        self.assertIn(
            "give_personal_dose",
            response.policyDecision.prohibitedActions,
        )

    def test_all_provider_failure_cannot_break_ask(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_MOCK_SCENARIO": "all_failed",
            },
            clear=False,
        ):
            response = ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        self.assertIn("VitaCheck adalah", response.answer)
        self.assertNotIn("mock", response.answer.casefold())
        self.assertEqual(response.sources, [])


class LocalLlmConfigTests(unittest.TestCase):
    def test_environment_configuration_is_parsed_without_extra_dependency(self) -> None:
        config = LocalLlmConfig.from_env(
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_STRATEGY": "fallback",
                "LOCAL_LLM_PROVIDERS": "ollama,lmstudio,localai",
                "LOCAL_LLM_PROVIDER": "ollama",
                "LOCAL_LLM_MODEL": "operator-selected-model",
                "LOCAL_LLM_TIMEOUT_SECONDS": "12",
                "LOCAL_LLM_MAX_TOKENS": "600",
                "LOCAL_LLM_TEMPERATURE": "0.1",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
                "LOCAL_LLM_MOCK_SCENARIO": "success",
            }
        )
        self.assertEqual(config.mode, "mock")
        self.assertEqual(config.providers, ("ollama", "lmstudio", "localai"))
        self.assertEqual(config.model, "operator-selected-model")
        self.assertEqual(config.timeout_seconds, 12)
        self.assertEqual(config.max_tokens, 600)
        self.assertEqual(config.temperature, 0.1)
        self.assertTrue(config.preview_enabled)


if __name__ == "__main__":
    unittest.main()
