from __future__ import annotations

import httpx

from ..base import DummySearchProvider
from ..config import WebSearchConfig
from ..live import fetch_json, result_from_payload
from ..models import ProviderSearchResponse, SearchQuery


class BraveSearchProvider(DummySearchProvider):
    name = "brave"
    BASE_URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, config: WebSearchConfig, transport: httpx.AsyncBaseTransport | None = None) -> None:
        super().__init__(config)
        self.transport = transport

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        if self.config.mode != "live":
            return await super().search(query)
        runtime = self.config.brave
        if not runtime.enabled or not runtime.api_key:
            return ProviderSearchResponse(
                provider=self.name,
                status="unavailable",
                error_code="brave_not_configured",
                error_message="Brave Search belum dikonfigurasi.",
            )

        response, payload = await fetch_json(
            provider=self.name,
            url=self.BASE_URL,
            query=query,
            timeout_seconds=self.config.timeout_seconds,
            max_response_bytes=self.config.max_response_bytes,
            params={
                "q": query.query,
                "count": query.max_results,
                "search_lang": query.language,
                "country": query.country,
                "safesearch": "strict" if query.safe_search else "off",
            },
            headers={"X-Subscription-Token": runtime.api_key, "Accept": "application/json"},
            transport=self.transport,
        )
        if response.status != "success" or payload is None:
            return response

        results = []
        for item in payload.get("web", {}).get("results", []) if isinstance(payload.get("web"), dict) else []:
            if not isinstance(item, dict):
                continue
            result = result_from_payload(
                provider=self.name,
                title=item.get("title"),
                url=item.get("url"),
                snippet=item.get("description"),
                published_at=item.get("age"),
            )
            if result is not None:
                results.append(result)
            if len(results) >= query.max_results:
                break
        return response.model_copy(update={"results": results, "status": "success" if results else "empty"})
