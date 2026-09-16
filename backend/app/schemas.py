from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from .search.models import SearchCategory


class HealthIntake(BaseModel):
    """Structured health intake for non-diagnostic context gathering.

    All fields are optional and default to 'unknown' for safety.
    No personal identifiable information is collected (no name, ID, address, phone).
    """

    subject_context: Literal["self", "other_person", "hypothetical", "unknown"] = Field(
        default="unknown",
        description="Who is the health question about?"
    )

    age_group: Literal["child", "adult", "elderly", "unknown"] = Field(
        default="unknown",
        description="Approximate age group (for context, not diagnosis)"
    )

    symptom_text: str = Field(
        default="",
        max_length=2000,
        description="Description of symptoms or health concern"
    )

    onset_context: Literal["now", "today", "recent", "past", "unknown"] = Field(
        default="unknown",
        description="When did the symptom start?"
    )

    severity_context: Literal["mild", "moderate", "severe", "unknown"] = Field(
        default="unknown",
        description="How severe does it feel? (self-reported, not diagnostic)"
    )

    functional_impact: Literal["none", "limited", "severe", "unknown"] = Field(
        default="unknown",
        description="How much does it affect daily activities?"
    )

    relevant_context: list[Literal[
        "pregnancy", "breastfeeding", "chronic_condition",
        "medication", "allergy", "injury", "poisoning", "none", "unknown"
    ]] = Field(
        default_factory=lambda: ["unknown"],
        description="Any relevant medical context"
    )

    @field_validator("symptom_text")
    @classmethod
    def strip_symptom_text(cls, v: str) -> str:
        return v.strip()


class AskRequest(BaseModel):

    question: str = Field(min_length=1, max_length=4000)
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


class NavigatorRequest(BaseModel):
    topic: str | None = Field(default=None, max_length=100)
    text: str = Field(min_length=1, max_length=2000)


class NavigatorResponse(BaseModel):
    status: Literal["education", "high_risk", "red_flag", "ambiguous"]
    topic: str | None = None
    action: str
    matchedFlags: list[str] = Field(default_factory=list)
    scope: Literal["education-only", "high-risk", "topic-red-flag", "emergency-first", "ambiguous-clarification"]
    sources: list[dict[str, str]] = Field(default_factory=list)
    evidence: list[dict[str, str]] = Field(default_factory=list)
    evidenceNote: str = "Sumber adalah rujukan edukasi umum, bukan bukti diagnosis individual."
    clarificationRequired: bool = Field(default=False, description="Whether clarification is needed for ambiguous input")
    clarificationQuestions: list[str] = Field(default_factory=list, description="Minimal clarification questions if ambiguous")


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
