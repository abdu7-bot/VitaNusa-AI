from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import cast

from .base import LlmProvider
from .config import (
    SUPPORTED_MODES,
    SUPPORTED_STRATEGIES,
    LocalLlmConfig,
)
from .guard import (
    LlmGuardContext,
    build_blocked_router_response,
    evaluate_llm_guard,
    validate_llm_response,
)
from .models import (
    LlmMode,
    LlmRequest,
    LlmResponse,
    LlmRouterResponse,
    LlmStrategy,
)
from .http_providers import (
    LiveLMStudioProvider,
    LiveLocalAIProvider,
    LiveOllamaProvider,
)


USABLE_STATUSES = frozenset({"success", "mock"})


class LocalLlmRouter:
    def __init__(
        self,
        config: LocalLlmConfig | None = None,
        providers: Mapping[str, LlmProvider] | None = None,
    ) -> None:
        self.config = config or LocalLlmConfig.from_env()
        self.providers: dict[str, LlmProvider] = (
            dict(providers) if providers is not None else self._default_providers()
        )

    def _default_providers(self) -> dict[str, LlmProvider]:
        return {
            "ollama": LiveOllamaProvider(self.config),
            "lmstudio": LiveLMStudioProvider(self.config),
            "localai": LiveLocalAIProvider(self.config),
        }

    async def route(
        self,
        request: LlmRequest,
        *,
        provider: str | None = None,
        strategy: str | None = None,
        guard_context: LlmGuardContext | None = None,
    ) -> LlmRouterResponse:
        mode = self._safe_mode()
        selected_strategy = self._safe_strategy(strategy)

        if guard_context is not None:
            guard = evaluate_llm_guard(guard_context, request)
            if not guard.allowed:
                return build_blocked_router_response(
                    mode=mode,
                    strategy=selected_strategy,
                    provider=provider or self.config.provider or "local-llm",
                    reason=guard.reason or "llm_guard_blocked",
                )

        if self.config.mode not in SUPPORTED_MODES:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                provider=provider,
                error_code="unsupported_local_llm_mode",
            )

        if strategy is not None and strategy not in SUPPORTED_STRATEGIES:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                provider=provider,
                error_code="unsupported_local_llm_strategy",
            )

        if mode == "disabled":
            return LlmRouterResponse(
                mode=mode,
                strategy=selected_strategy,
                response=LlmResponse(
                    provider=provider or self.config.provider or "local-llm",
                    model=request.model or self.config.model,
                    status="disabled",
                    error_code="local_llm_disabled",
                    error_message="Local LLM dinonaktifkan.",
                ),
            )

        if self.config.configuration_errors:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                provider=provider,
                error_code="invalid_local_llm_configuration",
            )

        explicit_provider = provider.strip().lower() if provider else None
        if explicit_provider and explicit_provider not in self.providers:
            return self._unknown_provider_response(
                mode=mode,
                strategy=selected_strategy,
                provider=explicit_provider,
            )

        provider_order = self._provider_order(
            strategy=selected_strategy,
            provider=explicit_provider,
        )
        if not provider_order:
            return self._configuration_failure(
                mode=mode,
                strategy=selected_strategy,
                provider=explicit_provider,
                error_code="no_local_llm_providers",
                all_providers_failed=True,
            )

        attempted: list[str] = []
        failed: list[str] = []
        last_response: LlmResponse | None = None

        for index, provider_name in enumerate(provider_order):
            adapter = self.providers.get(provider_name)
            if adapter is None:
                failed.append(provider_name)
                last_response = LlmResponse(
                    provider=provider_name,
                    model=request.model or self.config.model,
                    status="failed",
                    error_code="unknown_provider",
                    error_message="Provider Local LLM tidak dikenal.",
                )
                continue

            attempted.append(provider_name)
            response = await self._call_provider(
                provider_name=provider_name,
                adapter=adapter,
                request=request,
            )
            if response.provider != provider_name:
                response = LlmResponse(
                    provider=provider_name,
                    model=request.model or self.config.model,
                    status="failed",
                    error_code="provider_identity_mismatch",
                    error_message="Provider mengembalikan identitas yang tidak sesuai.",
                )

            response = validate_llm_response(
                response,
                prohibited_actions=(
                    guard_context.prohibited_actions if guard_context else ()
                ),
            )
            last_response = response

            if response.status in USABLE_STATUSES and response.content.strip():
                return LlmRouterResponse(
                    mode=mode,
                    strategy=selected_strategy,
                    selected_provider=provider_name,
                    attempted_providers=attempted,
                    failed_providers=failed,
                    response=response,
                    fallback_used=(selected_strategy == "fallback" and index > 0),
                )

            failed.append(provider_name)

        return LlmRouterResponse(
            mode=mode,
            strategy=selected_strategy,
            attempted_providers=attempted,
            failed_providers=list(dict.fromkeys(failed)),
            response=last_response,
            fallback_used=(selected_strategy == "fallback" and len(provider_order) > 1),
            all_providers_failed=True,
        )

    async def _call_provider(
        self,
        *,
        provider_name: str,
        adapter: LlmProvider,
        request: LlmRequest,
    ) -> LlmResponse:
        try:
            response = await asyncio.wait_for(
                adapter.generate(request),
                timeout=self.config.timeout_seconds,
            )
        except TimeoutError:
            return LlmResponse(
                provider=provider_name,
                model=request.model or self.config.model,
                status="timeout",
                error_code="provider_timeout",
                error_message="Batas waktu provider Local LLM tercapai.",
            )
        except Exception:
            return LlmResponse(
                provider=provider_name,
                model=request.model or self.config.model,
                status="failed",
                error_code="provider_failed",
                error_message="Provider Local LLM gagal secara terkontrol.",
            )

        if not isinstance(response, LlmResponse):
            return LlmResponse(
                provider=provider_name,
                model=request.model or self.config.model,
                status="failed",
                error_code="invalid_provider_response",
                error_message="Provider mengembalikan respons yang tidak valid.",
            )
        return response

    def _provider_order(
        self,
        *,
        strategy: LlmStrategy,
        provider: str | None,
    ) -> tuple[str, ...]:
        if strategy == "priority":
            primary = provider or self.config.provider
            return (primary,) if primary else ()

        configured = list(dict.fromkeys(self.config.providers))
        if provider:
            configured = [provider] + [name for name in configured if name != provider]
        return tuple(configured)

    def _safe_mode(self) -> LlmMode:
        if self.config.mode in SUPPORTED_MODES:
            return cast(LlmMode, self.config.mode)
        return "disabled"

    def _safe_strategy(self, strategy: str | None) -> LlmStrategy:
        candidate = strategy or self.config.strategy
        if candidate in SUPPORTED_STRATEGIES:
            return cast(LlmStrategy, candidate)
        return "priority"

    def _configuration_failure(
        self,
        *,
        mode: LlmMode,
        strategy: LlmStrategy,
        provider: str | None,
        error_code: str,
        all_providers_failed: bool = False,
    ) -> LlmRouterResponse:
        return LlmRouterResponse(
            mode=mode,
            strategy=strategy,
            failed_providers=([provider] if provider else []),
            response=LlmResponse(
                provider=provider or self.config.provider or "local-llm",
                model=self.config.model,
                status="failed",
                error_code=error_code,
                error_message="Konfigurasi Local LLM tidak dapat digunakan.",
            ),
            all_providers_failed=all_providers_failed,
        )

    def _unknown_provider_response(
        self,
        *,
        mode: LlmMode,
        strategy: LlmStrategy,
        provider: str,
    ) -> LlmRouterResponse:
        return LlmRouterResponse(
            mode=mode,
            strategy=strategy,
            failed_providers=[provider],
            response=LlmResponse(
                provider=provider,
                model=self.config.model,
                status="failed",
                error_code="unknown_provider",
                error_message="Provider Local LLM tidak dikenal.",
            ),
            all_providers_failed=True,
        )
