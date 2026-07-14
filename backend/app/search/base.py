from __future__ import annotations

from time import perf_counter
from typing import Protocol

from .config import WebSearchConfig
from .fixtures import build_mock_provider_response
from .models import ProviderSearchResponse, SearchQuery


class SearchProvider(Protocol):
    name: str

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        ...


class DummySearchProvider:
    """Shared no-network behavior for the three search provider adapters."""

    name: str

    def __init__(self, config: WebSearchConfig) -> None:
        self.config = config

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        started = perf_counter()

        if self.config.mode == "disabled":
            response = ProviderSearchResponse(
                provider=self.name,
                status="disabled",
                error_code="web_search_disabled",
                error_message="Pencarian web dinonaktifkan.",
            )
        elif self.config.mode == "mock":
            response = build_mock_provider_response(
                provider=self.name,
                query=query,
                scenario=self.config.mock_scenario,
            )
        elif self.config.mode == "live":
            response = ProviderSearchResponse(
                provider=self.name,
                status="not_implemented",
                error_code="live_search_not_implemented",
                error_message=(
                    "Adapter pencarian live belum diimplementasikan dan tidak "
                    "melakukan koneksi jaringan."
                ),
            )
        else:
            response = ProviderSearchResponse(
                provider=self.name,
                status="failed",
                error_code="unsupported_web_search_mode",
                error_message="Mode pencarian web tidak didukung.",
            )

        elapsed_ms = max(0, int((perf_counter() - started) * 1000))
        return response.model_copy(update={"elapsed_ms": elapsed_ms})
