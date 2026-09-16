from dataclasses import dataclass

from .intent_router import normalize_text
from .safety_v3 import (
    SafetyDecision,
    SafetyLevel,
    contains_non_negated_signal,
    evaluate_safety,
)


@dataclass(frozen=True)
class NavigatorTopic:
    key: str
    label: str
    description: str
    red_flags: tuple[str, ...]


TOPICS = (
    NavigatorTopic(
        key="demam",
        label="Demam",
        description="Edukasi umum tentang demam dan kapan perlu mencari bantuan.",
        red_flags=("sesak", "kejang", "pingsan", "bingung", "lemah sekali"),
    ),
    NavigatorTopic(
        key="batuk",
        label="Batuk",
        description="Edukasi umum tentang batuk dan tanda bahaya pernapasan.",
        red_flags=("sesak", "sulit bernapas", "batuk darah", "bibir kebiruan"),
    ),
    NavigatorTopic(
        key="sakit_kepala",
        label="Sakit kepala",
        description="Edukasi umum tentang sakit kepala dan tanda bahaya.",
        red_flags=("pingsan", "kejang", "wajah mencong", "bicara pelo", "lemah separuh tubuh"),
    ),
    NavigatorTopic(
        key="sakit_perut",
        label="Sakit perut",
        description="Edukasi umum tentang sakit perut dan kapan perlu diperiksa.",
        red_flags=("perdarahan hebat", "pingsan", "muntah darah", "perut sangat keras"),
    ),
    NavigatorTopic(
        key="diare",
        label="Diare",
        description="Edukasi umum tentang diare dan tanda bahaya dehidrasi atau perdarahan.",
        red_flags=("perdarahan hebat", "pingsan", "tidak bisa minum", "sangat lemas"),
    ),
)

TOPIC_MAP = {topic.key: topic for topic in TOPICS}


def list_topics() -> list[dict[str, str]]:
    return [
        {
            "key": topic.key,
            "label": topic.label,
            "description": topic.description,
        }
        for topic in TOPICS
    ]


def check_navigator(
    topic: str | None,
    text: str,
    *,
    safety_decision: SafetyDecision | None = None,
) -> dict:
    """Check health navigator with integrated safety decision pipeline.

    Returns dict with status (education|high_risk|red_flag|ambiguous), topic,
    action, matchedFlags, scope, and clarification fields if needed.

    Status priority:
      1. EMERGENCY → red_flag with emergency-first scope
      2. AMBIGUOUS → ambiguous with ambiguous-clarification scope (if unclear but potentially relevant)
      3. Topic-specific red_flags → red_flag with topic-red-flag scope
      4. HIGH_RISK keywords → high_risk with high-risk scope
      5. Default → education with education-only scope
    """
    normalized = normalize_text(text)
    selected_topic = TOPIC_MAP.get(normalize_text(topic or "").replace(" ", "_"))

    # Use centralized safety pipeline
    safety_decision = safety_decision or evaluate_safety(text, intent="health_navigator")

    # Handle EMERGENCY level
    if safety_decision.level == SafetyLevel.EMERGENCY:
        return {
            "status": "red_flag",
            "topic": selected_topic.key if selected_topic else None,
            "action": "Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat.",
            "matchedFlags": list(safety_decision.matched_signals)[:5],
            "scope": "emergency-first",
            "clarificationRequired": False,
            "clarificationQuestions": [],
        }

    # Handle AMBIGUOUS level
    if safety_decision.level == SafetyLevel.AMBIGUOUS:
        return {
            "status": "ambiguous",
            "topic": selected_topic.key if selected_topic else None,
            "action": safety_decision.recommended_action or (
                "Penjelasan lebih detail akan membantu mengarahkan Anda ke informasi yang tepat."
            ),
            "matchedFlags": [],
            "scope": "ambiguous-clarification",
            "clarificationRequired": True,
            "clarificationQuestions": list(safety_decision.clarification_questions),
        }

    # Handle HIGH_RISK level
    if safety_decision.level == SafetyLevel.HIGH_RISK:
        return {
            "status": "high_risk",
            "topic": selected_topic.key if selected_topic else None,
            "action": "Konsultasikan dengan tenaga kesehatan yang berwenang sebelum mengambil keputusan.",
            "matchedFlags": list(safety_decision.matched_signals)[:3],
            "scope": "high-risk",
            "clarificationRequired": False,
            "clarificationQuestions": [],
        }

    # Check topic-specific red flags (only for selected topic in EDUCATION level)
    if selected_topic:
        matched = [
            flag
            for flag in selected_topic.red_flags
            if contains_non_negated_signal(normalized, (flag,))
        ]
        if matched:
            return {
                "status": "red_flag",
                "topic": selected_topic.key,
                "action": "Segera cari pertolongan medis; informasi ini bukan diagnosis.",
                "matchedFlags": matched,
                "scope": "topic-red-flag",
                "clarificationRequired": False,
                "clarificationQuestions": [],
            }

    # Default: EDUCATION level
    return {
        "status": "education",
        "topic": selected_topic.key if selected_topic else None,
        "action": "Gunakan informasi sebagai edukasi umum; bila keluhan menetap, memburuk, atau mengkhawatirkan, cari bantuan tenaga kesehatan.",
        "matchedFlags": [],
        "scope": "education-only",
        "clarificationRequired": False,
        "clarificationQuestions": [],
    }
