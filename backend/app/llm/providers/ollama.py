from __future__ import annotations

from ..base import DummyLocalProvider
from ..config import LocalLlmConfig


class OllamaProvider(DummyLocalProvider):
    name = "ollama"

    def __init__(self, config: LocalLlmConfig | None = None) -> None:
        resolved = config or LocalLlmConfig()
        super().__init__(resolved, resolved.ollama)
