from __future__ import annotations

from .base import BasePolicy, PolicyContext, PolicyResult

INTEGRITY_TERMS = (
    "bukti",
    "sertifikat",
    "sertifikasi",
    "resmi",
    "testimoni",
    "bpom",
    "izin edar",
)


class ContentIntegrityPolicy(BasePolicy):
    policy_id = "content_integrity"
    domain = "content_integrity"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        if not any(term in context.normalized_question for term in INTEGRITY_TERMS):
            return None

        return PolicyResult(
            policy_id=self.policy_id,
            domain=self.domain,
            status="inform",
            priority=540,
            message=(
                "Bedakan bukti resmi, label, pernyataan produsen, testimoni, dan dugaan. "
                "Testimoni tidak cukup menjadi bukti universal."
            ),
            reasons=("evidence_or_claim_verification_relevant",),
            metadata={
                "allowed_actions": ("explain_evidence_quality",),
                "prohibited_actions": ("invent_evidence", "present_testimony_as_proof"),
            },
        )
