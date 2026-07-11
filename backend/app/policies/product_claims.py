from __future__ import annotations

from .base import BasePolicy, PolicyContext, PolicyResult

HEALING_CLAIM_TERMS = (
    "menyembuhkan",
    "pasti sembuh",
    "sembuh total",
    "obat segala penyakit",
    "menggantikan obat dokter",
    "100 persen aman",
    "100% aman",
    "tanpa efek samping",
)

NATURAL_SAFETY_TERMS = (
    "alami pasti aman",
    "natural pasti aman",
    "karena alami pasti aman",
    "halal berarti aman untuk semua",
    "halal pasti aman",
)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


class ProductClaimsPolicy(BasePolicy):
    policy_id = "product_claims"
    domain = "product_claims"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        text = context.normalized_question
        healing_claim = _contains_any(text, HEALING_CLAIM_TERMS)
        natural_context = "alami" in text or "natural" in text
        universal_safety_claim = _contains_any(text, NATURAL_SAFETY_TERMS) or (
            natural_context
            and (
                "pasti halal" in text
                or "pasti aman" in text
                or ("halal" in text and "aman" in text)
            )
        )

        if not healing_claim and not universal_safety_claim:
            return None

        message = (
            "Klaim bahwa produk menyembuhkan penyakit, menggantikan pengobatan, atau pasti aman untuk semua orang "
            "tidak boleh diteruskan tanpa bukti yang memadai."
        )
        if universal_safety_claim:
            message += (
                " Alami tidak otomatis halal, dan halal tidak otomatis cocok atau aman untuk setiap orang."
            )

        return PolicyResult(
            policy_id=self.policy_id,
            domain=self.domain,
            status="block",
            priority=660,
            blocks_response=True,
            message=message,
            recommended_action=(
                "Gunakan edukasi label dan klaim; untuk kondisi pribadi, konsultasikan kepada tenaga kesehatan."
            ),
            reasons=tuple(
                reason
                for active, reason in (
                    (healing_claim, "healing_claim_detected"),
                    (universal_safety_claim, "universal_safety_claim_detected"),
                )
                if active
            ),
            metadata={
                "allowed_actions": ("provide_product_literacy", "show_educational_articles"),
                "prohibited_actions": (
                    "claim_cure",
                    "claim_universal_safety",
                    "recommend_personal_product",
                    "show_products",
                ),
            },
        )
