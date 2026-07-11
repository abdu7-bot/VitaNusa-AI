from __future__ import annotations

from .base import BasePolicy, PolicyContext, PolicyResult

FINAL_RULING_TERMS = (
    "fatwa",
    "hukum agama final",
    "hukum syariat final",
    "pasti halal",
    "pasti haram",
    "apakah ini haram",
    "apakah produk ini haram",
    "apakah ini halal menurut islam",
    "halal menurut islam atau tidak",
    "tentukan halal haram",
    "hukumnya apa dalam islam",
)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


class IslamicBoundaryPolicy(BasePolicy):
    policy_id = "islamic_boundary"
    domain = "islamic_boundary"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        if not _contains_any(context.normalized_question, FINAL_RULING_TERMS):
            return None

        return PolicyResult(
            policy_id=self.policy_id,
            domain=self.domain,
            status="restrict",
            priority=780,
            blocks_response=True,
            message=(
                "Nusa AI dapat menjelaskan prinsip umum dan status bukti yang tersedia, "
                "tetapi tidak memberi fatwa halal-haram final."
            ),
            recommended_action=(
                "Periksa bukti resmi dan tanyakan kepada lembaga halal atau ulama yang kompeten bila diperlukan."
            ),
            reasons=("final_religious_ruling_requested",),
            metadata={
                "allowed_actions": ("explain_general_principles", "describe_evidence_status"),
                "prohibited_actions": ("give_final_fatwa", "invent_religious_ruling"),
            },
        )
