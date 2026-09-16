from __future__ import annotations

from ..safety_v3 import SafetyDecision, SafetyLevel, evaluate_safety
from .base import BasePolicy, PolicyContext, PolicyResult


class MedicalSafetyPolicy(BasePolicy):
    policy_id = "medical_safety"
    domain = "medical_safety"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        supplied_decision = context.metadata.get("safety_decision")
        safety = (
            supplied_decision
            if isinstance(supplied_decision, SafetyDecision)
            else evaluate_safety(context.question, context.intent)
        )

        if safety.level == SafetyLevel.EMERGENCY:
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="critical",
                priority=1050,
                blocks_response=True,
                message=(
                    "Kondisi yang disebutkan dapat termasuk tanda bahaya. "
                    "Pertolongan medis harus didahulukan sebelum pembahasan lain."
                ),
                recommended_action=safety.recommended_action,
                reasons=("emergency_signal_detected",),
                metadata={
                    "allowed_actions": ("seek_emergency_help",),
                    "prohibited_actions": (
                        "show_products",
                        "show_articles",
                        "run_vitacheck",
                        "give_diagnosis",
                        "give_personal_dose",
                    ),
                    "safety_level": "emergency",
                },
            )

        if safety.level == SafetyLevel.HIGH_RISK:
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="caution",
                priority=930,
                message=(
                    "Konteks ini memerlukan kehati-hatian lebih karena menyangkut kondisi khusus, "
                    "penyakit kronis, obat resep, atau risiko medis yang lebih tinggi."
                ),
                recommended_action=safety.recommended_action,
                reasons=("high_risk_context_detected",),
                metadata={
                    "allowed_actions": ("provide_general_education", "seek_professional_help"),
                    "prohibited_actions": (
                        "give_diagnosis",
                        "give_personal_dose",
                        "recommend_personal_product",
                    ),
                    "safety_level": "high",
                },
            )

        return None
