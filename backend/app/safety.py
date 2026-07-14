import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SafetyResult:
    safetyLevel: str
    recommendedAction: str | None = None


EMERGENCY_KEYWORDS = (
    "nyeri dada berat",
    "dada terasa berat",
    "nyeri dada",
    "sesak berat",
    "sesak napas berat",
    "sesak nafas berat",
    "sulit bernapas",
    "sulit bernafas",
    "pingsan",
    "kejang",
    "lemah separuh tubuh",
    "kelemahan satu sisi",
    "wajah mencong",
    "bicara pelo",
    "gejala stroke",
    "perdarahan hebat",
    "perdarahan berat",
    "alergi berat",
    "reaksi alergi berat",
    "bengkak wajah",
    "bibir bengkak",
    "tenggorokan bengkak",
    "ingin bunuh diri",
    "bunuh diri",
    "menyakiti diri",
)

HIGH_RISK_KEYWORDS = (
    "penyakit kronis",
    "diabetes",
    "kanker",
    "hipertensi",
    "stroke",
    "jantung",
    "ginjal",
    "asma",
    "anak kecil",
    "bayi",
    "balita",
    "ibu hamil",
    "hamil",
    "menyusui",
    "lansia",
    "alergi",
    "obat dokter",
    "obat resep",
    "resep dokter",
    "dosis",
    "antibiotik",
    "insulin",
    "menghentikan obat",
    "berhenti obat",
    "menyembuhkan diabetes",
    "menyembuhkan kanker",
    "obat segala penyakit",
    "pasti sembuh",
    "sembuh total",
)

MEDIUM_RISK_INTENTS = {
    "health_general",
    "medication_request",
    "product_claim",
}

LOW_RISK_INTENTS = {
    "identity",
    "vitacheck",
    "article_search",
    "quranic_reflection",
    "contact_admin",
    "greeting",
    "conversation_correction",
    "general_chat",
    "fallback",
}


def contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    """Whole-word/phrase match: a keyword only counts when it is not merely a
    substring embedded inside a longer word (e.g. "mual" inside
    "assalamualaikum" must NOT match "mual")."""

    for keyword in keywords:
        pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
        if re.search(pattern, text):
            return True
    return False


def classify_risk(question: str, intent: str) -> SafetyResult:
    text = question.lower()

    if contains_any(text, EMERGENCY_KEYWORDS) or intent == "danger_sign":
        return SafetyResult(
            safetyLevel="emergency",
            recommendedAction="Segera hubungi layanan darurat setempat atau datang ke IGD/fasilitas kesehatan terdekat.",
        )

    if contains_any(text, HIGH_RISK_KEYWORDS):
        return SafetyResult(
            safetyLevel="high",
            recommendedAction="Konsultasikan dengan dokter, apoteker, ahli gizi, atau tenaga kesehatan yang berwenang sebelum mengambil keputusan.",
        )

    if intent in MEDIUM_RISK_INTENTS:
        return SafetyResult(
            safetyLevel="medium",
            recommendedAction="Gunakan informasi ini sebagai edukasi umum dan cari bantuan tenaga kesehatan bila keluhan menetap, memburuk, atau terasa mengkhawatirkan.",
        )

    if intent in LOW_RISK_INTENTS:
        return SafetyResult(
            safetyLevel="low",
            recommendedAction="Gunakan sebagai edukasi awal dan pilih langkah kecil yang aman.",
        )

    return SafetyResult(
        safetyLevel="low",
        recommendedAction="Gunakan sebagai edukasi awal.",
    )
