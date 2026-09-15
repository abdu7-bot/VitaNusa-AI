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
    "dada sakit sekali",
    "dada sakit berat",
    "sesak berat",
    "sesak napas berat",
    "sesak nafas berat",
    "susah napas berat",
    "susah nafas berat",
    "sulit bernapas",
    "sulit bernafas",
    "tidak bisa bernapas",
    "tidak bisa bernafas",
    "tidak sadar",
    "pingsan",
    "kejang",
    "lemah separuh tubuh",
    "separuh badan lemah",
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
    "keracunan",
    "overdosis",
    "minum obat terlalu banyak",
    "tertelan racun",
    "cedera berat",
    "kecelakaan berat",
    "kepala terbentur keras",
    "perdarahan setelah kecelakaan",
    "hamil dan perdarahan",
    "hamil dan nyeri hebat",
    "hamil dan kejang",
    "bayi sulit bernapas",
    "bayi tidak sadar",
    "anak sulit bernapas",
    "anak tidak sadar",
    "ingin bunuh diri",
    "bunuh diri",
    "menyakiti diri",
)

# Some high-risk emergencies are naturally expressed with words between the
# two concepts. Keep these combinations explicit rather than attempting broad
# fuzzy matching that could create unsafe false positives.
EMERGENCY_COMBINATION_PATTERNS = (
    r"\bhamil\b.{0,60}\b(?:perdarahan|pendarahan|keluar darah)\b",
    r"\b(?:perdarahan|pendarahan|keluar darah)\b.{0,60}\bhamil\b",
)

# Explicit negations are handled only when they occur immediately before a
# matching emergency phrase. This avoids broad NLP assumptions while reducing
# obvious false positives such as "tidak nyeri dada".
NEGATION_WORDS = (
    "tidak",
    "tak",
    "bukan",
    "belum",
    "tanpa",
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
    """Whole-word/phrase match that avoids substring false positives."""
    for keyword in keywords:
        pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
        if re.search(pattern, text):
            return True
    return False


def contains_non_negated(text: str, keywords: tuple[str, ...]) -> bool:
    """Match an emergency phrase unless it is explicitly negated nearby.

    This is deliberately conservative: only a small, local negation window is
    recognized. We do not attempt full natural-language understanding here.
    """
    for keyword in keywords:
        pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
        for match in re.finditer(pattern, text):
            prefix = text[max(0, match.start() - 40):match.start()]
            words = re.findall(r"\b[\wÀ-ÿ]+\b", prefix)
            if not any(word in NEGATION_WORDS for word in words[-4:]):
                return True
    return False


def contains_non_negated_combination(text: str) -> bool:
    """Match an explicit emergency combination unless its symptom is negated."""
    for pattern in EMERGENCY_COMBINATION_PATTERNS:
        for match in re.finditer(pattern, text):
            matched = match.group(0)
            symptom_match = re.search(r"\b(?:perdarahan|pendarahan|keluar darah)\b", matched)
            if symptom_match is None:
                continue
            prefix = matched[:symptom_match.start()]
            words = re.findall(r"\b[\wÀ-ÿ]+\b", prefix)
            if not any(word in NEGATION_WORDS for word in words[-4:]):
                return True
    return False


def classify_risk(question: str, intent: str) -> SafetyResult:
    text = question.lower()

    if (
        contains_non_negated(text, EMERGENCY_KEYWORDS)
        or contains_non_negated_combination(text)
        or intent == "danger_sign"
    ):
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
