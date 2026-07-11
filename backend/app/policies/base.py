from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, Mapping

PolicyStatus = Literal[
    "allow",
    "inform",
    "caution",
    "restrict",
    "block",
    "critical",
]

POLICY_DOMAINS = frozenset(
    {
        "medical_safety",
        "authority_boundary",
        "islamic_boundary",
        "halal_thayyib",
        "product_claims",
        "content_integrity",
        "privacy",
        "user_wellbeing",
        "commercial_ethics",
    }
)

POLICY_STATUSES = frozenset(
    {"allow", "inform", "caution", "restrict", "block", "critical"}
)

PRIORITY_BANDS = {
    "critical_emergency": range(1000, 1100),
    "serious_medical_risk": range(900, 1000),
    "authority_boundary": range(800, 900),
    "islamic_halal_boundary": range(700, 800),
    "product_claim_restriction": range(600, 700),
    "content_integrity": range(500, 600),
    "educational_guidance": range(300, 500),
    "recommendation_navigation": range(100, 300),
}

MIN_POLICY_PRIORITY = 100
MAX_POLICY_PRIORITY = 1099
BLOCKING_STATUSES = frozenset({"restrict", "block", "critical"})


@dataclass(frozen=True)
class PolicyContext:
    question: str
    normalized_question: str
    intent: str
    safety_level: str
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PolicyResult:
    policy_id: str
    domain: str
    status: PolicyStatus
    priority: int
    blocks_response: bool = False
    message: str | None = None
    recommended_action: str | None = None
    reasons: tuple[str, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.policy_id or not self.policy_id.strip():
            raise ValueError("policy_id must be a non-empty string")
        if self.domain not in POLICY_DOMAINS:
            raise ValueError(f"unsupported policy domain: {self.domain}")
        if self.status not in POLICY_STATUSES:
            raise ValueError(f"unsupported policy status: {self.status}")
        if not MIN_POLICY_PRIORITY <= self.priority <= MAX_POLICY_PRIORITY:
            raise ValueError(
                f"priority must be between {MIN_POLICY_PRIORITY} and {MAX_POLICY_PRIORITY}"
            )
        if self.blocks_response and self.status not in BLOCKING_STATUSES:
            raise ValueError(
                "blocks_response=True is only valid for restrict, block, or critical"
            )
        object.__setattr__(self, "reasons", tuple(self.reasons))
        object.__setattr__(self, "metadata", dict(self.metadata))


class BasePolicy(ABC):
    policy_id: str
    domain: str

    @abstractmethod
    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        """Return one policy result or None when the policy is not relevant."""
