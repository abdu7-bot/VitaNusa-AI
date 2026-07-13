from __future__ import annotations

from time import perf_counter
from typing import Protocol

from .config import LocalLlmConfig, ProviderRuntimeConfig
from .fixtures import build_mock_response
from .models import LlmRequest, LlmResponse


class LlmProvider(Protocol):
    name: str

    async def generate(self, request: LlmRequest) -> LlmResponse:
        ...


class DummyLocalProvider:
    """Shared no-network behavior for the three provider adapters."""

    name: str

    def __init__(
        self,
        config: LocalLlmConfig,
        runtime: ProviderRuntimeConfig,
    ) -> None:
        self.config = config
        self.runtime = runtime

    async def generate(self, request: LlmRequest) -> LlmResponse:
        started = perf_counter()
        model = request.model or self.config.model

        if self.config.mode == "disabled":
            response = LlmResponse(
                provider=self.name,
                model=model,
                status="disabled",
                error_code="local_llm_disabled",
                error_message="Local LLM dinonaktifkan.",
            )
        elif self.config.mode == "mock":
            response = build_mock_response(
                provider=self.name,
                model=model,
                scenario=self.config.mock_scenario,
            )
        elif self.config.mode == "live":
            response = LlmResponse(
                provider=self.name,
                model=model,
                status="not_implemented",
                error_code="live_provider_not_implemented",
                error_message=(
                    "Adapter live belum diimplementasikan dan tidak melakukan koneksi jaringan."
                ),
            )
        else:
            response = LlmResponse(
                provider=self.name,
                model=model,
                status="failed",
                error_code="unsupported_local_llm_mode",
                error_message="Mode Local LLM tidak didukung.",
            )

        elapsed_ms = max(0, int((perf_counter() - started) * 1000))
        return response.model_copy(update={"elapsed_ms": elapsed_ms})
