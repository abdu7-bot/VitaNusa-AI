"""Real network adapters for the local LLM providers.

Kept separate from `base.py`'s `DummyLocalProvider` (used for disabled/mock
modes) so that network I/O only happens when `LOCAL_LLM_MODE=live` and the
specific provider is enabled via its `*_ENABLED` env flag.
"""

from __future__ import annotations

from time import perf_counter

import httpx

from .base import DummyLocalProvider
from .config import LocalLlmConfig
from .models import LlmRequest, LlmResponse


class _LiveHttpProviderMixin:
    """Shared "call an HTTP endpoint, return a structured LlmResponse" logic."""

    name: str
    config: LocalLlmConfig
    runtime: object

    async def _live_generate(self, request: LlmRequest) -> LlmResponse:
        started = perf_counter()
        model = request.model or self.config.model or self._default_model()

        if not self.runtime.enabled:
            return LlmResponse(
                provider=self.name,
                model=model,
                status="unavailable",
                error_code="provider_not_enabled",
                error_message=f"Provider {self.name} tidak diaktifkan (set *_ENABLED=true).",
            )

        try:
            content = await self._call(request, model)
        except httpx.TimeoutException:
            return LlmResponse(
                provider=self.name,
                model=model,
                status="timeout",
                error_code="provider_timeout",
                elapsed_ms=_elapsed(started),
            )
        except httpx.HTTPStatusError as exc:
            return LlmResponse(
                provider=self.name,
                model=model,
                status="failed",
                error_code=f"http_{exc.response.status_code}",
                error_message="Provider mengembalikan status HTTP gagal.",
                elapsed_ms=_elapsed(started),
            )
        except httpx.HTTPError:
            return LlmResponse(
                provider=self.name,
                model=model,
                status="unavailable",
                error_code="provider_connection_failed",
                error_message="Tidak dapat terhubung ke provider Local LLM.",
                elapsed_ms=_elapsed(started),
            )
        except Exception:
            return LlmResponse(
                provider=self.name,
                model=model,
                status="failed",
                error_code="provider_unexpected_error",
                elapsed_ms=_elapsed(started),
            )

        return LlmResponse(
            provider=self.name,
            model=model,
            content=content,
            status="success",
            elapsed_ms=_elapsed(started),
        )

    def _default_model(self) -> str:
        return "local-model"

    async def _call(self, request: LlmRequest, model: str) -> str:
        raise NotImplementedError


def _elapsed(started: float) -> int:
    return max(0, int((perf_counter() - started) * 1000))


class LiveOllamaProvider(_LiveHttpProviderMixin, DummyLocalProvider):
    name = "ollama"

    def __init__(self, config: LocalLlmConfig | None = None) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.ollama)

    async def generate(self, request: LlmRequest) -> LlmResponse:
        if self.config.mode != "live":
            return await super().generate(request)
        return await self._live_generate(request)

    def _default_model(self) -> str:
        return "llama3"

    async def _call(self, request: LlmRequest, model: str) -> str:
        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            response = await client.post(
                f"{self.runtime.base_url.rstrip('/')}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_tokens,
                    },
                    "messages": [
                        {"role": "system", "content": request.system_prompt},
                        {"role": "user", "content": request.user_message},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            return str(payload.get("message", {}).get("content", "")).strip()


class _OpenAiCompatibleProvider(_LiveHttpProviderMixin, DummyLocalProvider):
    """LM Studio and LocalAI both expose an OpenAI-compatible chat endpoint."""

    async def generate(self, request: LlmRequest) -> LlmResponse:
        if self.config.mode != "live":
            return await super().generate(request)
        return await self._live_generate(request)

    async def _call(self, request: LlmRequest, model: str) -> str:
        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            response = await client.post(
                f"{self.runtime.base_url.rstrip('/')}/chat/completions",
                json={
                    "model": model,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "messages": [
                        {"role": "system", "content": request.system_prompt},
                        {"role": "user", "content": request.user_message},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
            choices = payload.get("choices") or []
            if not choices:
                return ""
            return str(choices[0].get("message", {}).get("content", "")).strip()


class LiveLMStudioProvider(_OpenAiCompatibleProvider):
    name = "lmstudio"

    def __init__(self, config: LocalLlmConfig | None = None) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.lmstudio)

    def _default_model(self) -> str:
        return "local-model"


class LiveLocalAIProvider(_OpenAiCompatibleProvider):
    name = "localai"

    def __init__(self, config: LocalLlmConfig | None = None) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.localai)

    def _default_model(self) -> str:
        return "local-model"
