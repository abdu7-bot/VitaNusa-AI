from __future__ import annotations

from ..safety import classify_risk
from .base import BasePolicy, PolicyContext, PolicyResult


class MedicalSafetyPolicy(BasePolicy):
    policy_id = "medical_safety"
    domain = "medical_safety"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        safety = classify_risk(context.normalized_question, context.intent)

        if safety.safetyLevel == "emergency":
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
                recommended_action=safety.recommendedAction,
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

        if safety.safetyLevel == "high":
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="caution",
                priority=930,
                message=(
                    "Konteks ini memerlukan kehati-hatian lebih karena menyangkut kondisi khusus, "
                    "penyakit kronis, obat resep, atau risiko medis yang lebih tinggi."
                ),
                recommended_action=safety.recommendedAction,
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
