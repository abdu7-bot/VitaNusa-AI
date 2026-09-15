from __future__ import annotations

from urllib.parse import urljoin

import httpx

from ..base import DummySearchProvider
from ..config import WebSearchConfig
from ..live import fetch_json, result_from_payload
from ..models import ProviderSearchResponse, SearchQuery


class SearxngSearchProvider(DummySearchProvider):
    name = "searxng"

    def __init__(self, config: WebSearchConfig, transport: httpx.AsyncBaseTransport | None = None) -> None:
        super().__init__(config)
        self.transport = transport

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        if self.config.mode != "live":
            return await super().search(query)
        runtime = self.config.searxng
        if not runtime.enabled or not runtime.base_url:
            return ProviderSearchResponse(
                provider=self.name,
                status="unavailable",
                error_code="searxng_not_configured",
                error_message="SearXNG belum dikonfigurasi.",
            )

        endpoint = urljoin(runtime.base_url.rstrip("/") + "/", "search")
        headers = {"Accept": "application/json"}
        if runtime.api_key:
            headers["Authorization"] = f"Bearer {runtime.api_key}"
        response, payload = await fetch_json(
            provider=self.name,
            url=endpoint,
            query=query,
            timeout_seconds=self.config.timeout_seconds,
            max_response_bytes=self.config.max_response_bytes,
            params={
                "q": query.query,
                "format": "json",
                "language": query.language,
                "safesearch": 2 if query.safe_search else 0,
                "categories": "general",
            },
            headers=headers,
            transport=self.transport,
        )
        if response.status != "success" or payload is None:
            return response

        results = []
        raw_results = payload.get("results", [])
        if isinstance(raw_results, list):
            for item in raw_results:
                if not isinstance(item, dict):
                    continue
                result = result_from_payload(
                    provider=self.name,
                    title=item.get("title"),
                    url=item.get("url"),
                    snippet=item.get("content"),
                    published_at=item.get("publishedDate"),
                    score=item.get("score", 0.0),
                )
                if result is not None:
                    results.append(result)
                if len(results) >= query.max_results:
                    break
        return response.model_copy(update={"results": results, "status": "success" if results else "empty"})
