from __future__ import annotations

from ..base import DummySearchProvider
from ..config import WebSearchConfig


class SearxngSearchProvider(DummySearchProvider):
    name = "searxng"

    def __init__(self, config: WebSearchConfig) -> None:
        super().__init__(config)
