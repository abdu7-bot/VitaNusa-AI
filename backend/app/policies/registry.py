from __future__ import annotations

from collections.abc import Iterable

from .authority_boundary import AuthorityBoundaryPolicy
from .base import BasePolicy, POLICY_DOMAINS
from .content_integrity import ContentIntegrityPolicy
from .halal_thayyib import HalalThayyibPolicy
from .islamic_boundary import IslamicBoundaryPolicy
from .medical_safety import MedicalSafetyPolicy
from .product_claims import ProductClaimsPolicy

POLICY_REGISTRY: tuple[BasePolicy, ...] = (
    MedicalSafetyPolicy(),
    AuthorityBoundaryPolicy(),
    IslamicBoundaryPolicy(),
    HalalThayyibPolicy(),
    ProductClaimsPolicy(),
    ContentIntegrityPolicy(),
)


def validate_registry(policies: Iterable[BasePolicy]) -> tuple[BasePolicy, ...]:
    normalized = tuple(policies)
    seen: set[str] = set()

    for policy in normalized:
        policy_id = getattr(policy, "policy_id", "")
        domain = getattr(policy, "domain", "")
        if not isinstance(policy_id, str) or not policy_id.strip():
            raise ValueError("every registered policy must have a non-empty policy_id")
        if policy_id in seen:
            raise ValueError(f"duplicate policy_id in registry: {policy_id}")
        if domain not in POLICY_DOMAINS:
            raise ValueError(f"unsupported registry domain for {policy_id}: {domain}")
        if not callable(getattr(policy, "evaluate", None)):
            raise ValueError(f"registered policy is not evaluable: {policy_id}")
        seen.add(policy_id)

    return normalized


validate_registry(POLICY_REGISTRY)
