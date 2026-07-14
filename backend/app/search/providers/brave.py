from __future__ import annotations

from ..base import DummySearchProvider
from ..config import WebSearchConfig


class BraveSearchProvider(DummySearchProvider):
    name = "brave"

    def __init__(self, config: WebSearchConfig) -> None:
        super().__init__(config)
