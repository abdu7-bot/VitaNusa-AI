"""Compatibility facade for the centralized safety pipeline.

Emergency detection and risk classification are implemented only in
``app.safety_v3``. This historical module remains solely for existing imports.
"""

from .safety_v3 import (
    EMERGENCY_KEYWORDS,
    HIGH_RISK_KEYWORDS,
    SafetyResult,
    classify_risk,
    contains_any,
    contains_emergency_signal,
    contains_non_negated_signal,
)

__all__ = (
    "EMERGENCY_KEYWORDS", "HIGH_RISK_KEYWORDS", "SafetyResult",
    "classify_risk", "contains_any", "contains_emergency_signal",
    "contains_non_negated_signal",
)
