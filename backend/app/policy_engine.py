from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from .intent_router import normalize_text
from .policies.base import BasePolicy, PolicyContext, PolicyResult
from .policies.registry import POLICY_REGISTRY, validate_registry


@dataclass(frozen=True)
class PolicyDecision:
    dominant_policy: PolicyResult | None
    results: tuple[PolicyResult, ...]
    response_blocked: bool
    allowed_actions: tuple[str, ...]
    prohibited_actions: tuple[str, ...]
    warnings: tuple[str, ...]
    recommended_action: str | None

    def has_policy(self, policy_id: str) -> bool:
        return any(result.policy_id == policy_id for result in self.results)

    def get_policy(self, policy_id: str) -> PolicyResult | None:
        return next(
            (result for result in self.results if result.policy_id == policy_id),
            None,
        )


class PolicyEngine:
    def __init__(self, policies: Iterable[BasePolicy] = POLICY_REGISTRY) -> None:
        self._policies = validate_registry(policies)

    @property
    def policies(self) -> tuple[BasePolicy, ...]:
        return self._policies

    def evaluate(self, context: PolicyContext) -> PolicyDecision:
        results: list[PolicyResult] = []

        for policy in self._policies:
            try:
                result = policy.evaluate(context)
                if result is None:
                    continue
                if not isinstance(result, PolicyResult):
                    raise TypeError("policy must return PolicyResult or None")
                if result.policy_id != policy.policy_id:
                    raise ValueError(
                        f"policy result id {result.policy_id!r} does not match {policy.policy_id!r}"
                    )
                if result.domain != policy.domain:
                    raise ValueError(
                        f"policy result domain {result.domain!r} does not match {policy.domain!r}"
                    )
                results.append(result)
            except Exception:
                results.append(
                    PolicyResult(
                        policy_id=f"policy_engine_failure.{policy.policy_id}",
                        domain="content_integrity",
                        status="caution",
                        priority=590,
                        message=(
                            "Sebagian pemeriksaan kebijakan tidak dapat dijalankan. "
                            "Sistem memakai fallback yang lebih konservatif."
                        ),
                        reasons=("policy_evaluation_failed",),
                        metadata={
                            "failed_policy_id": policy.policy_id,
                            "allowed_actions": ("use_safe_fallback",),
                            "prohibited_actions": ("assume_policy_passed",),
                        },
                    )
                )

        ordered = tuple(sorted(results, key=lambda item: (-item.priority, item.policy_id)))
        response_blocked = any(result.blocks_response for result in ordered)
        allowed_actions = self._collect_actions(ordered, "allowed_actions")
        prohibited_actions = self._collect_actions(ordered, "prohibited_actions")
        warnings = tuple(
            dict.fromkeys(
                result.message
                for result in ordered
                if result.message and result.status in {"caution", "restrict", "block", "critical"}
            )
        )
        recommended_action = next(
            (
                result.recommended_action
                for result in ordered
                if result.recommended_action
            ),
            None,
        )

        return PolicyDecision(
            dominant_policy=ordered[0] if ordered else None,
            results=ordered,
            response_blocked=response_blocked,
            allowed_actions=allowed_actions,
            prohibited_actions=prohibited_actions,
            warnings=warnings,
            recommended_action=recommended_action,
        )

    def evaluate_question(
        self,
        question: str,
        *,
        intent: str,
        safety_level: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> PolicyDecision:
        context = PolicyContext(
            question=question,
            normalized_question=normalize_text(question),
            intent=intent,
            safety_level=safety_level,
            metadata=metadata or {},
        )
        return self.evaluate(context)

    @staticmethod
    def _collect_actions(
        results: tuple[PolicyResult, ...],
        key: str,
    ) -> tuple[str, ...]:
        collected: list[str] = []
        for result in results:
            raw_actions = result.metadata.get(key, ())
            if isinstance(raw_actions, str):
                raw_actions = (raw_actions,)
            for action in raw_actions:
                normalized = str(action).strip()
                if normalized and normalized not in collected:
                    collected.append(normalized)
        return tuple(collected)


POLICY_ENGINE = PolicyEngine()


def serialize_policy_decision(decision: PolicyDecision) -> dict[str, Any]:
    return {
        "dominantPolicy": (
            decision.dominant_policy.policy_id if decision.dominant_policy else None
        ),
        "responseBlocked": decision.response_blocked,
        "allowedActions": list(decision.allowed_actions),
        "prohibitedActions": list(decision.prohibited_actions),
        "warnings": list(decision.warnings),
        "recommendedAction": decision.recommended_action,
        "results": [
            {
                "policyId": result.policy_id,
                "domain": result.domain,
                "status": result.status,
                "priority": result.priority,
                "blocksResponse": result.blocks_response,
                "message": result.message,
                "recommendedAction": result.recommended_action,
                "reasons": list(result.reasons),
                "metadata": dict(result.metadata),
            }
            for result in decision.results
        ],
    }
