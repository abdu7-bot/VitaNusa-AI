from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..policy_engine import PolicyDecision
from .models import (
    LlmMode,
    LlmRequest,
    LlmResponse,
    LlmRouterResponse,
    LlmStrategy,
)


LLM_EXECUTION_PROHIBITIONS = frozenset(
    {
        "call_llm",
        "generate_response",
        "run_local_llm",
        "use_generative_response",
        "use_llm",
    }
)

_CERTAIN_DIAGNOSIS = re.compile(
    r"\b(?:anda|kamu|saudara|pasien)\s+(?:pasti\s+)?"
    r"(?:mengidap|menderita|terkena)\s+[a-z]",
    re.IGNORECASE,
)
_DIAGNOSIS_DECLARATION = re.compile(
    r"\b(?:diagnosis(?:nya)?|hasil diagnosis)\s+(?:anda|kamu|adalah)\b",
    re.IGNORECASE,
)
_STOP_DOCTOR_MEDICATION = re.compile(
    r"(?<!jangan )(?<!tidak )\b(?:"
    r"(?:segera\s+)?hentikan\s+(?:obat|pengobatan)(?:\s+(?:dari\s+)?dokter)?"
    r"|berhenti(?:lah)?\s+(?:minum|menggunakan)\s+obat"
    r")\b",
    re.IGNORECASE,
)
_PRESCRIPTION_DOSE = re.compile(
    r"\b(?:minum|gunakan|konsumsi|suntikkan|"
    r"dosis(?:\s+obat|\s+resep)?(?:nya)?(?:\s+adalah)?)\b.{0,50}"
    r"\b(?:\d+(?:[.,]\d+)?|satu|dua|tiga|empat|lima|enam|tujuh|delapan|"
    r"sembilan|sepuluh)\s*(?:mg|ml|tablet|kapsul|kaplet|unit)\b",
    re.IGNORECASE | re.DOTALL,
)
_GUARANTEED_CURE = re.compile(
    r"\b(?:(?:pasti|dijamin)\s+(?:sembuh|menyembuhkan)|sembuh total|"
    r"menyembuhkan semua penyakit)\b",
    re.IGNORECASE,
)
_UNIVERSAL_SAFETY = re.compile(
    r"\b(?:100\s*%|100\s+persen)\s+aman\b|\bdijamin aman untuk semua\b",
    re.IGNORECASE,
)
_UNSUPPORTED_HALAL = re.compile(
    r"\b(?:produk|suplemen|herbal)\s+(?:ini\s+)?(?:adalah\s+)?"
    r"(?:(?:pasti|terjamin)\s+|sudah\s+bersertifikat\s+)?halal\b",
    re.IGNORECASE,
)
_UNSUPPORTED_HARAM = re.compile(
    r"\b(?:produk\s+(?:ini\s+)?)?pasti\s+haram\b|"
    r"\b(?:hukumnya|fatwanya)\s+(?:adalah\s+)?(?:halal|haram)\b",
    re.IGNORECASE,
)
_UNSUPPORTED_BPOM = re.compile(
    r"\b(?:produk|suplemen|herbal)\s+(?:ini\s+)?"
    r"(?:(?:sudah|telah|resmi)\s+)?(?:pasti\s+)?"
    r"terdaftar\s+(?:di\s+)?bpom\b",
    re.IGNORECASE,
)
_PERSONAL_PRODUCT_RECOMMENDATION = re.compile(
    r"\b(?:produk yang cocok untuk (?:anda|kamu)|"
    r"saya (?:merekomendasikan|sarankan) produk|"
    r"(?:gunakan|beli|konsumsi) produk ini untuk (?:keluhan|penyakit))\b",
    re.IGNORECASE,
)
_SAFE_NEGATION_PREFIXES = (
    re.compile(
        r"^\s*(?:(?:saya|kami|vitanusa ai)\s+)?(?:tidak|belum)\s+"
        r"(?:dapat|bisa|boleh|akan|menyarankan|memastikan|memberikan)\b",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*jangan\s+(?:percaya|ikuti|mengikuti|andalkan)\b", re.IGNORECASE),
    re.compile(
        r"^\s*tidak ada\b.{0,100}\b(?:dapat|bisa)\s+dijamin\b",
        re.IGNORECASE,
    ),
)
_NEGATION_REVERSAL = re.compile(
    r"[,:—]|\b(?:tetapi|namun|sebenarnya|meskipun|walaupun|dan|lalu|serta)\b",
    re.IGNORECASE,
)


class LlmGuardContext(BaseModel):
    response_blocked: bool
    dominant_policy: str | None = None
    allowed_actions: list[str] = Field(default_factory=list)
    prohibited_actions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    recommended_action: str | None = None
    safety_level: str | None = None
    intent: str | None = None


class LlmGuardDecision(BaseModel):
    allowed: bool
    reason: str | None = None
    context: LlmGuardContext


def build_guard_context(
    decision: PolicyDecision,
    *,
    intent: str,
    safety_level: str,
) -> LlmGuardContext:
    return LlmGuardContext(
        response_blocked=decision.response_blocked,
        dominant_policy=(
            decision.dominant_policy.policy_id if decision.dominant_policy else None
        ),
        allowed_actions=list(decision.allowed_actions),
        prohibited_actions=list(decision.prohibited_actions),
        warnings=list(decision.warnings),
        recommended_action=decision.recommended_action,
        safety_level=safety_level,
        intent=intent,
    )


def evaluate_llm_guard(
    context: LlmGuardContext,
    request: LlmRequest | None,
) -> LlmGuardDecision:
    if context.response_blocked:
        return LlmGuardDecision(
            allowed=False,
            reason="policy_response_blocked",
            context=context,
        )

    if context.intent == "danger_sign" or context.safety_level == "emergency":
        return LlmGuardDecision(
            allowed=False,
            reason="emergency_response_required",
            context=context,
        )

    prohibited = {action.strip().lower() for action in context.prohibited_actions}
    if prohibited.intersection(LLM_EXECUTION_PROHIBITIONS):
        return LlmGuardDecision(
            allowed=False,
            reason="generative_response_prohibited",
            context=context,
        )

    if request is None or not request.system_prompt.strip() or not request.user_message.strip():
        return LlmGuardDecision(
            allowed=False,
            reason="empty_llm_request",
            context=context,
        )

    return LlmGuardDecision(allowed=True, context=context)


def build_blocked_router_response(
    *,
    mode: LlmMode,
    strategy: LlmStrategy,
    provider: str,
    reason: str,
) -> LlmRouterResponse:
    return LlmRouterResponse(
        mode=mode,
        strategy=strategy,
        response=LlmResponse(
            provider=provider,
            status="blocked",
            error_code=reason,
            error_message=(
                "Local LLM tidak dijalankan karena keputusan keselamatan aplikasi."
            ),
        ),
    )


def validate_llm_response(
    response: LlmResponse,
    *,
    prohibited_actions: list[str] | tuple[str, ...] = (),
) -> LlmResponse:
    if response.status not in {"success", "mock"}:
        if response.content:
            return response.model_copy(update={"content": ""})
        return response

    content = response.content.strip()
    if not content:
        return response.model_copy(
            update={
                "content": "",
                "status": "empty",
                "error_code": "empty_model_response",
                "error_message": "Provider tidak menghasilkan konten yang dapat digunakan.",
            }
        )

    patterns = [
        _CERTAIN_DIAGNOSIS,
        _DIAGNOSIS_DECLARATION,
        _STOP_DOCTOR_MEDICATION,
        _PRESCRIPTION_DOSE,
        _GUARANTEED_CURE,
        _UNIVERSAL_SAFETY,
        _UNSUPPORTED_HALAL,
        _UNSUPPORTED_BPOM,
    ]
    prohibited = {action.strip().lower() for action in prohibited_actions}
    if prohibited.intersection(
        {"assert_haram", "give_final_fatwa", "invent_religious_ruling"}
    ):
        patterns.append(_UNSUPPORTED_HARAM)
    if prohibited.intersection(
        {
            "claim_product_suitability",
            "recommend_personal_product",
            "show_products",
        }
    ):
        patterns.append(_PERSONAL_PRODUCT_RECOMMENDATION)

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?;])\s+|\n+", content)
        if sentence.strip()
    ]
    unsafe_output = any(
        any(pattern.search(sentence) for pattern in patterns)
        for sentence in sentences
        if not _is_clear_safe_negation(sentence)
    )

    if unsafe_output:
        return response.model_copy(
            update={
                "content": "",
                "status": "blocked",
                "error_code": "response_validation_blocked",
                "error_message": (
                    "Respons Local LLM diblokir oleh pemeriksaan hasil aplikasi."
                ),
            }
        )

    return response.model_copy(update={"content": content})


def _is_clear_safe_negation(sentence: str) -> bool:
    if _NEGATION_REVERSAL.search(sentence):
        return False
    return any(pattern.search(sentence) for pattern in _SAFE_NEGATION_PREFIXES)
