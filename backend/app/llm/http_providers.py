"""Real network adapters for the local LLM providers.

Kept separate from `base.py`'s `DummyLocalProvider` (used for disabled/mock
modes) so that network I/O only happens when `LOCAL_LLM_MODE=live` and the
specific provider is enabled via its `*_ENABLED` env flag.
"""

from __future__ import annotations

from time import perf_counter

import httpx

from .base import DummyLocalProvider
from .config import LocalLlmConfig, validate_local_provider_url
from .models import LlmRequest, LlmResponse


MAX_MODEL_RESPONSE_CHARS = 20_000


class _ProviderResponseError(Exception):
    def __init__(self, *, status: str, error_code: str, error_message: str) -> None:
        super().__init__(error_code)
        self.status = status
        self.error_code = error_code
        self.error_message = error_message


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

        if not model:
            return LlmResponse(
                provider=self.name,
                status="failed",
                error_code="model_not_configured",
                error_message="Model Local LLM belum dikonfigurasi.",
                elapsed_ms=_elapsed(started),
            )

        try:
            content = await self._call(request, model)
        except _ProviderResponseError as exc:
            return LlmResponse(
                provider=self.name,
                model=model,
                status=exc.status,
                error_code=exc.error_code,
                error_message=exc.error_message,
                elapsed_ms=_elapsed(started),
            )
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

    def _default_model(self) -> str | None:
        return "local-model"

    async def _call(self, request: LlmRequest, model: str) -> str:
        raise NotImplementedError


def _elapsed(started: float) -> int:
    return max(0, int((perf_counter() - started) * 1000))


class LiveOllamaProvider(_LiveHttpProviderMixin, DummyLocalProvider):
    name = "ollama"

    def __init__(
        self,
        config: LocalLlmConfig | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.ollama)
        self._transport = transport

    async def generate(self, request: LlmRequest) -> LlmResponse:
        if self.config.mode != "live":
            return await super().generate(request)
        return await self._live_generate(request)

    def _default_model(self) -> None:
        return None

    async def _call(self, request: LlmRequest, model: str) -> str:
        try:
            base_url = validate_local_provider_url(
                self.runtime.base_url,
                provider="ollama",
            )
        except ValueError as error:
            raise _ProviderResponseError(
                status="failed",
                error_code="invalid_ollama_base_url",
                error_message="URL Ollama tidak memenuhi kebijakan loopback lokal.",
            ) from error

        async with httpx.AsyncClient(
            timeout=self.config.timeout_seconds,
            transport=self._transport,
            trust_env=False,
        ) as client:
            response = await client.post(
                f"{base_url}/api/chat",
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
            try:
                payload = response.json()
            except ValueError as error:
                raise _ProviderResponseError(
                    status="failed",
                    error_code="invalid_json_response",
                    error_message="Ollama mengembalikan JSON yang tidak valid.",
                ) from error
            return _parse_ollama_content(payload)


def _parse_ollama_content(payload: object) -> str:
    if not isinstance(payload, dict):
        raise _invalid_ollama_schema()

    message = payload.get("message")
    if not isinstance(message, dict):
        raise _invalid_ollama_schema()

    content = message.get("content")
    if not isinstance(content, str):
        raise _invalid_ollama_schema()

    if len(content) > MAX_MODEL_RESPONSE_CHARS:
        raise _ProviderResponseError(
            status="blocked",
            error_code="response_too_large",
            error_message="Respons Ollama melampaui batas ukuran aplikasi.",
        )

    normalized = content.strip()
    if not normalized:
        raise _ProviderResponseError(
            status="empty",
            error_code="empty_model_response",
            error_message="Ollama tidak menghasilkan konten yang dapat digunakan.",
        )
    return normalized


def _invalid_ollama_schema() -> _ProviderResponseError:
    return _ProviderResponseError(
        status="failed",
        error_code="invalid_response_schema",
        error_message="Struktur respons Ollama tidak valid.",
    )


class _OpenAiCompatibleProvider(_LiveHttpProviderMixin, DummyLocalProvider):
    """LM Studio and LocalAI both expose an OpenAI-compatible chat endpoint."""

    async def generate(self, request: LlmRequest) -> LlmResponse:
        if self.config.mode != "live":
            return await super().generate(request)
        return await self._live_generate(request)

    async def _call(self, request: LlmRequest, model: str) -> str:
        async with httpx.AsyncClient(
            timeout=self.config.timeout_seconds,
            trust_env=False,
        ) as client:
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
