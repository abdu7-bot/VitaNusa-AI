from typing import Any, Literal

from pydantic import BaseModel, Field

from .search.models import SearchCategory


class AskRequest(BaseModel):
    question: str
    includeQuranicReflection: bool = False
    sessionId: str | None = Field(default=None, max_length=200)


class LlmPreviewRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    provider: str | None = Field(default=None, min_length=1, max_length=50)
    strategy: Literal["priority", "fallback"] | None = None


class SearchPreviewRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    category: SearchCategory = "general"
    provider: str | None = Field(default=None, min_length=1, max_length=50)
    strategy: Literal["priority", "fallback", "aggregate"] | None = None
    maxResults: int = Field(default=5, ge=1, le=10)


class ActionLink(BaseModel):
    label: str
    href: str


class QuranicReflection(BaseModel):
    type: str
    text: str
    note: str


class PolicyResultResponse(BaseModel):
    policyId: str
    domain: str
    status: str
    priority: int
    blocksResponse: bool = False
    message: str | None = None
    recommendedAction: str | None = None
    reasons: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PolicyDecisionResponse(BaseModel):
    dominantPolicy: str | None = None
    responseBlocked: bool = False
    allowedActions: list[str] = Field(default_factory=list)
    prohibitedActions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    recommendedAction: str | None = None
    results: list[PolicyResultResponse] = Field(default_factory=list)


class AskResponse(BaseModel):
    question: str
    intent: str
    safetyLevel: str
    answer: str
    disclaimer: str
    recommendedAction: str | None = None
    actions: list[ActionLink] = Field(default_factory=list)
    sources: list[dict[str, str]] = Field(default_factory=list)
    quranicReflection: QuranicReflection | None = None
    policyDecision: PolicyDecisionResponse | None = None
    sessionId: str = Field(default="")
