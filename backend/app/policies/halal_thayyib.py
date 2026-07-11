from __future__ import annotations

from typing import Any, Mapping

from .base import BasePolicy, PolicyContext, PolicyResult

HALAL_STATUSES = frozenset({"verified", "self_declared", "unknown", "not_applicable"})
HALAL_TERMS = ("halal", "haram", "sertifikat halal", "status halal")
THAYYIB_TERMS = ("thayyib", "tayyib", "thoyyib", "baik untuk semua", "aman untuk semua")


def _read(metadata: Mapping[str, Any], snake: str, camel: str, default: Any = "") -> Any:
    if snake in metadata:
        return metadata[snake]
    if camel in metadata:
        return metadata[camel]
    return default


def _has_verification_evidence(metadata: Mapping[str, Any]) -> bool:
    authority = str(_read(metadata, "halal_authority", "halalAuthority", "")).strip()
    certificate = str(
        _read(metadata, "halal_certificate_number", "halalCertificateNumber", "")
    ).strip()
    evidence_url = str(_read(metadata, "halal_evidence_url", "halalEvidenceUrl", "")).strip()
    return bool(authority and (certificate or evidence_url))


class HalalThayyibPolicy(BasePolicy):
    policy_id = "halal_thayyib"
    domain = "halal_thayyib"

    def evaluate(self, context: PolicyContext) -> PolicyResult | None:
        text = context.normalized_question
        halal_relevant = any(term in text for term in HALAL_TERMS)
        thayyib_relevant = any(term in text for term in THAYYIB_TERMS)
        if not halal_relevant and not thayyib_relevant:
            return None

        raw_status = str(
            _read(context.metadata, "halal_status", "halalStatus", "unknown")
        ).strip().lower()
        status = raw_status if raw_status in HALAL_STATUSES else "unknown"
        reasons: list[str] = []

        if raw_status not in HALAL_STATUSES:
            reasons.append("invalid_halal_status_degraded_to_unknown")

        if status == "verified" and not _has_verification_evidence(context.metadata):
            status = "unknown"
            reasons.append("verified_status_missing_checkable_evidence")

        if status == "verified":
            message = (
                "Status halal tercatat terverifikasi berdasarkan bukti resmi yang dapat diperiksa. "
                "Tetap periksa masa berlaku dan kecocokan objek dengan sertifikatnya."
            )
            policy_status = "inform"
        elif status == "self_declared":
            message = (
                "Status halal hanya berasal dari pernyataan produsen dan belum diperlakukan sebagai sertifikasi resmi."
            )
            policy_status = "caution"
        elif status == "not_applicable":
            message = "Status halal tidak relevan untuk objek yang sedang dibahas."
            policy_status = "inform"
        else:
            message = (
                "Status halal belum dapat dipastikan karena bukti resmi belum tersedia atau belum terverifikasi. "
                "Status unknown tidak berarti halal dan tidak pula berarti haram."
            )
            policy_status = "caution"
            reasons.append("halal_evidence_unavailable")

        if thayyib_relevant:
            message += (
                " Thayyib bukan badge sertifikasi universal; penilaiannya perlu melihat keamanan, "
                "kebersihan, komposisi, cara pakai, risiko, peringatan, dan kondisi pengguna."
            )
            reasons.append("thayyib_requires_contextual_safety_review")

        prohibited = ["invent_halal_status", "certify_thayyib"]
        if status in {"unknown", "self_declared"}:
            prohibited.extend(("assert_halal", "assert_haram"))

        return PolicyResult(
            policy_id=self.policy_id,
            domain=self.domain,
            status=policy_status,
            priority=740,
            message=message,
            recommended_action=(
                "Periksa sertifikasi atau bukti resmi, label, komposisi, peringatan, dan pihak berwenang terkait."
            ),
            reasons=tuple(reasons),
            metadata={
                "halal_status": status,
                "allowed_actions": ("describe_evidence_status", "explain_halal_thayyib_literacy"),
                "prohibited_actions": tuple(prohibited),
            },
        )
