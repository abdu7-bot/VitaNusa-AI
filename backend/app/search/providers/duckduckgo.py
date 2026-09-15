from __future__ import annotations

import httpx

from ..base import DummySearchProvider
from ..config import WebSearchConfig
from ..live import fetch_json, result_from_payload
from ..models import ProviderSearchResponse, SearchQuery


class DuckDuckGoSearchProvider(DummySearchProvider):
    """Live adapter for DuckDuckGo Instant Answer JSON."""

    name = "duckduckgo"

    def __init__(self, config: WebSearchConfig, transport: httpx.AsyncBaseTransport | None = None) -> None:
        super().__init__(config)
        self.transport = transport

    async def search(self, query: SearchQuery) -> ProviderSearchResponse:
        if self.config.mode != "live":
            return await super().search(query)
        runtime = self.config.duckduckgo
        if not runtime.enabled or not runtime.base_url:
            return ProviderSearchResponse(
                provider=self.name,
                status="unavailable",
                error_code="duckduckgo_not_configured",
                error_message="DuckDuckGo belum dikonfigurasi.",
            )

        response, payload = await fetch_json(
            provider=self.name,
            url=runtime.base_url,
            query=query,
            timeout_seconds=self.config.timeout_seconds,
            max_response_bytes=self.config.max_response_bytes,
            params={
                "q": query.query,
                "format": "json",
                "no_html": "1",
                "no_redirect": "1",
                "safe": "1" if query.safe_search else "-1",
            },
            transport=self.transport,
        )
        if response.status != "success" or payload is None:
            return response

        results = []
        topics = payload.get("RelatedTopics", [])
        if isinstance(topics, list):
            for item in topics:
                if not isinstance(item, dict):
                    continue
                if isinstance(item.get("Topics"), list):
                    for nested in item["Topics"]:
                        if isinstance(nested, dict):
                            result = _result_from_ddg_item(self.name, nested)
                            if result is not None:
                                results.append(result)
                        if len(results) >= query.max_results:
                            break
                else:
                    result = _result_from_ddg_item(self.name, item)
                    if result is not None:
                        results.append(result)
                if len(results) >= query.max_results:
                    break
        return response.model_copy(update={"results": results, "status": "success" if results else "empty"})


def _result_from_ddg_item(provider: str, item: dict) -> object:
    return result_from_payload(
        provider=provider,
        title=item.get("Text"),
        url=item.get("FirstURL"),
        snippet=item.get("Text"),
    )
