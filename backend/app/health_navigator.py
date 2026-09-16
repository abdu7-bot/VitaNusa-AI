from dataclasses import dataclass

from .intent_router import normalize_text
from .safety import EMERGENCY_KEYWORDS, HIGH_RISK_KEYWORDS, contains_any, contains_emergency_signal


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


def check_navigator(topic: str | None, text: str) -> dict:
    normalized = normalize_text(text)
    selected_topic = TOPIC_MAP.get(normalize_text(topic or "").replace(" ", "_"))

    if contains_emergency_signal(normalized):
        return {
            "status": "red_flag",
            "topic": selected_topic.key if selected_topic else None,
            "action": "Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat.",
            "matchedFlags": [keyword for keyword in EMERGENCY_KEYWORDS if contains_any(normalized, (keyword,))][:5],
            "scope": "emergency-first",
        }

    if selected_topic:
        matched = [flag for flag in selected_topic.red_flags if contains_any(normalized, (flag,))]
        if matched:
            return {
                "status": "red_flag",
                "topic": selected_topic.key,
                "action": "Segera cari pertolongan medis; informasi ini bukan diagnosis.",
                "matchedFlags": matched,
                "scope": "topic-red-flag",
            }

    if contains_any(normalized, HIGH_RISK_KEYWORDS):
        return {
            "status": "high_risk",
            "topic": selected_topic.key if selected_topic else None,
            "action": "Konsultasikan dengan tenaga kesehatan yang berwenang sebelum mengambil keputusan.",
            "matchedFlags": [],
            "scope": "high-risk",
        }

    return {
        "status": "education",
        "topic": selected_topic.key if selected_topic else None,
        "action": "Gunakan informasi sebagai edukasi umum; bila keluhan menetap, memburuk, atau mengkhawatirkan, cari bantuan tenaga kesehatan.",
        "matchedFlags": [],
        "scope": "education-only",
    }
