from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


LlmMode = Literal["disabled", "mock", "live"]
LlmStrategy = Literal["priority", "fallback"]
LlmStatus = Literal[
    "success",
    "mock",
    "disabled",
    "blocked",
    "empty",
    "timeout",
    "unavailable",
    "not_implemented",
    "failed",
]


class LlmMessage(BaseModel):
    role: str = Field(min_length=1, max_length=30)
    content: str = Field(min_length=1, max_length=12000)


class LlmRequest(BaseModel):
    system_prompt: str = Field(min_length=1, max_length=12000)
    user_message: str = Field(min_length=1, max_length=4000)
    model: str | None = None
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=500, ge=50, le=2000)
    intent: str | None = None
    safety_level: str | None = None


class LlmResponse(BaseModel):
    provider: str
    model: str | None = None
    content: str = ""
    status: LlmStatus
    elapsed_ms: int = Field(default=0, ge=0)
    is_mock: bool = False
    error_code: str | None = None
    error_message: str | None = None


class LlmRouterResponse(BaseModel):
    mode: LlmMode
    strategy: LlmStrategy
    selected_provider: str | None = None
    attempted_providers: list[str] = Field(default_factory=list)
    failed_providers: list[str] = Field(default_factory=list)
    response: LlmResponse | None = None
    fallback_used: bool = False
    all_providers_failed: bool = False
