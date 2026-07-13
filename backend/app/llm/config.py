from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Mapping, cast

from .models import LlmMode, LlmStrategy


SUPPORTED_MODES = frozenset({"disabled", "mock", "live"})
SUPPORTED_STRATEGIES = frozenset({"priority", "fallback"})
SUPPORTED_PROVIDERS = ("ollama", "lmstudio", "localai")


@dataclass(frozen=True, slots=True)
class ProviderRuntimeConfig:
    enabled: bool
    base_url: str


@dataclass(frozen=True, slots=True)
class LocalLlmConfig:
    mode: LlmMode = "mock"
    strategy: LlmStrategy = "fallback"
    providers: tuple[str, ...] = SUPPORTED_PROVIDERS
    provider: str = "ollama"
    model: str | None = None
    timeout_seconds: float = 45.0
    max_tokens: int = 500
    temperature: float = 0.2
    preview_enabled: bool = False
    ask_enabled: bool = False
    mock_scenario: str = "success"
    ollama: ProviderRuntimeConfig = field(
        default_factory=lambda: ProviderRuntimeConfig(
            enabled=False,
            base_url="http://127.0.0.1:11434",
        )
    )
    lmstudio: ProviderRuntimeConfig = field(
        default_factory=lambda: ProviderRuntimeConfig(
            enabled=False,
            base_url="http://127.0.0.1:1234/v1",
        )
    )
    localai: ProviderRuntimeConfig = field(
        default_factory=lambda: ProviderRuntimeConfig(
            enabled=False,
            base_url="http://127.0.0.1:8080/v1",
        )
    )
    configuration_errors: tuple[str, ...] = ()

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
    ) -> "LocalLlmConfig":
        errors: list[str] = []

        def read(name: str, default: str) -> str:
            if environ is not None:
                return environ.get(name, default)
            return os.getenv(name, default)

        raw_mode = read("LOCAL_LLM_MODE", "mock").strip().lower()
        if raw_mode not in SUPPORTED_MODES:
            errors.append("unsupported_local_llm_mode")
            raw_mode = "disabled"

        raw_strategy = read("LOCAL_LLM_STRATEGY", "fallback").strip().lower()
        if raw_strategy not in SUPPORTED_STRATEGIES:
            errors.append("unsupported_local_llm_strategy")
            raw_strategy = "priority"

        raw_providers = read(
            "LOCAL_LLM_PROVIDERS",
            ",".join(SUPPORTED_PROVIDERS),
        )
        providers = tuple(
            dict.fromkeys(
                item.strip().lower()
                for item in raw_providers.split(",")
                if item.strip()
            )
        )

        timeout_seconds = _read_float(
            read("LOCAL_LLM_TIMEOUT_SECONDS", "45"),
            default=45.0,
            minimum=0.01,
            maximum=300.0,
            error_code="invalid_local_llm_timeout",
            errors=errors,
        )
        max_tokens = _read_int(
            read("LOCAL_LLM_MAX_TOKENS", "500"),
            default=500,
            minimum=50,
            maximum=2000,
            error_code="invalid_local_llm_max_tokens",
            errors=errors,
        )
        temperature = _read_float(
            read("LOCAL_LLM_TEMPERATURE", "0.2"),
            default=0.2,
            minimum=0.0,
            maximum=1.0,
            error_code="invalid_local_llm_temperature",
            errors=errors,
        )

        model = read("LOCAL_LLM_MODEL", "").strip() or None

        return cls(
            mode=cast(LlmMode, raw_mode),
            strategy=cast(LlmStrategy, raw_strategy),
            providers=providers,
            provider=read("LOCAL_LLM_PROVIDER", "ollama").strip().lower(),
            model=model,
            timeout_seconds=timeout_seconds,
            max_tokens=max_tokens,
            temperature=temperature,
            preview_enabled=_read_bool(
                read("LOCAL_LLM_PREVIEW_ENABLED", "false"),
                default=False,
                error_code="invalid_local_llm_preview_flag",
                errors=errors,
            ),
            ask_enabled=_read_bool(
                read("LOCAL_LLM_ASK_ENABLED", "false"),
                default=False,
                error_code="invalid_local_llm_ask_flag",
                errors=errors,
            ),
            mock_scenario=read("LOCAL_LLM_MOCK_SCENARIO", "success").strip().lower(),
            ollama=ProviderRuntimeConfig(
                enabled=_read_bool(
                    read("OLLAMA_ENABLED", "false"),
                    default=False,
                    error_code="invalid_ollama_enabled_flag",
                    errors=errors,
                ),
                base_url=read(
                    "OLLAMA_BASE_URL",
                    "http://127.0.0.1:11434",
                ).strip(),
            ),
            lmstudio=ProviderRuntimeConfig(
                enabled=_read_bool(
                    read("LM_STUDIO_ENABLED", "false"),
                    default=False,
                    error_code="invalid_lm_studio_enabled_flag",
                    errors=errors,
                ),
                base_url=read(
                    "LM_STUDIO_BASE_URL",
                    "http://127.0.0.1:1234/v1",
                ).strip(),
            ),
            localai=ProviderRuntimeConfig(
                enabled=_read_bool(
                    read("LOCALAI_ENABLED", "false"),
                    default=False,
                    error_code="invalid_localai_enabled_flag",
                    errors=errors,
                ),
                base_url=read(
                    "LOCALAI_BASE_URL",
                    "http://127.0.0.1:8080/v1",
                ).strip(),
            ),
            configuration_errors=tuple(errors),
        )

    def provider_config(self, name: str) -> ProviderRuntimeConfig | None:
        if name == "ollama":
            return self.ollama
        if name == "lmstudio":
            return self.lmstudio
        if name == "localai":
            return self.localai
        return None


def _read_bool(
    raw_value: str,
    *,
    default: bool,
    error_code: str,
    errors: list[str],
) -> bool:
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    errors.append(error_code)
    return default


def _read_float(
    raw_value: str,
    *,
    default: float,
    minimum: float,
    maximum: float,
    error_code: str,
    errors: list[str],
) -> float:
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        errors.append(error_code)
        return default
    if not minimum <= value <= maximum:
        errors.append(error_code)
        return default
    return value


def _read_int(
    raw_value: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
    error_code: str,
    errors: list[str],
) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        errors.append(error_code)
        return default
    if not minimum <= value <= maximum:
        errors.append(error_code)
        return default
    return value
