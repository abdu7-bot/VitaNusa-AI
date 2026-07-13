from __future__ import annotations

from ..base import DummySearchProvider
from ..config import WebSearchConfig


class DuckDuckGoSearchProvider(DummySearchProvider):
    """No-network adapter; future use is additional context, not sole health evidence."""

    name = "duckduckgo"

    def __init__(self, config: WebSearchConfig) -> None:
        super().__init__(config)
