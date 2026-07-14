from __future__ import annotations

import asyncio
import os
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.llm.config import LocalLlmConfig
from app.llm.models import LlmRequest, LlmResponse, LlmRouterResponse
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


LIVE_ASK_ENV = {
    "LOCAL_LLM_MODE": "live",
    "LOCAL_LLM_ASK_ENABLED": "true",
    "LOCAL_LLM_PROVIDER": "ollama",
    "LOCAL_LLM_PROVIDERS": "ollama,lmstudio,localai",
    "LOCAL_LLM_MODEL": "gemma3:1b",
    "OLLAMA_ENABLED": "true",
    "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
    "LM_STUDIO_ENABLED": "false",
    "LOCALAI_ENABLED": "false",
}


def routed_response(
    *,
    status: str,
    content: str = "",
    error_code: str | None = None,
) -> LlmRouterResponse:
    return LlmRouterResponse(
        mode="live",
        strategy="priority",
        selected_provider="ollama" if status == "success" else None,
        attempted_providers=["ollama"],
        failed_providers=[] if status == "success" else ["ollama"],
        response=LlmResponse(
            provider="ollama",
            model="gemma3:1b",
            content=content,
            status=status,
            error_code=error_code,
        ),
        all_providers_failed=(status != "success"),
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
        # No provider is enabled (OLLAMA_ENABLED/LM_STUDIO_ENABLED/LOCALAI_ENABLED
        # all default to false), so live mode must fail closed without ever
        # silently returning mock/simulated content.
        config = replace(LocalLlmConfig(), mode="live")
        result = await LocalLlmRouter(config).route(make_request())
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.status, "unavailable")
        self.assertEqual(result.response.error_code, "provider_not_enabled")
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

    async def test_preview_is_404_in_production_even_when_enabled(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "LOCAL_LLM_PREVIEW_ENABLED": "true",
            },
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

    async def test_preview_live_disabled_provider_is_not_mock(self) -> None:
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
        # Live provider adapters are implemented, but no provider is enabled
        # in this environment (OLLAMA_ENABLED=false by default), so this must
        # fail closed rather than ever silently return mock/simulated content.
        self.assertTrue(result.all_providers_failed)
        self.assertEqual(result.response.status, "unavailable")
        self.assertEqual(result.response.error_code, "provider_not_enabled")
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


class AskRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_ask_answer_is_unchanged_in_disabled_and_mock_modes(self) -> None:
        request = AskRequest(question="Apa itu VitaCheck?")
        with patch.dict(os.environ, {"LOCAL_LLM_MODE": "disabled"}, clear=False):
            disabled = await ask_ai(request)
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_MOCK_SCENARIO": "success",
                # ask_enabled defaults to false, so /ask must ignore LLM
                # entirely here regardless of mode/scenario.
            },
            clear=False,
        ):
            mocked = await ask_ai(request)

        self.assertEqual(disabled.answer, mocked.answer)
        self.assertEqual(disabled.sources, mocked.sources)
        self.assertNotIn("respons simulasi local llm", mocked.answer.casefold())
        self.assertEqual(mocked.sources, [])
        self.assertIsNotNone(mocked.policyDecision)

    async def test_mock_mode_never_replaces_public_ask(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LOCAL_LLM_MODE": "mock",
                "LOCAL_LLM_ASK_ENABLED": "true",
                "LOCAL_LLM_MOCK_SCENARIO": "success",
            },
            clear=False,
        ), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)
        self.assertEqual(response.sources, [])

    async def test_live_ask_flag_disabled_does_not_call_router(self) -> None:
        environment = {**LIVE_ASK_ENV, "LOCAL_LLM_ASK_ENABLED": "false"}
        with patch.dict(os.environ, environment, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)

    async def test_live_non_ollama_primary_does_not_call_router(self) -> None:
        environment = {**LIVE_ASK_ENV, "LOCAL_LLM_PROVIDER": "lmstudio"}
        with patch.dict(os.environ, environment, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)

    async def test_invalid_ollama_url_falls_back_without_router(self) -> None:
        environment = {
            **LIVE_ASK_ENV,
            "OLLAMA_BASE_URL": "http://user:secret@example.com:11434",
        }
        with patch.dict(os.environ, environment, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)
        self.assertNotIn("secret", response.answer)

    async def test_live_provider_disabled_falls_back_without_router(self) -> None:
        environment = {**LIVE_ASK_ENV, "OLLAMA_ENABLED": "false"}
        with patch.dict(os.environ, environment, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)

    async def test_live_model_missing_falls_back_without_router(self) -> None:
        environment = {**LIVE_ASK_ENV, "LOCAL_LLM_MODEL": "   "}
        with patch.dict(os.environ, environment, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=AsyncMock(side_effect=AssertionError("router must not run")),
        ) as route:
            response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        route.assert_not_awaited()
        self.assertIn("VitaCheck adalah", response.answer)

    async def test_live_failures_always_fall_back_to_rule_based_answer(self) -> None:
        failures = (
            ("unavailable", "provider_connection_failed"),
            ("timeout", "provider_timeout"),
            ("empty", "empty_model_response"),
            ("blocked", "response_validation_blocked"),
            ("failed", "http_500"),
        )
        for status, error_code in failures:
            with self.subTest(status=status), patch.dict(
                os.environ,
                LIVE_ASK_ENV,
                clear=False,
            ), patch(
                "app.main.LocalLlmRouter.route",
                new=AsyncMock(
                    return_value=routed_response(
                        status=status,
                        content="",
                        error_code=error_code,
                    )
                ),
            ):
                response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
            self.assertIn("VitaCheck adalah", response.answer)
            self.assertEqual(response.sources, [])
            self.assertIsNotNone(response.policyDecision)
            self.assertIsNotNone(response.recommendedAction)

    async def test_live_success_can_rephrase_without_changing_contract(self) -> None:
        request = AskRequest(question="Apa itu VitaCheck?")
        with patch.dict(
            os.environ,
            {**LIVE_ASK_ENV, "LOCAL_LLM_ASK_ENABLED": "false"},
            clear=False,
        ):
            baseline = await ask_ai(request)

        model_answer = (
            "VitaCheck membantu refleksi kebiasaan sehat dan bukan alat diagnosis."
        )
        route = AsyncMock(
            return_value=routed_response(status="success", content=model_answer)
        )
        with patch.dict(os.environ, LIVE_ASK_ENV, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=route,
        ):
            response = await ask_ai(request)

        self.assertEqual(response.answer, model_answer)
        self.assertEqual(response.sources, [])
        self.assertEqual(response.recommendedAction, baseline.recommendedAction)
        self.assertEqual(response.policyDecision, baseline.policyDecision)
        route.assert_awaited_once()
        self.assertEqual(route.await_args.kwargs["provider"], "ollama")
        self.assertEqual(route.await_args.kwargs["strategy"], "priority")

    async def test_emergency_questions_never_call_ollama_generate(self) -> None:
        questions = (
            "Saya sesak berat dan nyeri dada.",
            "Saya tiba-tiba lemah separuh tubuh.",
            "Saya pingsan.",
            "Saya mengalami perdarahan hebat.",
            "Saya ingin menyakiti diri sendiri.",
        )
        generate = AsyncMock(side_effect=AssertionError("Ollama must not run"))
        with patch.dict(os.environ, LIVE_ASK_ENV, clear=False), patch(
            "app.llm.http_providers.LiveOllamaProvider.generate",
            new=generate,
        ):
            for question in questions:
                with self.subTest(question=question):
                    response = await ask_ai(AskRequest(question=question))
                    self.assertEqual(response.safetyLevel, "emergency")
                    self.assertEqual(
                        response.policyDecision.dominantPolicy,
                        "medical_safety",
                    )
        generate.assert_not_awaited()

    async def test_medication_request_keeps_policy_boundary(self) -> None:
        response = await ask_ai(
            AskRequest(question="Berikan dosis obat resep untuk saya.")
        )
        self.assertIn("tidak dapat memberikan dosis", response.answer.casefold())
        self.assertTrue(response.policyDecision.responseBlocked)
        self.assertIn(
            "give_personal_dose",
            response.policyDecision.prohibitedActions,
        )

    async def test_medication_prompts_cannot_use_unsafe_model_output(self) -> None:
        cases = (
            (
                "Berikan dosis obat resep untuk saya.",
                "Minum obat resep ini sebanyak tiga tablet.",
            ),
            (
                "Bolehkah saya menghentikan obat dokter?",
                "Hentikan obat dokter mulai sekarang.",
            ),
            (
                "Naikkan dosis obat saya agar lebih cepat sembuh.",
                "Minum obat resep ini sebanyak tiga tablet.",
            ),
        )
        with patch.dict(os.environ, LIVE_ASK_ENV, clear=False):
            for question, unsafe_output in cases:
                with self.subTest(question=question), patch(
                    "app.llm.http_providers.LiveOllamaProvider.generate",
                    new=AsyncMock(
                        return_value=LlmResponse(
                            provider="ollama",
                            model="gemma3:1b",
                            status="success",
                            content=unsafe_output,
                        )
                    ),
                ):
                    response = await ask_ai(AskRequest(question=question))
                self.assertNotEqual(response.answer, unsafe_output)
                self.assertNotIn("tiga tablet", response.answer.casefold())
                self.assertIsNotNone(response.recommendedAction)
                self.assertIsNotNone(response.policyDecision)

    async def test_product_claims_cannot_use_invented_model_facts(self) -> None:
        cases = (
            (
                "Apakah produk ini pasti menyembuhkan diabetes?",
                "Produk ini pasti menyembuhkan diabetes.",
            ),
            ("Apakah produk ini pasti halal?", "Produk ini pasti halal."),
            (
                "Apakah produk ini sudah BPOM?",
                "Produk ini sudah pasti terdaftar BPOM.",
            ),
        )
        with patch.dict(os.environ, LIVE_ASK_ENV, clear=False):
            for question, unsafe_output in cases:
                with self.subTest(question=question), patch(
                    "app.llm.http_providers.LiveOllamaProvider.generate",
                    new=AsyncMock(
                        return_value=LlmResponse(
                            provider="ollama",
                            model="gemma3:1b",
                            status="success",
                            content=unsafe_output,
                        )
                    ),
                ):
                    response = await ask_ai(AskRequest(question=question))
                self.assertNotEqual(response.answer, unsafe_output)
                self.assertEqual(response.sources, [])
                self.assertIsNotNone(response.policyDecision)

    async def test_blocked_model_output_is_not_saved_to_conversation_memory(self) -> None:
        from app.conversation_memory import CONVERSATION_MEMORY

        session_id = "blocked-model-memory-test"
        unsafe_output = "Produk ini pasti menyembuhkan diabetes."
        route = AsyncMock(
            return_value=routed_response(
                status="blocked",
                content=unsafe_output,
                error_code="response_validation_blocked",
            )
        )
        with patch.dict(os.environ, LIVE_ASK_ENV, clear=False), patch(
            "app.main.LocalLlmRouter.route",
            new=route,
        ):
            response = await ask_ai(
                AskRequest(question="Apa itu VitaCheck?", sessionId=session_id)
            )

        history = CONVERSATION_MEMORY.get_history(session_id)
        self.assertTrue(history)
        self.assertEqual(history[-1].answer, response.answer[:400])
        self.assertNotIn(unsafe_output, history[-1].answer)

    async def test_ask_falls_back_to_rule_template_when_llm_disabled(self) -> None:
        # Default env (no LOCAL_LLM_ASK_ENABLED) must behave exactly like the
        # pure rule-based app — this is the "if Local LLM is inactive, fall
        # back to the safe rule-based template" requirement.
        response = await ask_ai(AskRequest(question="Apa itu VitaCheck?"))
        self.assertIn("VitaCheck adalah", response.answer)


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
