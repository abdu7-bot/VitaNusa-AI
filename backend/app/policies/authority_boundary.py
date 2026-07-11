from __future__ import annotations

from .base import BasePolicy, PolicyContext, PolicyResult

DIAGNOSIS_TERMS = (
    "diagnosis",
    "diagnosa",
    "saya sakit apa",
    "penyakit saya apa",
    "apakah saya kena",
    "gejala saya apa",
    "ini penyakit apa",
)

DOSE_TERMS = (
    "dosis",
    "resep obat",
    "berapa mg",
    "berapa ml",
    "berapa tablet",
    "berapa kapsul",
    "minum obat apa",
    "obat apa untuk saya",
)

PERSONAL_PRODUCT_TERMS = (
    "produk apa yang cocok untuk saya",
    "produk mana yang cocok",
    "produk apa untuk penyakit saya",
    "produk apa untuk keluhan saya",
    "aman untuk saya",
    "boleh saya konsumsi",
    "saya cocok pakai apa",
)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


class AuthorityBoundaryPolicy(BasePolicy):
    policy_id = "authority_boundary"
    domain = "authority_boundary"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        text = context.normalized_question

        if context.intent == "medication_request" or _contains_any(text, DOSE_TERMS):
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="restrict",
                priority=870,
                blocks_response=True,
                message=(
                    "VitaNusa AI tidak dapat memberi dosis, resep, atau memilihkan obat untuk kondisi pribadi."
                ),
                recommended_action=(
                    "Tanyakan pilihan dan dosis kepada dokter atau apoteker yang berwenang."
                ),
                reasons=("personal_dose_or_prescription_request",),
                metadata={
                    "boundary_type": "dose",
                    "allowed_actions": ("provide_general_education", "seek_professional_help"),
                    "prohibited_actions": (
                        "give_personal_dose",
                        "prescribe_medication",
                        "recommend_personal_product",
                    ),
                },
            )

        if _contains_any(text, DIAGNOSIS_TERMS):
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="restrict",
                priority=860,
                blocks_response=True,
                message=(
                    "VitaNusa AI tidak dapat memastikan diagnosis atau menyatakan pengguna terkena penyakit tertentu dari chat."
                ),
                recommended_action=(
                    "Gunakan informasi umum untuk menyiapkan pertanyaan, lalu periksakan kepada tenaga kesehatan."
                ),
                reasons=("personal_diagnosis_request",),
                metadata={
                    "boundary_type": "diagnosis",
                    "allowed_actions": ("provide_general_education", "seek_professional_help"),
                    "prohibited_actions": (
                        "give_diagnosis",
                        "show_products",
                        "recommend_personal_product",
                    ),
                },
            )

        if _contains_any(text, PERSONAL_PRODUCT_TERMS):
            return PolicyResult(
                policy_id=self.policy_id,
                domain=self.domain,
                status="restrict",
                priority=840,
                blocks_response=True,
                message=(
                    "VitaNusa AI tidak dapat menentukan kecocokan produk untuk kondisi pribadi."
                ),
                recommended_action=(
                    "Periksa label resmi dan konsultasikan dengan tenaga kesehatan bila ada kondisi khusus atau obat rutin."
                ),
                reasons=("personal_product_suitability_request",),
                metadata={
                    "boundary_type": "product_suitability",
                    "allowed_actions": ("provide_product_literacy", "seek_professional_help"),
                    "prohibited_actions": (
                        "recommend_personal_product",
                        "show_products",
                        "claim_product_suitability",
                    ),
                },
            )

        return None
