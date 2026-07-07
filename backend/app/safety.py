from dataclasses import dataclass


@dataclass(frozen=True)
class SafetyResult:
    category: str
    safetyLevel: str
    recommendedAction: str | None = None


SERIOUS_COMPLAINT_KEYWORDS = (
    "sesak napas",
    "susah napas",
    "napas berat",
    "dada terasa berat",
    "nyeri dada",
    "dada sakit",
    "pingsan",
    "kejang",
    "tidak sadar",
    "penurunan kesadaran",
    "perdarahan berat",
    "muntah darah",
    "bab berdarah",
    "lemah mendadak",
    "lumpuh mendadak",
    "bicara pelo",
    "wajah mencong",
)

DIAGNOSIS_KEYWORDS = (
    "saya sakit apa",
    "penyakit apa",
    "diagnosis",
    "diagnosa",
    "apakah saya kena",
    "apakah saya menderita",
    "ini gejala apa",
)

PRODUCT_KEYWORDS = (
    "produk",
    "suplemen",
    "herbal",
    "obat",
)

HEALING_CLAIM_KEYWORDS = (
    "menyembuhkan",
    "sembuh total",
    "menyembuhkan semua penyakit",
    "obat untuk semua",
    "jaminan sembuh",
    "pasti sembuh",
)

PERSONAL_RECOMMENDATION_KEYWORDS = (
    "produk apa yang cocok",
    "produk yang cocok",
    "rekomendasi produk",
    "saya cocok minum apa",
    "untuk keluhan saya",
    "untuk sakit saya",
)

FATWA_KEYWORDS = (
    "fatwa",
    "halal atau haram secara final",
    "haram secara final",
    "halal secara final",
    "hukum final",
    "boleh atau haram",
)

GENERAL_HEALTH_KEYWORDS = (
    "hidup sehat",
    "pola makan",
    "olahraga",
    "tidur",
    "stres",
    "kesehatan",
    "sehat",
    "mual",
    "sakit kepala",
)


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def check_safety(question: str) -> SafetyResult:
    text = question.lower()

    if _contains_any(text, SERIOUS_COMPLAINT_KEYWORDS):
        return SafetyResult(
            category="serious_complaint",
            safetyLevel="high",
            recommendedAction="Segera hubungi tenaga kesehatan atau layanan darurat setempat.",
        )

    if _contains_any(text, DIAGNOSIS_KEYWORDS):
        return SafetyResult(
            category="diagnosis_request",
            safetyLevel="medium",
            recommendedAction="Gunakan informasi sebagai edukasi umum dan periksa ke tenaga kesehatan bila gejala menetap atau memburuk.",
        )

    if _contains_any(text, PRODUCT_KEYWORDS) and _contains_any(text, HEALING_CLAIM_KEYWORDS):
        return SafetyResult(
            category="product_healing_claim",
            safetyLevel="medium",
            recommendedAction="Posisikan produk hanya sebagai informasi reseller, bukan obat atau jaminan kesembuhan.",
        )

    if _contains_any(text, PRODUCT_KEYWORDS) and _contains_any(text, PERSONAL_RECOMMENDATION_KEYWORDS):
        return SafetyResult(
            category="product_personal_recommendation",
            safetyLevel="medium",
            recommendedAction="Diskusikan keluhan pribadi dengan tenaga kesehatan sebelum memilih produk.",
        )

    if _contains_any(text, FATWA_KEYWORDS):
        return SafetyResult(
            category="fatwa_request",
            safetyLevel="medium",
            recommendedAction="Tanyakan kepada ustadz, ulama, atau otoritas yang kompeten untuk keputusan hukum agama.",
        )

    if _contains_any(text, GENERAL_HEALTH_KEYWORDS):
        return SafetyResult(
            category="general_health",
            safetyLevel="low",
            recommendedAction="Mulai dari kebiasaan kecil yang aman dan konsisten.",
        )

    return SafetyResult(
        category="general",
        safetyLevel="low",
        recommendedAction=None,
    )
