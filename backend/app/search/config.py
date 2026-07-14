from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Mapping, cast

from .models import SearchMode, SearchStrategy


SUPPORTED_MODES = frozenset({"disabled", "mock", "live"})
SUPPORTED_STRATEGIES = frozenset({"priority", "fallback", "aggregate"})
SUPPORTED_PROVIDERS = ("brave", "duckduckgo", "searxng")
FALLBACK_PROVIDER_ORDER = ("brave", "searxng", "duckduckgo")

PROVIDER_ALIASES = {
    "brave": "brave",
    "bravesearch": "brave",
    "brave-search": "brave",
    "duckduckgo": "duckduckgo",
    "duck-duck-go": "duckduckgo",
    "ddg": "duckduckgo",
    "searxng": "searxng",
    "searx-ng": "searxng",
    "searx": "searxng",
}


def normalize_provider_identifier(value: object) -> str | None:
    normalized = str(value or "").strip().lower().replace("_", "-")
    if not normalized:
        return None
    return PROVIDER_ALIASES.get(normalized)


@dataclass(frozen=True, slots=True)
class SearchProviderRuntimeConfig:
    enabled: bool = False
    base_url: str = ""
    api_key: str | None = None


@dataclass(frozen=True, slots=True)
class WebSearchConfig:
    mode: SearchMode = "mock"
    strategy: SearchStrategy = "aggregate"
    providers: tuple[str, ...] = SUPPORTED_PROVIDERS
    provider: str = "brave"
    max_results: int = 5
    timeout_seconds: float = 8.0
    language: str = "id"
    country: str = "ID"
    safe_search: bool = True
    preview_enabled: bool = False
    mock_scenario: str = "success"
    app_env: str = "development"
    brave: SearchProviderRuntimeConfig = field(
        default_factory=SearchProviderRuntimeConfig
    )
    duckduckgo: SearchProviderRuntimeConfig = field(
        default_factory=SearchProviderRuntimeConfig
    )
    searxng: SearchProviderRuntimeConfig = field(
        default_factory=SearchProviderRuntimeConfig
    )
    configuration_errors: tuple[str, ...] = ()

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
    ) -> "WebSearchConfig":
        errors: list[str] = []

        def read(name: str, default: str) -> str:
            if environ is not None:
                return environ.get(name, default)
            return os.getenv(name, default)

        raw_mode = read("WEB_SEARCH_MODE", "mock").strip().lower()
        if raw_mode not in SUPPORTED_MODES:
            errors.append("unsupported_web_search_mode")
            raw_mode = "disabled"

        raw_strategy = read("WEB_SEARCH_STRATEGY", "aggregate").strip().lower()
        if raw_strategy not in SUPPORTED_STRATEGIES:
            errors.append("unsupported_web_search_strategy")
            raw_strategy = "priority"

        providers: list[str] = []
        raw_providers = read(
            "WEB_SEARCH_PROVIDERS",
            ",".join(SUPPORTED_PROVIDERS),
        )
        for raw_provider in raw_providers.split(","):
            if not raw_provider.strip():
                continue
            provider = normalize_provider_identifier(raw_provider)
            if provider is None:
                errors.append("unknown_web_search_provider")
                continue
            if provider not in providers:
                providers.append(provider)

        raw_primary = read("WEB_SEARCH_PROVIDER", "brave").strip().lower()
        primary = normalize_provider_identifier(raw_primary)
        if primary is None:
            errors.append("unknown_primary_web_search_provider")
            primary = raw_primary or "unknown"

        language = read("WEB_SEARCH_LANGUAGE", "id").strip()
        if not 2 <= len(language) <= 10:
            errors.append("invalid_web_search_language")
            language = "id"

        country = read("WEB_SEARCH_COUNTRY", "ID").strip()
        if not 2 <= len(country) <= 10:
            errors.append("invalid_web_search_country")
            country = "ID"

        return cls(
            mode=cast(SearchMode, raw_mode),
            strategy=cast(SearchStrategy, raw_strategy),
            providers=tuple(providers),
            provider=primary,
            max_results=_read_int(
                read("WEB_SEARCH_MAX_RESULTS", "5"),
                default=5,
                minimum=1,
                maximum=10,
                error_code="invalid_web_search_max_results",
                errors=errors,
            ),
            timeout_seconds=_read_float(
                read("WEB_SEARCH_TIMEOUT_SECONDS", "8"),
                default=8.0,
                minimum=1.0,
                maximum=30.0,
                error_code="invalid_web_search_timeout",
                errors=errors,
            ),
            language=language,
            country=country.upper(),
            safe_search=_read_bool(
                read("WEB_SEARCH_SAFE_SEARCH", "true"),
                default=True,
                error_code="invalid_web_search_safe_search",
                errors=errors,
            ),
            preview_enabled=_read_bool(
                read("WEB_SEARCH_PREVIEW_ENABLED", "false"),
                default=False,
                error_code="invalid_web_search_preview_flag",
                errors=errors,
            ),
            mock_scenario=read(
                "WEB_SEARCH_MOCK_SCENARIO",
                "success",
            ).strip().lower(),
            app_env=read("APP_ENV", "development").strip().lower(),
            brave=SearchProviderRuntimeConfig(
                enabled=_read_bool(
                    read("BRAVE_SEARCH_ENABLED", "false"),
                    default=False,
                    error_code="invalid_brave_search_enabled_flag",
                    errors=errors,
                ),
                api_key=read("BRAVE_SEARCH_API_KEY", "").strip() or None,
            ),
            duckduckgo=SearchProviderRuntimeConfig(
                enabled=_read_bool(
                    read("DUCKDUCKGO_SEARCH_ENABLED", "false"),
                    default=False,
                    error_code="invalid_duckduckgo_search_enabled_flag",
                    errors=errors,
                ),
                base_url=read("DUCKDUCKGO_BASE_URL", "").strip(),
            ),
            searxng=SearchProviderRuntimeConfig(
                enabled=_read_bool(
                    read("SEARXNG_SEARCH_ENABLED", "false"),
                    default=False,
                    error_code="invalid_searxng_search_enabled_flag",
                    errors=errors,
                ),
                base_url=read("SEARXNG_BASE_URL", "").strip(),
                api_key=read("SEARXNG_API_KEY", "").strip() or None,
            ),
            configuration_errors=tuple(dict.fromkeys(errors)),
        )

    def provider_config(self, name: str) -> SearchProviderRuntimeConfig | None:
        if name == "brave":
            return self.brave
        if name == "duckduckgo":
            return self.duckduckgo
        if name == "searxng":
            return self.searxng
        return None

    @property
    def preview_available(self) -> bool:
        return self.preview_enabled and self.app_env != "production"


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
