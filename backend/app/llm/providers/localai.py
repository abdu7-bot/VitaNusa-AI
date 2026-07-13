from __future__ import annotations

from ..base import DummyLocalProvider
from ..config import LocalLlmConfig


class LocalAIProvider(DummyLocalProvider):
    name = "localai"

    def __init__(self, config: LocalLlmConfig | None = None) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.localai)
