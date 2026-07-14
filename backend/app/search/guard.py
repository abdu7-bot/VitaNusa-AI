from __future__ import annotations

from pydantic import BaseModel, Field

from ..policy_engine import PolicyDecision
from .config import normalize_provider_identifier
from .models import (
    ProviderSearchResponse,
    SearchCategory,
    SearchMode,
    SearchRouterResponse,
    SearchStrategy,
)


LOCAL_KNOWLEDGE_INTENTS = frozenset(
    {
        "identity",
        "vitacheck",
        "article_search",
        "quranic_reflection",
        "contact_admin",
        "greeting",
        "conversation_correction",
    }
)


class SearchGuardContext(BaseModel):
    response_blocked: bool = False
    dominant_policy: str | None = None
    prohibited_actions: list[str] = Field(default_factory=list)
    safety_level: str | None = None
    intent: str | None = None
    query: str | None = None


class SearchGuardDecision(BaseModel):
    allowed: bool
    reason: str
    category: SearchCategory
    providers: list[str] = Field(default_factory=list)
    strategy: SearchStrategy
    safety_first: bool = False


def build_search_guard_context(
    decision: PolicyDecision,
    *,
    intent: str,
    safety_level: str,
    query: str,
) -> SearchGuardContext:
    return SearchGuardContext(
        response_blocked=decision.response_blocked,
        dominant_policy=(
            decision.dominant_policy.policy_id if decision.dominant_policy else None
        ),
        prohibited_actions=list(decision.prohibited_actions),
        safety_level=safety_level,
        intent=intent,
        query=query,
    )


def evaluate_search_guard(
    context: SearchGuardContext,
    *,
    requested_category: SearchCategory = "general",
    providers: tuple[str, ...] | list[str] = (),
    strategy: SearchStrategy = "aggregate",
) -> SearchGuardDecision:
    provider_order = _normalized_providers(providers)
    category = _category_for_context(context, requested_category)

    if context.intent == "danger_sign" or context.safety_level == "emergency":
        return SearchGuardDecision(
            allowed=False,
            reason="emergency_response_required",
            category="health",
            strategy=strategy,
            safety_first=True,
        )

    if context.intent == "medication_request":
        return SearchGuardDecision(
            allowed=False,
            reason="personal_medication_search_blocked",
            category="health",
            strategy=strategy,
        )

    if context.intent == "product_claim":
        configured_providers = set(provider_order)
        preferred = ["brave", "searxng"]
        provider_order = preferred + [
            name for name in provider_order if name not in preferred
        ]
        provider_order = [
            name for name in provider_order if name in configured_providers
        ]
        return SearchGuardDecision(
            allowed=bool(provider_order),
            reason=(
                "product_claim_source_search_allowed"
                if provider_order
                else "no_search_providers_configured"
            ),
            category="product_claim",
            providers=provider_order,
            strategy=strategy,
        )

    if context.response_blocked:
        return SearchGuardDecision(
            allowed=False,
            reason="policy_response_blocked",
            category=category,
            strategy=strategy,
        )

    if context.intent in LOCAL_KNOWLEDGE_INTENTS:
        return SearchGuardDecision(
            allowed=False,
            reason="local_knowledge_or_conversation_is_sufficient",
            category=category,
            strategy=strategy,
        )

    if not provider_order:
        return SearchGuardDecision(
            allowed=False,
            reason="no_search_providers_configured",
            category=category,
            strategy=strategy,
        )

    return SearchGuardDecision(
        allowed=True,
        reason=(
            "fresh_information_search_allowed"
            if requested_category == "news"
            else "development_preview_search_allowed"
        ),
        category=category,
        providers=provider_order,
        strategy=strategy,
    )


def build_blocked_search_response(
    *,
    mode: SearchMode,
    strategy: SearchStrategy,
    query: str,
    reason: str,
) -> SearchRouterResponse:
    return SearchRouterResponse(
        mode=mode,
        strategy=strategy,
        query=query,
        provider_responses=[
            ProviderSearchResponse(
                provider="search-guard",
                status="blocked",
                error_code=reason,
                error_message=(
                    "Pencarian tidak dijalankan karena keputusan keselamatan aplikasi."
                ),
            )
        ],
    )


def _category_for_context(
    context: SearchGuardContext,
    requested_category: SearchCategory,
) -> SearchCategory:
    if context.intent in {"danger_sign", "medication_request", "health_general"}:
        return "health"
    if context.intent == "product_claim":
        return "product_claim"
    return requested_category


def _normalized_providers(providers: tuple[str, ...] | list[str]) -> list[str]:
    normalized: list[str] = []
    for raw_provider in providers:
        provider = normalize_provider_identifier(raw_provider)
        if provider and provider not in normalized:
            normalized.append(provider)
    return normalized
